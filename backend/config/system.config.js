module.exports = {
    materialProcessing: {
        chunkSizeTokens: 800,
        chunkOverlapTokens: 100,
        maxMaterialSizeMB: 50,
        supportedFileTypes: ['pdf', 'docx', 'pptx', 'txt', 'md'],
    },

    llm: {
        provider: 'openai',          // 'openai' | 'anthropic' | 'ollama'
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 4000,
        retryAttempts: 3,
        retryDelayMs: 2000,
        mindmapModel: 'gpt-4o',
        mindmapMaxTokens: 2000,
    },

    examGeneration: {
        maxQuestions: 100,
        maxOptionsPerQuestion: 10,
        allowExplanationField: true,
        validQuestionTypes: ['single_choice', 'multiple_choice', 'true_false', 'matching', 'ordering', 'negative_qcm'],
        validDifficultyLevels: ['recall', 'understanding', 'application', 'analysis', 'evaluation'],
    },

    queue: {
        redisHost: process.env.REDIS_HOST || 'localhost',
        redisPort: parseInt(process.env.REDIS_PORT) || 6379,
        redisPassword: process.env.REDIS_PASSWORD || undefined,
        queueName: 'examGenerationQueue',
        jobRetryAttempts: 3,
    },

    storage: {
        materialsBasePath: 'storage/materials',
    },

    embedding: {
        model: 'Xenova/all-MiniLM-L6-v2',
        batchSize: 16
    },

    vectorDB: {
        host: 'http://localhost:6333',
        collection: 'materials'
    }
};
