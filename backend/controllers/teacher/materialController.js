const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../../config/dbConnect');
const Material = require('../../models/Material');
const MaterialMindmap = require('../../models/MaterialMindmap');
const { parseMaterial } = require('../../services/materialParser');
const { deleteMaterialForTeacher, retryMaterialProcessingForTeacher } = require('../../services/materialLifecycleService');
const config = require('../../config/system.config');
const { getProviderById } = require('../../services/aiProviderService');
const { parsePositiveInt, sanitizeString } = require('../../utils/validation');
const AppError = require('../../utils/AppError');

const MAX_SIZE_BYTES = config.materialProcessing.maxMaterialSizeMB * 1024 * 1024;

// Multer storage — save to storage/materials/{teacherId}/
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', '..', config.storage.materialsBasePath, String(req.userId));
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        cb(null, `${uuidv4()}.${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (config.materialProcessing.supportedFileTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported file type: ${ext}. Allowed: ${config.materialProcessing.supportedFileTypes.join(', ')}`));
    }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES } });
const getUploadedFileType = (file) => path.extname(file?.originalname || '').toLowerCase().replace('.', '');

// POST /teacher/materials/upload
const uploadMaterial = [
    upload.single('file'),
    async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded.' });
            }

            const moduleId = parsePositiveInt(req.body.module_id, 'module_id');
            const [moduleRows] = await pool.query(
                'SELECT id FROM modules WHERE id = ? AND responsable_teacher_id = ? LIMIT 1',
                [moduleId, req.userId]
            );
            if (moduleRows.length === 0) {
                return res.status(403).json({ message: 'You are not authorized to upload material for this module.' });
            }
            const title = req.body.title
                ? sanitizeString(req.body.title, { min: 2, max: 255, fieldName: 'title' })
                : req.file.originalname;
            const fileType = getUploadedFileType(req.file);
            const filePath = req.file.path;
            let mindmapProviderConfigId = null;

            if (req.body.mindmap_provider_config_id) {
                mindmapProviderConfigId = parsePositiveInt(req.body.mindmap_provider_config_id, 'mindmap_provider_config_id');
                const provider = await getProviderById(mindmapProviderConfigId, { serviceType: 'llm', activeOnly: true });
                if (!provider) {
                    return res.status(400).json({ message: 'Selected mindmap LLM is not available.' });
                }
            }

            const material = await Material.create({
                teacherId: req.userId,
                moduleId,
                title,
                filename: req.file.originalname,
                fileType,
                storagePath: filePath,
                mindmapProviderConfigId,
                status: 'uploading',
                statusMessage: 'Upload complete. Waiting to parse document.',
            });

            // Parse asynchronously
            parseMaterial(material._id.toString(), filePath, fileType)
                .catch(err => console.error('[Parser] Error:', err.message));

            res.status(201).json({
                message: 'Material uploaded. Parsing in progress.',
                materialId: material._id
            });
        } catch (err) {
            console.error('Upload error:', err);
            next(err instanceof AppError ? err : new AppError(500, err.message || 'Upload failed.'));
        }
    }
];

// GET /teacher/materials
const getMaterials = async (req, res) => {
    try {
        const filters = {};
        if (req.query.moduleId) {
            filters.moduleId = parsePositiveInt(req.query.moduleId, 'moduleId');
            filters.$or = [
                { teacherId: req.userId },
                { visibility: 'module', moduleId: filters.moduleId },
            ];
        } else {
            filters.teacherId = req.userId;
        }

        const materials = await Material.find(filters)
            .select('-parsedText')
            .sort({ uploadDate: -1 });
        const materialIds = materials.map((material) => material._id);
        const mindmaps = await MaterialMindmap.find({ materialId: { $in: materialIds } }).lean();
        const mindmapByMaterialId = new Map(mindmaps.map((mindmap) => [String(mindmap.materialId), mindmap]));

        res.json(materials.map((material) => ({
            ...material.toObject(),
            mindmap: mindmapByMaterialId.get(String(material._id)) || null,
        })));
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch materials.' });
    }
};

// GET /teacher/materials/:id
const getMaterial = async (req, res) => {
    try {
        const material = await Material.findOne({
            _id: req.params.id,
            $or: [
                { teacherId: req.userId },
                { visibility: 'module' }
            ]
        });
        if (!material) return res.status(404).json({ message: 'Material not found.' });
        const mindmap = await MaterialMindmap.findOne({ materialId: material._id }).lean();
        res.json({ ...material.toObject(), mindmap });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch material.' });
    }
};

// DELETE /teacher/materials/:id
const deleteMaterial = async (req, res, next) => {
    try {
        await deleteMaterialForTeacher(req.params.id, req.userId);
        res.json({ message: 'Material deleted successfully.' });
    } catch (err) {
        next(err instanceof AppError ? err : new AppError(500, err.message || 'Failed to delete material.'));
    }
};

// POST /teacher/materials/:id/retry
const retryMaterial = async (req, res, next) => {
    try {
        const material = await retryMaterialProcessingForTeacher(req.params.id, req.userId);
        let mindmapProviderConfigId = material.mindmapProviderConfigId || null;

        if (req.body?.mindmap_provider_config_id) {
            mindmapProviderConfigId = parsePositiveInt(req.body.mindmap_provider_config_id, 'mindmap_provider_config_id');
            const provider = await getProviderById(mindmapProviderConfigId, { serviceType: 'llm', activeOnly: true });
            if (!provider) {
                throw new AppError(400, 'Selected mindmap LLM is not available.');
            }
            await Material.findByIdAndUpdate(material._id, { mindmapProviderConfigId });
        }

        parseMaterial(material._id.toString(), material.storagePath, material.fileType)
            .catch((error) => console.error('[Parser] Retry error:', error.message));

        res.status(202).json({
            message: 'Material retry started.',
            materialId: material._id,
        });
    } catch (err) {
        next(err instanceof AppError ? err : new AppError(500, err.message || 'Failed to retry material processing.'));
    }
};

module.exports = { uploadMaterial, getMaterials, getMaterial, deleteMaterial, retryMaterial };
