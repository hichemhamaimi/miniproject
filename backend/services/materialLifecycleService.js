const fs = require('fs');
const Material = require('../models/Material');
const MaterialMindmap = require('../models/MaterialMindmap');
const ExamBlueprint = require('../models/ExamBlueprint');
const GeneratedExam = require('../models/GeneratedExam');
const vectorService = require('./vectorService');
const retrievalService = require('./retrievalService');
const AppError = require('../utils/AppError');

const PROCESSING_STATUSES = new Set(['uploading', 'parsing', 'embedding', 'generating_mindmap']);

const ensureMaterialCanBeDeleted = async (material) => {
    if (PROCESSING_STATUSES.has(material.status)) {
        throw new AppError(409, 'This material is still being processed. Please wait until processing finishes before deleting it.');
    }

    const [blueprintInUse, examInUse] = await Promise.all([
        ExamBlueprint.exists({ materials: material._id }),
        GeneratedExam.exists({ materialIds: material._id }),
    ]);

    if (blueprintInUse || examInUse) {
        throw new AppError(409, 'This material is already used in an exam workflow or generated exam and cannot be deleted safely.');
    }
};

const deleteMaterialForTeacher = async (materialId, teacherId) => {
    const material = await Material.findOne({ _id: materialId, teacherId });
    if (!material) {
        throw new AppError(404, 'Material not found.');
    }

    await ensureMaterialCanBeDeleted(material);

    await vectorService.deleteChunksByMaterialId(material._id.toString());
    await MaterialMindmap.deleteMany({ materialId: material._id });

    if (material.storagePath && fs.existsSync(material.storagePath)) {
        fs.unlinkSync(material.storagePath);
    }

    await Material.deleteOne({ _id: material._id, teacherId });
    retrievalService.clearCache();

    return material;
};

const retryMaterialProcessingForTeacher = async (materialId, teacherId) => {
    const material = await Material.findOne({ _id: materialId, teacherId });
    if (!material) {
        throw new AppError(404, 'Material not found.');
    }

    if (PROCESSING_STATUSES.has(material.status)) {
        throw new AppError(409, 'This material is already being processed.');
    }

    if (!material.storagePath || !fs.existsSync(material.storagePath)) {
        throw new AppError(409, 'The original uploaded file is no longer available for retry.');
    }

    await vectorService.deleteChunksByMaterialId(material._id.toString());
    await MaterialMindmap.deleteMany({ materialId: material._id });
    retrievalService.clearCache();

    await Material.findByIdAndUpdate(material._id, {
        status: 'uploading',
        statusMessage: 'Retry requested. Preparing to parse document again.',
        errorMessage: '',
        $unset: { parsedText: 1 },
    });

    return material;
};

module.exports = {
    deleteMaterialForTeacher,
    retryMaterialProcessingForTeacher,
    PROCESSING_STATUSES,
};
