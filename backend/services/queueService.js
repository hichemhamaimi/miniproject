const { Queue, Worker } = require('bullmq');
const config = require('../config/system.config');
const ExamBlueprint = require('../models/ExamBlueprint');
const GeneratedExam = require('../models/GeneratedExam');
const GenerationJob = require('../models/GenerationJob');
const Material = require('../models/Material');
const { generateExamFromBlueprint } = require('./llmService');
const retrievalService = require('./retrievalService');
const embeddingService = require('./embeddingService');
const vectorService = require('./vectorService');
const { v4: uuidv4 } = require('uuid');

const redisConnection = {
    host: config.queue.redisHost,
    port: config.queue.redisPort,
    ...(config.queue.redisPassword ? { password: config.queue.redisPassword } : {})
};

let examQueue = null;
let examWorker = null;

const handleGenerateExamJob = async (jobData) => {
    const { blueprintId, teacherId, jobDocId } = jobData;

    if (jobDocId) {
        await GenerationJob.findByIdAndUpdate(jobDocId, {
            status: 'processing',
            bullJobId: jobData.jobId // Assuming we pass this or it's available
        });
    }

    const blueprint = await ExamBlueprint.findById(blueprintId);
    if (!blueprint) throw new Error(`Blueprint ${blueprintId} not found`);

    // Use RAG to get the most relevant context instead of loading all chunks
    const query = (blueprint.description || '') + ' ' + (blueprint.topics || blueprint.selectedConcepts?.join(' ') || '');
    const topChunks = await retrievalService.retrieveRelevantChunks(query, 10);
    
    // Fallback if no vector results (maybe mock mode)
    let contextChunksText = topChunks.join('\n\n');
    
    // We pass the plain text chunks now, llmService will just map them (needs adjusting in llmService)
    // Actually llmService expects objects with `.text`. Let's mock the structure for backward compatibility:
    const mockChunks = topChunks.map((text, idx) => ({ id: idx, text }));

    const examJson = await generateExamFromBlueprint(blueprint, mockChunks);

    const questions = examJson.questions.map((q) => ({
        id: uuidv4(),
        type: q.type,
        difficulty: q.difficulty,
        text: q.question,
        options: q.options || [],
        correctAnswers: q.correctAnswers || [],
        trueFalseAnswer: q.trueFalseAnswer,
        matchingPairs: q.matchingPairs || [],
        orderedItems: q.orderedItems || [],
        explanation: q.explanation || '',
        scoringOverride: { active: false }
    }));

    const savedExam = await GeneratedExam.create({
        teacherId,
        blueprintId,
        title: examJson.examTitle,
        questions,
        status: 'draft'
    });

    if (jobDocId) {
        await GenerationJob.findByIdAndUpdate(jobDocId, {
            status: 'done',
            resultExamId: savedExam._id
        });
    }

    return { examId: savedExam._id.toString() };
};

const handleMaterialEmbeddingsJob = async (jobData) => {
    const { materialId } = jobData;
    const material = await Material.findById(materialId);
    
    if (!material) {
        console.warn(`[Queue] Material ${materialId} not found`);
        return;
    }

    try {
        const { splitIntoChunks } = require('./materialParser');
        const chunks = splitIntoChunks(material.parsedText);
        
        console.log(`[Queue] Generating embeddings for ${chunks.length} chunks of material ${materialId}`);
        const texts = chunks.map(c => c.text);
        const vectors = await embeddingService.generateEmbeddings(texts);
        
        const chunksData = chunks.map((chunk, idx) => ({
            vector: vectors[idx],
            payload: {
                materialId: materialId.toString(),
                text: chunk.text,
                chunkId: chunk.id
            }
        }));

        await vectorService.insertChunks(chunksData);

        // -- AUTO MINDMAP GENERATION --
        try {
            console.log(`[Queue] Generating automatic mindmap for material ${materialId}`);
            const { generateMindmap } = require('./llmService');
            const MaterialMindmap = require('../models/MaterialMindmap');
            
            // Generate mindmap based on the chunks
            const mindmapData = await generateMindmap(material.title, chunksData);
            
            await MaterialMindmap.findOneAndUpdate(
                { materialId: material._id, teacherId: material.teacherId },
                {
                    materialId: material._id,
                    teacherId: material.teacherId,
                    title: mindmapData.title || material.title,
                    concepts: mindmapData.concepts || []
                },
                { upsert: true, new: true }
            );
            console.log(`[Queue] Automatic mindmap saved for material ${materialId}`);
        } catch (mmErr) {
            console.error(`[Queue] Auto-mindmap generation failed for ${materialId}:`, mmErr.message);
        }

        // Delete parsedText to save mongodb space, update status
        await Material.findByIdAndUpdate(materialId, {
            status: 'ready',
            $unset: { parsedText: 1 } 
        });
        console.log(`[Queue] Material ${materialId} embedding completed and vector DB updated`);
    } catch (err) {
        await Material.findByIdAndUpdate(materialId, {
            status: 'error',
            errorMessage: err.message
        });
        throw err;
    }
};

const initQueue = () => {
    try {
        examQueue = new Queue(config.queue.queueName, { connection: redisConnection });

        examWorker = new Worker(config.queue.queueName, async (job) => {
            if (job.name === 'generateExam') {
                return await handleGenerateExamJob({ ...job.data, jobId: String(job.id) });
            } else if (job.name === 'processMaterialEmbeddings') {
                return await handleMaterialEmbeddingsJob(job.data);
            }
        }, {
            connection: redisConnection,
            attempts: config.queue.jobRetryAttempts
        });

        examWorker.on('failed', async (job, err) => {
            if (job.name === 'generateExam' && job?.data?.jobDocId) {
                await GenerationJob.findByIdAndUpdate(job.data.jobDocId, {
                    status: 'failed',
                    error: err.message
                });
            }
            console.error(`[Queue] Job ${job.name} failed:`, err.message);
        });

        console.log('[Queue] BullMQ queue and worker initialized');
    } catch (err) {
        console.warn('[Queue] Redis not available — queue disabled:', err.message);
    }
};

const enqueueExamGeneration = async (blueprintId, teacherId) => {
    const jobDoc = await GenerationJob.create({
        blueprintId,
        teacherId,
        status: 'queued'
    });

    if (!examQueue) {
        console.warn('[Queue] No queue available, running generation synchronously');
        setImmediate(async () => {
            try {
                await handleGenerateExamJob({ blueprintId, teacherId, jobDocId: jobDoc._id });
            } catch (err) {
                await GenerationJob.findByIdAndUpdate(jobDoc._id, {
                    status: 'failed',
                    error: err.message
                });
            }
        });
    } else {
        await examQueue.add('generateExam', {
            blueprintId: blueprintId.toString(),
            teacherId,
            jobDocId: jobDoc._id.toString()
        });
    }
    return jobDoc;
};

const enqueueMaterialProcessing = async (materialId) => {
    if (!examQueue) {
        console.warn('[Queue] No queue available, running material embedding synchronously');
        setImmediate(async () => {
            await handleMaterialEmbeddingsJob({ materialId });
        });
    } else {
        await examQueue.add('processMaterialEmbeddings', {
            materialId: materialId.toString()
        });
    }
};

module.exports = { initQueue, enqueueExamGeneration, enqueueMaterialProcessing };
