const Material = require('../../models/Material');
const MaterialMindmap = require('../../models/MaterialMindmap');
const { generateMindmap } = require('../../services/llmService');

// POST /teacher/materials/:id/mindmap
const createMindmap = async (req, res) => {
    try {
        const material = await Material.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!material) return res.status(404).json({ message: 'Material not found.' });

        if (material.status !== 'ready') {
            return res.status(400).json({ message: 'Material is not ready yet. Please wait for parsing to complete.' });
        }

        if (material.chunks.length === 0) {
            return res.status(400).json({ message: 'Material has no parsed chunks to generate a mindmap from.' });
        }

        const mindmapData = await generateMindmap(material.title, material.chunks);

        // Upsert: replace existing mindmap for this material
        const mindmap = await MaterialMindmap.findOneAndUpdate(
            { materialId: material._id, teacherId: req.userId },
            {
                materialId: material._id,
                teacherId: req.userId,
                title: mindmapData.title || material.title,
                concepts: mindmapData.concepts || []
            },
            { upsert: true, new: true }
        );

        res.status(201).json(mindmap);
    } catch (err) {
        console.error('Mindmap generation error:', err);
        res.status(500).json({ message: err.message || 'Failed to generate mindmap.' });
    }
};

// GET /teacher/materials/:id/mindmap
const getMindmap = async (req, res) => {
    try {
        const mindmap = await MaterialMindmap.findOne({
            materialId: req.params.id,
            teacherId: req.userId
        });
        if (!mindmap) return res.status(404).json({ message: 'No mindmap found. Generate one first.' });
        res.json(mindmap);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch mindmap.' });
    }
};

module.exports = { createMindmap, getMindmap };
