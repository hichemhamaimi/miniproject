const fs = require('fs');
const path = require('path');
const config = require('../config/system.config');
const Material = require('../models/Material');

/**
 * Approximate token count (1 token ≈ 4 chars)
 */
const estimateTokens = (text) => Math.ceil(text.length / 4);

/**
 * Split text into overlapping chunks respecting config token limits.
 */
const splitIntoChunks = (text) => {
    const { chunkSizeTokens, chunkOverlapTokens } = config.materialProcessing;
    const chunkSizeChars = chunkSizeTokens * 4;
    const overlapChars = chunkOverlapTokens * 4;

    const chunks = [];
    let start = 0;
    let id = 1;

    while (start < text.length) {
        const end = Math.min(start + chunkSizeChars, text.length);
        const chunkText = text.slice(start, end).trim();

        if (chunkText.length > 0) {
            chunks.push({
                id,
                text: chunkText,
                tokenCount: estimateTokens(chunkText)
            });
            id++;
        }

        if (end === text.length) break;
        start = end - overlapChars;
    }

    return chunks;
};

/**
 * Clean extracted text: normalize whitespace, remove control chars.
 */
const cleanText = (raw) => {
    return raw
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[^\x09\x0A\x20-\x7E\u00A0-\uFFFF]/g, '')
        .trim();
};

/**
 * Extract text from a file based on its type.
 */
const extractText = async (filePath, fileType) => {
    const ext = fileType.toLowerCase();

    if (ext === 'txt' || ext === 'md') {
        return fs.readFileSync(filePath, 'utf-8');
    }

    if (ext === 'pdf') {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    }

    if (ext === 'docx') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }

    if (ext === 'pptx') {
        const officeParser = require('officeparser');
        return new Promise((resolve, reject) => {
            officeParser.parseOffice(filePath, (data, err) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    throw new Error(`Unsupported file type: ${ext}`);
};

/**
 * Main parse function — extracts, cleans, chunks, saves to DB.
 * @param {string} materialId - MongoDB ObjectId string
 * @param {string} filePath - Absolute path to uploaded file
 * @param {string} fileType - 'pdf' | 'docx' | 'pptx' | 'txt' | 'md'
 */
const parseMaterial = async (materialId, filePath, fileType) => {
    const material = await Material.findById(materialId);
    if (!material) throw new Error(`Material ${materialId} not found`);

    try {
        await Material.findByIdAndUpdate(materialId, { status: 'parsing' });

        const rawText = await extractText(filePath, fileType);
        const cleaned = cleanText(rawText);
        const chunks = splitIntoChunks(cleaned);

        await Material.findByIdAndUpdate(materialId, {
            parsedText: cleaned,
            chunks,
            status: 'ready'
        });
    } catch (err) {
        await Material.findByIdAndUpdate(materialId, {
            status: 'error',
            errorMessage: err.message
        });
        throw err;
    }
};

module.exports = { parseMaterial, splitIntoChunks, estimateTokens };
