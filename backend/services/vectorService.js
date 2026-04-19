const { QdrantClient } = require('@qdrant/js-client-rest');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/system.config');
require('dotenv').config();

class VectorService {
    constructor() {
        this.collectionName = config.vectorDB.collection || "materials";
        this.initialized = false;
        
        const host = process.env.QDRANT_HOST || config.vectorDB.host || 'http://localhost:6333';
        console.log(`[VectorService] Connecting to Qdrant at ${host}`);
        
        this.client = new QdrantClient({ url: host });
        // NOTE: If Gemini text-embedding-004 is used, the vector size is 768. 
        // If Xenova/all-MiniLM-L6-v2 is used, vector size is 384.
        // We will default to 768 since we changed to Gemini as the main provider.
        this.vectorSize = process.env.EMBEDDING_PROVIDER === 'transformers' ? 384 : 768; 
    }

    /**
     * Ensure the collection exists in Qdrant.
     */
    async ensureCollectionExists() {
        if (this.initialized) return;

        try {
            const collections = await this.client.getCollections();
            const exists = collections.collections.some(c => c.name === this.collectionName);

            if (!exists) {
                console.log(`[VectorService] Collection ${this.collectionName} does not exist. Creating...`);
                await this.client.createCollection(this.collectionName, {
                    vectors: {
                        size: this.vectorSize,
                        distance: 'Cosine'
                    }
                });
                console.log(`[VectorService] Collection ${this.collectionName} created. (Size: ${this.vectorSize})`);
            }
            
            this.initialized = true;
        } catch (error) {
             console.error("[VectorService] Error ensuring collection exists:", error);
             throw error;
        }
    }

    /**
     * Insert chunks into Vector DB.
     * `chunksData` should be an array of objects: { vector: [], payload: { text, materialId, chunkId, ... } }
     */
    async insertChunks(chunksData) {
        await this.ensureCollectionExists();

        if (!chunksData || chunksData.length === 0) return;

        const points = chunksData.map(c => ({
            id: uuidv4(),
            vector: c.vector,
            payload: c.payload
        }));

        console.log(`[VectorService] Upserting ${points.length} vectors to ${this.collectionName}...`);
        
        try {
             await this.client.upsert(this.collectionName, {
                 wait: true,
                 points: points
             });
             console.log(`[VectorService] Successfully inserted ${points.length} vectors.`);
        } catch (error) {
             console.error(`[VectorService] Error inserting chunks:`, error);
             throw error;
        }
    }

    /**
     * Search the Vector DB for the nearest chunks.
     * Returns the array of matching chunks.
     */
    async searchVectors(queryVector, topK = 5, filter = null) {
        await this.ensureCollectionExists();

        console.log(`[VectorService] Searching for top ${topK} vectors...`);

        try {
            const searchParams = {
                vector: queryVector,
                limit: topK,
                with_payload: true,
            };

            if (filter) {
                searchParams.filter = filter; 
                // Qdrant filter structure:
                // { must: [ { key: 'materialId', match: { value: 'some-id' } } ] }
            }

            const results = await this.client.search(this.collectionName, searchParams);
            
            return results.map(r => ({
                score: r.score,
                id: r.id,
                ...r.payload
            }));
            
        } catch (error) {
            console.error(`[VectorService] Error searching vectors:`, error);
            throw error;
        }
    }

    /**
     * Retrieve chunks for a specific material without vector similarity (useful for full doc context).
     */
    async getChunksByMaterialId(materialId, limit = 20) {
        await this.ensureCollectionExists();

        console.log(`[VectorService] Scrolling chunks for materialId: ${materialId}`);

        try {
            const results = await this.client.scroll(this.collectionName, {
                filter: {
                    must: [
                        {
                            key: "materialId",
                            match: { value: materialId.toString() }
                        }
                    ]
                },
                limit: limit,
                with_payload: true
            });

            return results.points.map(p => ({
                id: p.id,
                ...p.payload
            }));
            
        } catch (error) {
             console.error(`[VectorService] Error getting chunks by materialId:`, error);
             throw error;
        }
    }
    
    /**
     * Delete chunks by Material ID
     */
    async deleteChunksByMaterialId(materialId) {
         try {
              await this.ensureCollectionExists();
              await this.client.delete(this.collectionName, {
                   filter: {
                        must: [
                             {
                                  key: "materialId",
                                  match: { value: materialId.toString() }
                             }
                        ]
                   }
              });
              console.log(`[VectorService] Deleted chunks for materialId ${materialId}`);
         } catch(error) {
              console.error("[VectorService] Error deleting chunks:", error);
         }
    }
}

module.exports = new VectorService();
