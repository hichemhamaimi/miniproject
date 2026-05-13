const fs = require('fs');
const path = require('path');
const officeParser = require('officeparser');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const config = require('../config/system.config');
const Material = require('../models/Material');

const PARSER_LOG_PREFIX = '[MaterialParser]';
const PPTX_PARSER_CONFIG = {
    ignoreNotes: false,
    putNotesAtLast: false,
    newlineDelimiter: '\n',
    outputErrorToConsole: false,
};

/**
 * Approximate token count (1 token ~= 4 chars)
 */
const estimateTokens = (text) => Math.ceil(text.length / 4);

/**
 * Split text into overlapping chunks respecting config token limits.
 */
const splitFixedChunks = (text) => {
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
                tokenCount: estimateTokens(chunkText),
            });
            id += 1;
        }

        if (end === text.length) break;
        start = end - overlapChars;
    }

    return chunks.map((chunk) => ({ ...chunk, strategy: 'fixed_size' }));
};

const splitSemanticChunks = (text) => {
    const paragraphs = text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

    const perChunk = config.materialProcessing.semanticParagraphsPerChunk || 3;
    const overlapCount = 1;
    const chunks = [];
    let id = 1;

    for (let i = 0; i < paragraphs.length; i += Math.max(1, perChunk - overlapCount)) {
        const slice = paragraphs.slice(i, i + perChunk);
        if (slice.length === 0) continue;
        const chunkText = slice.join('\n\n');
        chunks.push({
            id,
            text: chunkText,
            tokenCount: estimateTokens(chunkText),
            strategy: 'semantic',
        });
        id += 1;
    }

    return chunks;
};

const splitIntoChunks = (text, strategy = config.materialProcessing.chunkingStrategy) => {
    if (!text || !text.trim()) return [];
    if (strategy === 'fixed_size') return splitFixedChunks(text);
    if (strategy === 'semantic') return splitSemanticChunks(text);

    const semanticChunks = splitSemanticChunks(text);
    if (semanticChunks.length > 0) return semanticChunks;
    return splitFixedChunks(text);
};

const normalizeLine = (value) => value
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2000-\u200d\u2060\ufeff]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

/**
 * Clean extracted text: normalize whitespace, keep slide/list structure, and remove noisy blank lines.
 */
const cleanText = (raw) => {
    if (!raw || typeof raw !== 'string') return '';

    const lines = raw
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[^\x09\x0A\x20-\x7E\u00A0-\uFFFF]/g, '')
        .split('\n')
        .map((line) => normalizeLine(line));

    const compacted = [];
    let previousLine = '';
    let previousWasBlank = false;

    lines.forEach((line) => {
        if (!line) {
            if (!previousWasBlank && compacted.length > 0) {
                compacted.push('');
            }
            previousLine = '';
            previousWasBlank = true;
            return;
        }

        if (line !== previousLine) {
            compacted.push(line);
            previousLine = line;
        }
        previousWasBlank = false;
    });

    return compacted.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const flattenNodeText = (node) => {
    if (!node) return '';
    if (typeof node.text === 'string' && node.text.trim()) {
        return node.text.trim();
    }
    if (!Array.isArray(node.children) || node.children.length === 0) {
        return '';
    }
    return node.children.map((child) => flattenNodeText(child)).filter(Boolean).join(' ').trim();
};

