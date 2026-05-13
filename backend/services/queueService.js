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
const { getRedisConnectionOptions } = require('./redisService');

const DEFAULT_SCORING_RULE = {
    reward: 1,
    penalty: -0.5,
    unanswered: 0,
};

const normalizeScoringRule = (rule = {}) => ({
    reward: Number.isFinite(Number(rule.reward)) ? Number(rule.reward) : DEFAULT_SCORING_RULE.reward,
    penalty: Number.isFinite(Number(rule.penalty)) ? Number(rule.penalty) : DEFAULT_SCORING_RULE.penalty,
    unanswered: Number.isFinite(Number(rule.unanswered)) ? Number(rule.unanswered) : DEFAULT_SCORING_RULE.unanswered,
});

const toPlainObject = (value) => {
    if (!value) return {};
    if (value instanceof Map) {
        return Object.fromEntries(value.entries());
    }
    if (typeof value.toObject === 'function') {
        return value.toObject();
    }
    return value;
};

const resolveBlueprintScoringConfig = (blueprint) => {
    const scoringConfig = toPlainObject(blueprint.scoringConfig);
    const legacyScoringRules = toPlainObject(blueprint.scoringRules);
    const perTypeSource = scoringConfig.perType || legacyScoringRules;

    const perType = config.examGeneration.validQuestionTypes.reduce((accumulator, questionType) => {
        if (perTypeSource?.[questionType]) {
            accumulator[questionType] = normalizeScoringRule(perTypeSource[questionType]);
        }
        return accumulator;
    }, {});

    return {
        mode: scoringConfig.mode === 'section' || Object.keys(perType).length > 0 ? 'section' : 'question',
        defaultRule: normalizeScoringRule(scoringConfig.defaultRule),
        perType,
    };
};

const redisConnection = getRedisConnectionOptions();

let examQueue = null;
let examWorker = null;

const queueJobOptions = {
    attempts: config.queue.jobRetryAttempts,
    backoff: {
        type: 'exponential',
        delay: 5000,
    },
};

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

    const query = `${blueprint.instructions || ''} ${blueprint.selectedConcepts?.join(' ') || ''}`.trim();
    const selectedMaterialIds = (blueprint.materials || []).map((materialId) => materialId.toString());
    let topChunks = await retrievalService.retrieveRelevantChunks(query || blueprint.title, {
        topK: 10,
        materialIds: selectedMaterialIds,
    });

    if (topChunks.length === 0 && selectedMaterialIds.length > 0) {
        const fallbackChunks = await Promise.all(
            selectedMaterialIds.map((materialId) => vectorService.getChunksByMaterialId(materialId, 8))
        );
        topChunks = fallbackChunks.flat().map((chunk) => chunk.text).filter(Boolean).slice(0, 10);
    }
    
    // Fallback if no vector results (maybe mock mode)
    let contextChunksText = topChunks.join('\n\n');
    
    // We pass the plain text chunks now, llmService will just map them (needs adjusting in llmService)
    // Actually llmService expects objects with `.text`. Let's mock the structure for backward compatibility:
    const mockChunks = topChunks.map((text, idx) => ({ id: idx, text }));

    const examJson = await generateExamFromBlueprint(blueprint, mockChunks, {
        teacherId,
        providerConfigId: blueprint.generationContext?.examProviderConfigId || null,
    });
    const scoringConfig = resolveBlueprintScoringConfig(blueprint);
    const scoringDefaults = {
        correct: scoringConfig.defaultRule.reward,
        incorrect: scoringConfig.defaultRule.penalty,
        unanswered: scoringConfig.defaultRule.unanswered,
    };

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
        scoringOverride: scoringConfig.mode === 'section' && scoringConfig.perType[q.type]
            ? {
                active: true,
                correct: scoringConfig.perType[q.type].reward,
                incorrect: scoringConfig.perType[q.type].penalty,
                unanswered: scoringConfig.perType[q.type].unanswered,
            }
            : { active: false }
    }));

    const savedExam = await GeneratedExam.create({
        teacherId,
        moduleId: blueprint.moduleId,
        blueprintId,
        title: examJson.examTitle,
        materialIds: blueprint.materials || [],
        selectedConcepts: blueprint.selectedConcepts || [],
        questions,
        scoringDefaults,
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
        await vectorService.ensureCollectionExists();
        embeddingService.setVectorSize(vectorService.getVectorSize());

        const { splitIntoChunks } = require('./materialParser');
        const chunks = splitIntoChunks(material.parsedText);
        if (chunks.length === 0) {
            throw new Error('No valid text chunks were produced from the parsed material.');
        }
        
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
        retrievalService.clearCache();

        // -- AUTO MINDMAP GENERATION --
        try {
            await Material.findByIdAndUpdate(materialId, {
                status: 'generating_mindmap',
                statusMessage: 'Generating structured topic map with AI.',
            });
            console.log(`[Queue] Generating automatic mindmap for material ${materialId}`);
            const { generateMindmap } = require('./llmService');
            const MaterialMindmap = require('../models/MaterialMindmap');
            
            // Generate mindmap based on the chunks
            const mindmapData = await generateMindmap(material.title, chunksData, {
                teacherId: material.teacherId,
                providerConfigId: material.mindmapProviderConfigId || null,
            });
            
            await MaterialMindmap.findOneAndUpdate(
                { materialId: material._id, teacherId: material.teacherId },
                {
                    materialId: material._id,
                    teacherId: material.teacherId,
                    moduleId: material.moduleId,
                    title: mindmapData.title || material.title,
                    concepts: mindmapData.concepts || []
                },
                { upsert: true, returnDocument: 'after' }
            );
            console.log(`[Queue] Automatic mindmap saved for material ${materialId}`);
        } catch (mmErr) {
            console.error(`[Queue] Auto-mindmap generation failed for ${materialId}:`, mmErr.message);
        }

        // Delete parsedText to save mongodb space, update status
        await Material.findByIdAndUpdate(materialId, {
            status: 'ready',
            statusMessage: 'Material processing completed successfully.',
            $unset: { parsedText: 1 } 
        });
        console.log(`[Queue] Material ${materialId} embedding completed and vector DB updated`);
    } catch (err) {
        await Material.findByIdAndUpdate(materialId, {
            status: 'failed',
            statusMessage: 'Material processing failed.',
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
        console.warn(`[Queue] Redis not available - queue disabled: ${err.message}`);
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
        }, queueJobOptions);
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
        }, queueJobOptions);
    }
};

module.exports = { initQueue, enqueueExamGeneration, enqueueMaterialProcessing };
