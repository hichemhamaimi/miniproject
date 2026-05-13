const ExamBlueprint = require('../../models/ExamBlueprint');
const config = require('../../config/system.config');
const pool = require('../../config/dbConnect');

// POST /teacher/blueprints
const createBlueprint = async (req, res) => {
    try {
        const {
            moduleId,
            title,
            materials,
            selectedConcepts,
            questionTypes,
            difficultyDistribution,
            scoringRules,
            scoringConfig,
            instructions,
            totalQuestions
        } = req.body;

        // Validate totalQuestions does not exceed config max
        if (totalQuestions > config.examGeneration.maxQuestions) {
            return res.status(400).json({
                message: `Total questions cannot exceed ${config.examGeneration.maxQuestions}.`
            });
        }
        if (!moduleId || !title) {
            return res.status(400).json({ message: 'moduleId and title are required.' });
        }
        const [moduleRows] = await pool.query(
            'SELECT id FROM modules WHERE id = ? AND responsable_teacher_id = ? LIMIT 1',
            [moduleId, req.userId]
        );
        if (moduleRows.length === 0) {
            return res.status(403).json({ message: 'You are not authorized to create a blueprint for this module.' });
        }

        const blueprint = await ExamBlueprint.create({
            teacherId: req.userId,
            moduleId,
            title,
            materials: materials || [],
            selectedConcepts: selectedConcepts || [],
            questionTypes: questionTypes || {},
            difficultyDistribution: difficultyDistribution || {},
            scoringRules: scoringRules || {},
            scoringConfig: scoringConfig || {},
            instructions: instructions || '',
            totalQuestions: totalQuestions || 0,
            generationContext: {
                selectedMaterialTitles: req.body.selectedMaterialTitles || [],
                selectedTopicCount: (selectedConcepts || []).length,
                examProviderConfigId: req.body.examProviderConfigId || null,
                academicDifficultyDistribution: req.body.academicDifficultyDistribution || {},
                cognitiveDistribution: req.body.cognitiveDistribution || {},
                questionProfiles: req.body.questionProfiles || [],
            },
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
            moduleId,
            title,
            materials,
            selectedConcepts,
            questionTypes,
            difficultyDistribution,
            scoringRules,
            scoringConfig,
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
            {
                moduleId,
                title,
                materials,
                selectedConcepts,
                questionTypes,
                difficultyDistribution,
                scoringRules,
                scoringConfig,
                instructions,
                totalQuestions,
                generationContext: {
                    selectedMaterialTitles: req.body.selectedMaterialTitles || [],
                    selectedTopicCount: (selectedConcepts || []).length,
                    examProviderConfigId: req.body.examProviderConfigId || null,
                    academicDifficultyDistribution: req.body.academicDifficultyDistribution || {},
                    cognitiveDistribution: req.body.cognitiveDistribution || {},
                    questionProfiles: req.body.questionProfiles || [],
                },
            },
            { new: true }
        );

        if (!blueprint) return res.status(404).json({ message: 'Blueprint not found.' });
        res.json(blueprint);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update blueprint.' });
    }
};

module.exports = { createBlueprint, getBlueprints, getBlueprint, updateBlueprint };
