const mongoose = require('mongoose');
const { Schema } = mongoose;
const config = require('../config/system.config');

const chunkSchema = new Schema({
    id: { type: Number, required: true },
    text: { type: String, required: true },
    tokenCount: { type: Number, required: true }
}, { _id: false });

const materialSchema = new Schema({
    teacherId: { type: Number, required: true, index: true },
    title: { type: String, required: true },
    filename: { type: String, required: true },
    fileType: {
        type: String,
        enum: config.materialProcessing.supportedFileTypes,
        required: true
    },
    uploadDate: { type: Date, default: Date.now },
    parsedText: { type: String, default: '' },
    chunks: { type: [chunkSchema], default: [] },
    status: {
        type: String,
        enum: ['uploading', 'parsing', 'ready', 'error'],
        default: 'uploading'
    },
    errorMessage: { type: String, default: '' },
    storagePath: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Material', materialSchema);
