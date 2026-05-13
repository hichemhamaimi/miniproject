const {
    getDefaultProvider,
    listProviders,
    resolveEmbeddingProviderConfig,
    toPublicProvider,
} = require('../../services/aiProviderService');

const listAiOptions = async (req, res, next) => {
    try {
        const [llmProviders, defaultLlmProvider, embeddingProvider] = await Promise.all([
            listProviders({ serviceType: 'llm', activeOnly: true }),
            getDefaultProvider('llm'),
            resolveEmbeddingProviderConfig(),
        ]);

        res.status(200).json({
            llmProviders: llmProviders.map((provider) => toPublicProvider(provider)),
            defaultLlmProviderId: defaultLlmProvider?.id || null,
            embeddingProvider: embeddingProvider ? {
                id: embeddingProvider.id,
                provider_name: embeddingProvider.provider,
                label: embeddingProvider.label,
                description: embeddingProvider.description,
                model_name: embeddingProvider.modelName,
                base_url: embeddingProvider.baseUrl,
            } : null,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listAiOptions,
};
