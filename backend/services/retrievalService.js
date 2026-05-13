const embeddingService = require('./embeddingService');
const vectorService = require('./vectorService');
const config = require('../config/system.config');

const cache = new Map();

const lexicalScore = (query, text) => {
    const tokens = query.toLowerCase().split(/\W+/).filter(Boolean);
    if (tokens.length === 0) return 0;
    const haystack = text.toLowerCase();
    const matches = tokens.filter((token) => haystack.includes(token)).length;
    return matches / tokens.length;
};

class RetrievalService {
    /**
     * Convert the text query into an embedding, then find the top K most similar chunks.
     */
    async retrieveRelevantChunks(query, options = {}) {
        const topK = typeof options === 'number' ? options : (options.topK || 5);
        if (!query || typeof query !== 'string' || query.trim() === '') {
            return [];
        }

        try {
            await vectorService.ensureCollectionExists();
            embeddingService.setVectorSize(vectorService.getVectorSize());

            const normalized = query.trim().toLowerCase();
            const cached = cache.get(normalized);
            if (cached && cached.expiresAt > Date.now()) {
                return cached.value.slice(0, topK);
            }

            console.log(`[RetrievalService] Embedding query: "${query.substring(0, 50)}..."`);
            // Generate single embedding for the query
            const vectors = await embeddingService.generateEmbeddings([query]);
            if (!vectors || vectors.length === 0) {
                return [];
            }

            const queryVector = vectors[0];

            console.log(`[RetrievalService] Searching top ${topK} matches from vector DB`);
            const rerankWindow = Math.max(topK, config.retrieval.rerankWindow || 20);
            const filter = options.materialIds?.length
                ? {
                    should: options.materialIds.map((materialId) => ({
                        key: 'materialId',
                        match: { value: materialId },
                    })),
                }
                : null;
            const results = await vectorService.searchVectors(queryVector, rerankWindow, filter);

            const reranked = results
                .map((result) => ({
                    ...result,
                    hybridScore: (result.score || 0) + (lexicalScore(query, result.text || '') * 0.2),
                }))
                .sort((a, b) => b.hybridScore - a.hybridScore)
                .slice(0, topK);

            // Just return the text from the payload
            const value = reranked.map(r => r.text);
            cache.set(normalized, {
                value,
                expiresAt: Date.now() + (config.retrieval.cacheTtlMs || 300000),
            });
            return value;
        } catch (error) {
            console.error('[RetrievalService] Error retrieving chunks:', error.message);
            // Return empty list on failure, or throw depending on how strict you want to be
            return [];
        }
    }

    clearCache() {
        cache.clear();
    }
}

module.exports = new RetrievalService();
