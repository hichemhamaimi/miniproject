const embeddingService = require('./embeddingService');
const vectorService = require('./vectorService');

class RetrievalService {
    /**
     * Convert the text query into an embedding, then find the top K most similar chunks.
     */
    async retrieveRelevantChunks(query, topK = 5) {
        if (!query || typeof query !== 'string' || query.trim() === '') {
            return [];
        }

        try {
            console.log(`[RetrievalService] Embedding query: "${query.substring(0, 50)}..."`);
            // Generate single embedding for the query
            const vectors = await embeddingService.generateEmbeddings([query]);
            if (!vectors || vectors.length === 0) {
                return [];
            }

            const queryVector = vectors[0];

            console.log(`[RetrievalService] Searching top ${topK} matches from vector DB`);
            const results = await vectorService.searchVectors(queryVector, topK);

            // Just return the text from the payload
            return results.map(r => r.text);
        } catch (error) {
            console.error('[RetrievalService] Error retrieving chunks:', error.message);
            // Return empty list on failure, or throw depending on how strict you want to be
            return [];
        }
    }
}

module.exports = new RetrievalService();
