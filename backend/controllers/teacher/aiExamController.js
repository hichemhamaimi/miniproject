const { v4: uuidv4 } = require('uuid');
const GeneratedExam = require('../../models/GeneratedExam');
const GenerationJob = require('../../models/GenerationJob');
const ExamBlueprint = require('../../models/ExamBlueprint');
const { enqueueExamGeneration } = require('../../services/queueService');
const { validateExam } = require('../../services/examValidator');
const config = require('../../config/system.config');

// POST /teacher/ai-exams/generate
const generateExam = async (req, res) => {
    try {
        const { blueprintId } = req.body;
        if (!blueprintId) return res.status(400).json({ message: 'blueprintId is required.' });

        const blueprint = await ExamBlueprint.findOne({ _id: blueprintId, teacherId: req.userId });
        if (!blueprint) return res.status(404).json({ message: 'Blueprint not found.' });

        const jobDoc = await enqueueExamGeneration(blueprintId, req.userId);
        res.status(202).json({ message: 'Exam generation queued.', jobId: jobDoc._id });
    } catch (err) {
        console.error('Generate exam error:', err);
        res.status(500).json({ message: err.message || 'Failed to start generation.' });
    }
};

// GET /teacher/ai-exams/job/:jobId
const getJobStatus = async (req, res) => {
    try {
        const job = await GenerationJob.findOne({ _id: req.params.jobId, teacherId: req.userId });
        if (!job) return res.status(404).json({ message: 'Job not found.' });
        res.json({
            jobId: job._id,
            status: job.status,
            resultExamId: job.resultExamId || null,
            error: job.error || null,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to get job status.' });
    }
};

// GET /teacher/ai-exams
const getExams = async (req, res) => {
    try {
        const exams = await GeneratedExam.find({ teacherId: req.userId })
            .select('-questions')
            .sort({ createdAt: -1 });
        res.json(exams);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch exams.' });
    }
};

// GET /teacher/ai-exams/:id
const getExam = async (req, res) => {
    try {
        const exam = await GeneratedExam.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        res.json(exam);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch exam.' });
    }
};

// PUT /teacher/ai-exams/:id  — teacher edits exam
const updateExam = async (req, res) => {
    try {
        const { title, questions, scoringDefaults } = req.body;

        const exam = await GeneratedExam.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        if (exam.status === 'published') return res.status(400).json({ message: 'Cannot edit a published exam.' });

        // Validate question count
        if (questions && questions.length > config.examGeneration.maxQuestions) {
            return res.status(400).json({
                message: `Cannot have more than ${config.examGeneration.maxQuestions} questions.`
            });
        }

        // Build a minimal exam JSON for validation
        if (questions && questions.length > 0) {
            const examForValidation = {
                examTitle: title || exam.title,
                questions: questions.map(q => ({
                    type: q.type,
                    difficulty: q.difficulty,
                    question: q.text,
                    options: q.options,
                    correctAnswers: q.correctAnswers,
                    trueFalseAnswer: q.trueFalseAnswer,
                    matchingPairs: q.matchingPairs,
                    orderedItems: q.orderedItems,
                    explanation: q.explanation
                }))
            };
            const validation = validateExam(examForValidation);
            if (!validation.valid) {
                return res.status(400).json({ message: 'Validation failed.', errors: validation.errors });
            }
        }

        // Ensure all questions have an id
        const processedQuestions = (questions || exam.questions).map(q => ({
            ...q,
            id: q.id || uuidv4()
        }));

        const updated = await GeneratedExam.findByIdAndUpdate(
            req.params.id,
            {
                ...(title && { title }),
                ...(questions && { questions: processedQuestions }),
                ...(scoringDefaults && { scoringDefaults })
            },
            { new: true }
        );

        res.json(updated);
    } catch (err) {
        console.error('Update exam error:', err);
        res.status(500).json({ message: 'Failed to update exam.' });
    }
};

// POST /teacher/ai-exams/:id/publish
const publishExam = async (req, res) => {
    try {
        const exam = await GeneratedExam.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        if (exam.status === 'published') return res.status(400).json({ message: 'Exam is already published.' });
        if (exam.questions.length === 0) return res.status(400).json({ message: 'Cannot publish an exam with no questions.' });

        const updated = await GeneratedExam.findByIdAndUpdate(
            req.params.id,
            { status: 'published', publishedAt: new Date() },
            { new: true }
        );

        res.json({ message: 'Exam published successfully.', exam: updated });
    } catch (err) {
        res.status(500).json({ message: 'Failed to publish exam.' });
    }
};

// POST /teacher/ai-exams/:id/unpublish
const unpublishExam = async (req, res) => {
    try {
        const exam = await GeneratedExam.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });

        const updated = await GeneratedExam.findByIdAndUpdate(
            req.params.id,
            { status: 'draft', publishedAt: null },
            { new: true }
        );
        res.json({ message: 'Exam unpublished.', exam: updated });
    } catch (err) {
        res.status(500).json({ message: 'Failed to unpublish exam.' });
    }
};

module.exports = { generateExam, getJobStatus, getExams, getExam, updateExam, publishExam, unpublishExam };
