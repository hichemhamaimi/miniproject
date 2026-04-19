const config = require('../config/system.config');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

class EmbeddingService {
    constructor() {
        this.provider = process.env.EMBEDDING_PROVIDER || 'gemini';
        console.log(`[EmbeddingService] Initialized with provider: ${this.provider}`);

        if (this.provider === 'gemini') {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("GEMINI_API_KEY is not set for embeddings");
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.modelName = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
        } else if (this.provider === 'transformers') {
            this.modelName = config.embedding.model || "Xenova/all-MiniLM-L6-v2";
            this.pipelinePromise = null;
        } else {
             console.warn(`[EmbeddingService] Unsupported provider ${this.provider}, falling back to mock.`);
        }
    }

    /**
     * Lazy-loads the HuggingFace transformers pipeline only when it is actually needed.
     */
    async getTransformersPipeline() {
        if (!this.pipelinePromise) {
            this.pipelinePromise = (async () => {
                const { pipeline } = await import('@xenova/transformers');
                console.log(`[EmbeddingService] Loading transformer model: ${this.modelName}`);
                return await pipeline('feature-extraction', this.modelName);
            })();
        }
        return this.pipelinePromise;
    }

    /**
     * Generate embeddings for an array of strings in batches.
     */
    async generateEmbeddings(texts) {
        if (!texts || texts.length === 0) return [];

        console.log(`[EmbeddingService] Generating embeddings for ${texts.length} texts via ${this.provider}`);

        if (this.provider === 'gemini') {
            const model = this.genAI.getGenerativeModel({ model: this.modelName });
            
            // Generate embeddings in batches to respect rate limits
            const batchSize = config.embedding.batchSize || 16;
            const vectors = [];

            for (let i = 0; i < texts.length; i += batchSize) {
                const batch = texts.slice(i, i + batchSize);
                
                // Gemini currently supports batch embedding via `embedContent` for individual or arrays
                // We'll process promises concurrently for the batch
                const embedPromises = batch.map(text => model.embedContent(text));
                
                try {
                     const results = await Promise.all(embedPromises);
                     const batchVectors = results.map(r => r.embedding.values);
                     vectors.push(...batchVectors);
                } catch(error) {
                     console.error(`[EmbeddingService] Gemini Embedding Error:`, error);
                     throw error;
                }
            }
            return vectors;
            
        } else if (this.provider === 'transformers') {
            const embedder = await this.getTransformersPipeline();
            const batchSize = config.embedding.batchSize || 16;
            const vectors = [];

            // Process in batches
            for (let i = 0; i < texts.length; i += batchSize) {
                const batch = texts.slice(i, i + batchSize);
                const output = await embedder(batch, { pooling: 'mean', normalize: true });
                
                const batchVectors = output.tolist();
                vectors.push(...batchVectors);
            }

            return vectors;
        } else {
            // Mock fallback
             const vectors = texts.map(() => Array.from({ length: 384 }, () => Math.random() * 2 - 1));
             return vectors;
        }
    }
}

// Export as a singleton
module.exports = new EmbeddingService();