const renderPptxNode = (node, lines, depth = 0) => {
    if (!node) return;

    if (node.type === 'slide') {
        const slideNumber = node.metadata?.slideNumber || lines.filter((line) => /^Slide \d+/.test(line)).length + 1;
        lines.push(`Slide ${slideNumber}`);
        (node.children || []).forEach((child) => renderPptxNode(child, lines, depth + 1));
        lines.push('');
        return;
    }

    if (node.type === 'note') {
        const noteText = flattenNodeText(node);
        if (noteText) {
            lines.push(`Speaker Notes: ${noteText}`);
        }
        return;
    }

    if (node.type === 'list') {
        const listText = flattenNodeText(node);
        if (listText) {
            lines.push(`${'  '.repeat(Math.max(0, depth - 1))}- ${listText}`);
        }
        return;
    }

    if (node.type === 'table') {
        const rowLines = (node.children || [])
            .map((rowNode) => (rowNode.children || [])
                .map((cellNode) => flattenNodeText(cellNode))
                .filter(Boolean)
                .join(' | '))
            .filter(Boolean);
        lines.push(...rowLines);
        return;
    }

    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'text') {
        const text = flattenNodeText(node);
        if (text) lines.push(text);
        return;
    }

    (node.children || []).forEach((child) => renderPptxNode(child, lines, depth + 1));
};

const getParagraphLinesFromXml = (xmlDocument) => {
    const paragraphNodes = xmlDocument.getElementsByTagName('a:p');

    return Array.from(paragraphNodes)
        .map((paragraphNode) => {
            const textNodes = paragraphNode.getElementsByTagName('a:t');
            const text = Array.from(textNodes)
                .map((node) => normalizeLine(node.textContent || ''))
                .filter(Boolean)
                .join(' ');

            if (!text) return '';

            const paragraphProperties = Array.from(paragraphNode.childNodes || [])
                .find((node) => node.nodeType === 1 && node.localName === 'pPr');
            const level = Number.parseInt(paragraphProperties?.getAttribute?.('lvl') || '0', 10);
            const hasBullet = Boolean(paragraphProperties)
                && Array.from(paragraphProperties.childNodes || []).some((node) => node.nodeType === 1 && /^bu/i.test(node.localName || node.nodeName || ''));

            const prefix = hasBullet ? `${'  '.repeat(Number.isFinite(level) ? level : 0)}- ` : '';
            return `${prefix}${text}`.trim();
        })
        .filter(Boolean);
};

const sortPptxEntryPaths = (entryPaths) => [...entryPaths].sort((left, right) => {
    const leftIndex = Number.parseInt(left.match(/(\d+)(?=\.xml$)/)?.[1] || '0', 10);
    const rightIndex = Number.parseInt(right.match(/(\d+)(?=\.xml$)/)?.[1] || '0', 10);
    return leftIndex - rightIndex;
});

const normalizeRelationshipTarget = (basePath, target) => {
    const baseDirectory = path.posix.dirname(basePath);
    return path.posix.normalize(path.posix.join(baseDirectory, target));
};

const extractPptxTextFromZip = async (filePath) => {
    const zipBuffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(zipBuffer);
    const parser = new DOMParser();
    const slidePaths = sortPptxEntryPaths(
        Object.keys(zip.files).filter((entryPath) => /^ppt\/slides\/slide\d+\.xml$/i.test(entryPath))
    );

    if (slidePaths.length === 0) {
        throw new Error('The PPTX archive did not contain any slide XML files.');
    }

    const lines = [];

    for (const slidePath of slidePaths) {
        const slideXml = await zip.file(slidePath)?.async('string');
        if (!slideXml) continue;

        const slideDocument = parser.parseFromString(slideXml, 'text/xml');
        const slideNumber = Number.parseInt(slidePath.match(/slide(\d+)\.xml$/i)?.[1] || '0', 10) || (lines.filter((line) => /^Slide \d+$/i.test(line)).length + 1);
        lines.push(`Slide ${slideNumber}`);

        const slideLines = getParagraphLinesFromXml(slideDocument);
        if (slideLines.length > 0) {
            lines.push(...slideLines);
        }

        const relationshipPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/').replace('.xml', '.xml.rels');
        const relationshipXml = await zip.file(relationshipPath)?.async('string');

        if (relationshipXml) {
            const relationshipDocument = parser.parseFromString(relationshipXml, 'text/xml');
            const noteRelationship = Array.from(relationshipDocument.getElementsByTagName('Relationship')).find((relationshipNode) => {
                const relationshipType = relationshipNode.getAttribute('Type') || '';
                return /notesSlide$/i.test(relationshipType);
            });

            if (noteRelationship) {
                const target = noteRelationship.getAttribute('Target') || '';
                const notesPath = normalizeRelationshipTarget(relationshipPath, target);
                const notesXml = await zip.file(notesPath)?.async('string');

                if (notesXml) {
                    const notesDocument = parser.parseFromString(notesXml, 'text/xml');
                    const notesLines = getParagraphLinesFromXml(notesDocument)
                        .filter((line) => !/^slide\s+\d+$/i.test(line));

                    if (notesLines.length > 0) {
                        lines.push(`Speaker Notes: ${notesLines.join(' ')}`);
                    }
                }
            }
        }

        lines.push('');
    }

    return cleanText(lines.join('\n'));
};

