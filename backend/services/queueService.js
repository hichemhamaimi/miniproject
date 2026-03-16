const { Queue, Worker } = require('bullmq');
const config = require('../config/system.config');
const ExamBlueprint = require('../models/ExamBlueprint');
const GeneratedExam = require('../models/GeneratedExam');
const GenerationJob = require('../models/GenerationJob');
const Material = require('../models/Material');
const { generateExamFromBlueprint } = require('./llmService');
const { v4: uuidv4 } = require('uuid');

const redisConnection = {
    host: config.queue.redisHost,
    port: config.queue.redisPort,
    ...(config.queue.redisPassword ? { password: config.queue.redisPassword } : {})
};

let examQueue = null;
let examWorker = null;

/**
 * Initialize the BullMQ queue and worker.
 * Called once on server startup.
 */
const initQueue = () => {
    try {
        examQueue = new Queue(config.queue.queueName, { connection: redisConnection });

        examWorker = new Worker(config.queue.queueName, async (job) => {
            const { blueprintId, teacherId, jobDocId } = job.data;

            // Mark job as processing
            await GenerationJob.findByIdAndUpdate(jobDocId, {
                status: 'processing',
                bullJobId: String(job.id)
            });

            // Load blueprint
            const blueprint = await ExamBlueprint.findById(blueprintId);
            if (!blueprint) throw new Error(`Blueprint ${blueprintId} not found`);

            // Load material chunks
            const materials = await Material.find({
                _id: { $in: blueprint.materials }
            }).select('chunks parsedText title');

            const allChunks = materials.flatMap(m => m.chunks);

            // Generate exam via LLM
            const examJson = await generateExamFromBlueprint(blueprint, allChunks);

            // Map to GeneratedExam schema
            const questions = examJson.questions.map((q, idx) => ({
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

            // Mark job as done
            await GenerationJob.findByIdAndUpdate(jobDocId, {
                status: 'done',
                resultExamId: savedExam._id
            });

            return { examId: savedExam._id.toString() };
        }, {
            connection: redisConnection,
            attempts: config.queue.jobRetryAttempts
        });

        examWorker.on('failed', async (job, err) => {
            if (job?.data?.jobDocId) {
                await GenerationJob.findByIdAndUpdate(job.data.jobDocId, {
                    status: 'failed',
                    error: err.message
                });
            }
            console.error('[Queue] Job failed:', err.message);
        });

        console.log('[Queue] Exam generation queue initialized');
    } catch (err) {
        console.warn('[Queue] Redis not available — exam generation queue disabled:', err.message);
    }
};

/**
 * Enqueue an exam generation job.
 * Returns the GenerationJob document ID for polling.
 */
const enqueueExamGeneration = async (blueprintId, teacherId) => {
    // Create the job tracking document first
    const jobDoc = await GenerationJob.create({
        blueprintId,
        teacherId,
        status: 'queued'
    });

    if (!examQueue) {
        // Fallback: run synchronously (no Redis)
        console.warn('[Queue] No queue available, running generation synchronously');
        setImmediate(async () => {
            try {
                await GenerationJob.findByIdAndUpdate(jobDoc._id, { status: 'processing' });

                const blueprint = await ExamBlueprint.findById(blueprintId);
                const materials = await Material.find({ _id: { $in: blueprint.materials } });
                const allChunks = materials.flatMap(m => m.chunks);

                const examJson = await generateExamFromBlueprint(blueprint, allChunks);

                const { v4: uuidv4 } = require('uuid');
                const questions = examJson.questions.map(q => ({
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

                await GenerationJob.findByIdAndUpdate(jobDoc._id, {
                    status: 'done',
                    resultExamId: savedExam._id
                });
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

module.exports = { initQueue, enqueueExamGeneration };
