const config = require('../config/system.config');

// TODO: Replace mock with real implementation (@xenova/transformers or OpenAI)

class EmbeddingService {
    constructor() {
        this.modelName = config.embedding.model || "mock-model";
        console.log(`[EmbeddingService Mock] Initialized with model: ${this.modelName}`);
    }

    /**
     * Lazy-loads the model only when it is actually needed. (MOCKED)
     */
    async getPipeline() {
        return async (inputs) => {
            // Mock pipeline that returns an object with a .tolist() method 
            return {
                tolist: () => {
                    // For each input, return a dummy vector (array of numbers)
                    return inputs.map(() => 
                        // Generate a dummy vector of 384 dimensions (standard for all-MiniLM-L6-v2)
                        Array.from({ length: 384 }, () => Math.random() * 2 - 1)
                    );
                }
            };
        };
    }

    /**
     * Generate embeddings for an array of strings in batches. (MOCKED)
     */
    async generateEmbeddings(texts) {
        if (!texts || texts.length === 0) return [];

        console.log(`[EmbeddingService Mock] Generating embeddings for ${texts.length} texts`);
        
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 300));

        const embedder = await this.getPipeline();
        const batchSize = config.embedding.batchSize || 32;
        const vectors = [];

        // Process in batches
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const output = await embedder(batch);
            
            // Output is mocked to have tolist()
            const batchVectors = output.tolist();
            vectors.push(...batchVectors);
        }

        return vectors;
    }
}

// Export as a singleton
module.exports = new EmbeddingService();
