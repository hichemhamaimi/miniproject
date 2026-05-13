const mongoose = require('mongoose');

const correctionDocumentSchema = new mongoose.Schema({
    examResultId: {
        type: Number,
        required: true,
        unique: true,
        index: true,
    },
    examId: {
        type: Number,
        required: true,
        index: true,
    },
    studentId: {
        type: Number,
        required: true,
        index: true,
    },
    fileName: {
        type: String,
        required: true,
        default: '',
    },
    fileType: {
        type: String,
        required: true,
        default: 'application/json',
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    html: {
        type: String,
        default: '',
    },
}, { timestamps: true });

module.exports = mongoose.model('CorrectionDocument', correctionDocumentSchema);
