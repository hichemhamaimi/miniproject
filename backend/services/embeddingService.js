const config = require('../config/system.config');
const devLogger = require('../utils/devLogger');
const { resolveEmbeddingProviderConfig } = require('./aiProviderService');
require('dotenv').config();

const DEFAULT_LOCAL_MODEL = process.env.LOCAL_EMBEDDING_MODEL || config.embedding.model || 'Xenova/all-MiniLM-L6-v2';

class EmbeddingService {
    constructor() {
        this.vectorSize = Number(process.env.EMBEDDING_VECTOR_SIZE || config.embedding.vectorSize || 384);
        this.pipelinePromise = null;
        this.pipelineModelName = null;
        console.log('[EmbeddingService] Initialized.');
    }

    setVectorSize(size) {
        const parsed = Number(size);
        if (Number.isFinite(parsed) && parsed > 0 && this.vectorSize !== parsed) {
            console.log(`[EmbeddingService] Syncing vector size from ${this.vectorSize} to ${parsed}`);
            this.vectorSize = parsed;
        }
    }

    async getTransformersPipeline(modelName) {
        if (!this.pipelinePromise || this.pipelineModelName !== modelName) {
            this.pipelinePromise = (async () => {
                const { pipeline } = await import('@xenova/transformers');
                console.log(`[EmbeddingService] Loading local embedding model: ${modelName}`);
                this.pipelineModelName = modelName;
                return pipeline('feature-extraction', modelName);
            })();
        }
        return this.pipelinePromise;
    }

    normalizeVector(values = []) {
        if (!Array.isArray(values) || values.length === 0) {
            return [];
        }

        if (!this.vectorSize) {
            return values;
        }

        if (values.length === this.vectorSize) {
            return values;
        }

        if (values.length > this.vectorSize) {
            return values.slice(0, this.vectorSize);
        }

        return [...values, ...Array.from({ length: this.vectorSize - values.length }, () => 0)];
    }

    async generateTransformerEmbeddings(texts, providerConfig) {
        const embedder = await this.getTransformersPipeline(providerConfig.modelName || DEFAULT_LOCAL_MODEL);
        const batchSize = config.embedding.batchSize || 16;
        const vectors = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const output = await embedder(batch, { pooling: 'mean', normalize: true });
            vectors.push(...output.tolist().map((vector) => this.normalizeVector(vector)));
        }

        return vectors;
    }

    async generateExternalEmbeddings(texts, providerConfig) {
        const provider = providerConfig.provider;
        const modelName = providerConfig.modelName;
        const apiKey = providerConfig.apiKey;
        const baseUrl = providerConfig.baseUrl;

        if (!apiKey) {
            throw new Error(`${provider.toUpperCase()} API key is not configured for embeddings.`);
        }
        if (!modelName) {
            throw new Error(`No external embedding model configured for provider "${provider}".`);
        }

        const response = await fetch(`${baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelName,
                input: texts,
                encoding_format: 'float',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            devLogger.log('EMBEDDING', 'Embedding provider returned an error response', {
                provider,
                modelName,
                responseStatus: response.status,
                errorText,
            });
            throw new Error(`${provider} embeddings API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const embeddings = Array.isArray(data?.data) ? data.data : [];

        if (embeddings.length !== texts.length) {
            throw new Error(`Expected ${texts.length} embeddings, received ${embeddings.length}.`);
        }

        return embeddings
            .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
            .map((item) => this.normalizeVector(item.embedding || []));
    }

    async generateEmbeddings(texts) {
        if (!Array.isArray(texts) || texts.length === 0) {
            return [];
        }

        const providerConfig = await resolveEmbeddingProviderConfig();
        console.log(`[EmbeddingService] Generating embeddings for ${texts.length} texts via ${providerConfig.provider}`);
        devLogger.log('EMBEDDING', 'Generating embeddings', {
            provider: providerConfig.provider,
            label: providerConfig.label,
            modelName: providerConfig.modelName,
            baseUrl: providerConfig.baseUrl,
            textCount: texts.length,
        });

        if (providerConfig.provider === 'transformers') {
            return this.generateTransformerEmbeddings(texts, providerConfig);
        }

        if (providerConfig.provider === 'openai' || providerConfig.provider === 'groq') {
            return this.generateExternalEmbeddings(texts, providerConfig);
        }

        throw new Error(`Unsupported embedding provider: ${providerConfig.provider}`);
    }
}

module.exports = new EmbeddingService();
