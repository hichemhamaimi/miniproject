const ExamBlueprint = require('../../models/ExamBlueprint');
const config = require('../../config/system.config');

// POST /teacher/blueprints
const createBlueprint = async (req, res) => {
    try {
        const {
            materials,
            selectedConcepts,
            questionTypes,
            difficultyDistribution,
            scoringRules,
            instructions,
            totalQuestions
        } = req.body;

        // Validate totalQuestions does not exceed config max
        if (totalQuestions > config.examGeneration.maxQuestions) {
            return res.status(400).json({
                message: `Total questions cannot exceed ${config.examGeneration.maxQuestions}.`
            });
        }

        const blueprint = await ExamBlueprint.create({
            teacherId: req.userId,
            materials: materials || [],
            selectedConcepts: selectedConcepts || [],
            questionTypes: questionTypes || {},
            difficultyDistribution: difficultyDistribution || {},
            scoringRules: scoringRules || {},
            instructions: instructions || '',
            totalQuestions: totalQuestions || 0
        });

        res.status(201).json(blueprint);
    } catch (err) {
        console.error('Blueprint creation error:', err);
        res.status(500).json({ message: 'Failed to create blueprint.' });
    }
};

// GET /teacher/blueprints
const getBlueprints = async (req, res) => {
    try {
        const blueprints = await ExamBlueprint.find({ teacherId: req.userId })
            .sort({ createdAt: -1 });
        res.json(blueprints);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch blueprints.' });
    }
};

// GET /teacher/blueprints/:id
const getBlueprint = async (req, res) => {
    try {
        const blueprint = await ExamBlueprint.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!blueprint) return res.status(404).json({ message: 'Blueprint not found.' });
        res.json(blueprint);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch blueprint.' });
    }
};

// PUT /teacher/blueprints/:id
const updateBlueprint = async (req, res) => {
    try {
        const {
            materials,
            selectedConcepts,
            questionTypes,
            difficultyDistribution,
            scoringRules,
            instructions,
            totalQuestions
        } = req.body;

        if (totalQuestions > config.examGeneration.maxQuestions) {
            return res.status(400).json({
                message: `Total questions cannot exceed ${config.examGeneration.maxQuestions}.`
            });
        }

        const blueprint = await ExamBlueprint.findOneAndUpdate(
            { _id: req.params.id, teacherId: req.userId },
            { materials, selectedConcepts, questionTypes, difficultyDistribution, scoringRules, instructions, totalQuestions },
            { new: true }
        );

        if (!blueprint) return res.status(404).json({ message: 'Blueprint not found.' });
        res.json(blueprint);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update blueprint.' });
    }
};

module.exports = { createBlueprint, getBlueprints, getBlueprint, updateBlueprint };
