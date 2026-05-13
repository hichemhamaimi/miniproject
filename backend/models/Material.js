const mongoose = require('mongoose');
const { Schema } = mongoose;
const config = require('../config/system.config');

const materialSchema = new Schema({
    teacherId: { type: Number, required: true, index: true },
    moduleId: { type: Number, required: true, index: true },
    title: { type: String, required: true },
    filename: { type: String, required: true },
    fileType: {
        type: String,
        enum: config.materialProcessing.supportedFileTypes,
        required: true
    },
    uploadDate: { type: Date, default: Date.now },
    parsedText: { type: String, default: '' },
    status: {
        type: String,
        enum: ['uploading', 'parsing', 'embedding', 'generating_mindmap', 'ready', 'failed', 'error'],
        default: 'uploading'
    },
    visibility: {
        type: String,
        enum: ['private', 'module'],
        default: 'module'
    },
    statusMessage: { type: String, default: 'Upload received.' },
    errorMessage: { type: String, default: '' },
    storagePath: { type: String, default: '' },
    mindmapProviderConfigId: { type: Number, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Material', materialSchema);