const extractPptxText = async (filePath) => {
    try {
        const ast = await officeParser.parseOffice(filePath, PPTX_PARSER_CONFIG);
        const lines = [];
        (ast.content || []).forEach((node) => renderPptxNode(node, lines));

        const structuredText = cleanText(lines.join('\n'));
        if (structuredText) {
            return structuredText;
        }

        const fallbackText = typeof ast.toText === 'function' ? cleanText(ast.toText()) : '';
        if (fallbackText) {
            return fallbackText;
        }
    } catch (error) {
        console.warn(`${PARSER_LOG_PREFIX} officeparser PPTX extraction failed for ${path.basename(filePath)}: ${error.message}`);
    }

    const zipFallbackText = await extractPptxTextFromZip(filePath);
    if (zipFallbackText) {
        return zipFallbackText;
    }

    throw new Error('No extractable text was found in the PPTX file.');
};

/**
 * Extract text from a file based on its type.
 */
const extractText = async (filePath, fileType) => {
    const ext = String(fileType || '').toLowerCase();
    console.log(`${PARSER_LOG_PREFIX} Extracting text from ${path.basename(filePath)} as ${ext}`);

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
        return extractPptxText(filePath);
    }

    throw new Error(`Unsupported file type: ${ext}`);
};

/**
 * Main parse function - extracts, cleans, chunks, saves to DB.
 * @param {string} materialId - MongoDB ObjectId string
 * @param {string} filePath - Absolute path to uploaded file
 * @param {string} fileType - 'pdf' | 'docx' | 'pptx' | 'txt' | 'md'
 */
const parseMaterial = async (materialId, filePath, fileType) => {
    const material = await Material.findById(materialId);
    if (!material) throw new Error(`Material ${materialId} not found`);

    try {
        await Material.findByIdAndUpdate(materialId, {
            status: 'parsing',
            statusMessage: 'Extracting text from document.',
            errorMessage: '',
        });

        const rawText = await extractText(filePath, fileType);
        const cleaned = cleanText(rawText);

        if (!cleaned) {
            throw new Error(`The ${String(fileType).toUpperCase()} file did not contain any extractable text.`);
        }

        console.log(`${PARSER_LOG_PREFIX} Extracted ${cleaned.length} characters from material ${materialId}`);

        await Material.findByIdAndUpdate(materialId, {
            parsedText: cleaned,
            status: 'embedding',
            statusMessage: 'Chunking material and generating embeddings.',
        });

        const { enqueueMaterialProcessing } = require('./queueService');
        await enqueueMaterialProcessing(materialId);
    } catch (error) {
        console.error(`${PARSER_LOG_PREFIX} Failed to parse material ${materialId}:`, error);
        await Material.findByIdAndUpdate(materialId, {
            status: 'failed',
            statusMessage: 'Material parsing failed.',
            errorMessage: error.message,
        });
        throw error;
    }
};

module.exports = { parseMaterial, splitIntoChunks, estimateTokens, cleanText };
