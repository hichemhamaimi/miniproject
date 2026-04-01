const { v4: uuidv4 } = require('uuid');

// TODO: Replace mock with real implementation (Qdrant)

class VectorService {
    constructor() {
        this.collectionName = "mock-collection";
        this.initialized = false;
        
        // In-memory mock store
        this.store = [];
        console.log(`[VectorService Mock] Initialized in-memory store`);
    }

    /**
     * Ensure the collection exists. (MOCKED)
     */
    async ensureCollectionExists() {
        if (this.initialized) return;
        console.log(`[VectorService Mock] Ensuring collection exists: ${this.collectionName}`);
        this.initialized = true;
    }

    /**
     * Insert chunks into Vector DB. (MOCKED)
     * `chunksData` should be an array of objects: { vector: [], payload: { text, materialId, chunkId } }
     */
    async insertChunks(chunksData) {
        await this.ensureCollectionExists();

        if (!chunksData || chunksData.length === 0) return;

        const points = chunksData.map(c => ({
            id: uuidv4(),
            vector: c.vector,
            payload: c.payload
        }));

        // Simply push to our in-memory array
        this.store.push(...points);
        
        console.log(`[VectorService Mock] Inserted ${points.length} vectors into memory. Total items: ${this.store.length}`);
    }

    /**
     * Search the Vector DB for the nearest chunks. (MOCKED)
     * Returns the array of matching chunks.
     */
    async searchVectors(queryVector, topK = 5) {
        await this.ensureCollectionExists();

        console.log(`[VectorService Mock] Searching for vectors, returning mock matches (max ${topK})`);
        
        // Simulate real vector DB search delay
        await new Promise(resolve => setTimeout(resolve, 200));

        // Just return the first topK items we have as a mock, assigning random/fixed mock scores
        const results = this.store.slice(0, topK);

        // Map to expected response
        return results.map(r => ({
            score: Math.random() * (0.99 - 0.70) + 0.70, // Random score between 0.70 and 0.99
            ...r.payload
        }));
    }

    /**
     * Retrieve chunks for a specific material without vector similarity. (MOCKED)
     */
    async getChunksByMaterialId(materialId, limit = 8) {
        await this.ensureCollectionExists();

        console.log(`[VectorService Mock] Getting chunks for materialId: ${materialId}`);

        // Filter our in-memory array
        const results = this.store.filter(p => p.payload.materialId === materialId.toString());
        
        return results.slice(0, limit).map(p => ({
            id: p.id,
            ...p.payload
        }));
    }
}

module.exports = new VectorService();
