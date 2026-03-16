const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const Material = require('../../models/Material');
const { parseMaterial } = require('../../services/materialParser');
const config = require('../../config/system.config');

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

// POST /teacher/materials/upload
const uploadMaterial = [
    upload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded.' });
            }

            const { title } = req.body;
            const fileType = path.extname(req.file.originalname).toLowerCase().replace('.', '');
            const filePath = req.file.path;

            const material = await Material.create({
                teacherId: req.userId,
                title: title || req.file.originalname,
                filename: req.file.originalname,
                fileType,
                storagePath: filePath,
                status: 'uploading'
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
            res.status(500).json({ message: err.message || 'Upload failed.' });
        }
    }
];

// GET /teacher/materials
const getMaterials = async (req, res) => {
    try {
        const materials = await Material.find({ teacherId: req.userId })
            .select('-parsedText -chunks')
            .sort({ uploadDate: -1 });
        res.json(materials);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch materials.' });
    }
};

// GET /teacher/materials/:id
const getMaterial = async (req, res) => {
    try {
        const material = await Material.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!material) return res.status(404).json({ message: 'Material not found.' });
        res.json(material);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch material.' });
    }
};

// DELETE /teacher/materials/:id
const deleteMaterial = async (req, res) => {
    try {
        const material = await Material.findOneAndDelete({ _id: req.params.id, teacherId: req.userId });
        if (!material) return res.status(404).json({ message: 'Material not found.' });

        // Remove file from disk
        if (material.storagePath && fs.existsSync(material.storagePath)) {
            fs.unlinkSync(material.storagePath);
        }

        res.json({ message: 'Material deleted.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete material.' });
    }
};

module.exports = { uploadMaterial, getMaterials, getMaterial, deleteMaterial };
