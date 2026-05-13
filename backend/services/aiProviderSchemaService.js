const { ensureAiProviderSchema } = require('./aiProviderService');

const initAiProviderSchema = async () => {
    try {
        await ensureAiProviderSchema();
        console.log('[AI Config] Global AI provider schema ensured.');
    } catch (error) {
        console.error('[AI Config] Failed to ensure AI provider schema:', error.message);
    }
};

module.exports = {
    initAiProviderSchema,
};
