const { QdrantClient } = require('@qdrant/js-client-rest');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/system.config');
require('dotenv').config();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientQdrantError = (error) => {
    const code = error?.code || error?.cause?.code;
    return ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'UND_ERR_SOCKET'].includes(code)
        || error?.message === 'fetch failed';
};

class VectorService {
    constructor() {
        this.collectionName = config.vectorDB.collection || "materials";
        this.initialized = false;
        this.initializationPromise = null;
        
        const host = process.env.QDRANT_HOST || config.vectorDB.host || 'http://localhost:6333';
        console.log(`[VectorService] Connecting to Qdrant at ${host}`);
        
        this.client = new QdrantClient({ url: host });
        this.vectorSize = Number(
            process.env.EMBEDDING_VECTOR_SIZE
            || config.embedding.vectorSize
            || (process.env.EMBEDDING_PROVIDER === 'transformers' ? 384 : 768)
        );
    }

    /**
     * Ensure the collection exists in Qdrant.
     */
    async ensureCollectionExists() {
        if (this.initialized) return;

        if (!this.initializationPromise) {
            this.initializationPromise = this.initializeCollection().finally(() => {
                this.initializationPromise = null;
            });
        }

        await this.initializationPromise;
    }

    async initializeCollection() {
        try {
            await this.withQdrantRetry(async () => {
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
                } else {
                    const collection = await this.client.getCollection(this.collectionName);
                    const configuredSize = collection?.config?.params?.vectors?.size;
                    if (typeof configuredSize === 'number' && configuredSize !== this.vectorSize) {
                        console.warn(`[VectorService] Using existing collection vector size ${configuredSize} instead of configured size ${this.vectorSize}.`);
                        this.vectorSize = configuredSize;
                    }
                }
            }, 'ensure collection');
            
            this.initialized = true;
        } catch (error) {
             console.error("[VectorService] Error ensuring collection exists:", error);
             throw error;
        }
    }

    async withQdrantRetry(operation, label) {
        const attempts = Number(process.env.QDRANT_RETRY_ATTEMPTS || 3);
        const retryDelayMs = Number(process.env.QDRANT_RETRY_DELAY_MS || 1000);

        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                return await operation();
            } catch (error) {
                if (!isTransientQdrantError(error) || attempt === attempts) {
                    throw error;
                }

                console.warn(
                    `[VectorService] Transient Qdrant error during ${label}; retrying ${attempt}/${attempts}.`,
                );
                await sleep(retryDelayMs * attempt);
            }
        }
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

    getVectorSize() {
        return this.vectorSize;
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
            vector: this.normalizeVector(c.vector),
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
                vector: this.normalizeVector(queryVector),
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
              throw error;
         }
    }
}

module.exports = new VectorService();
