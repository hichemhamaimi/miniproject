const { resolveLlmProviderConfig } = require('./aiProviderService');

const resolveProviderConfig = async ({
    providerConfigId = null,
    providerOverride = null,
    modelOverride = null,
} = {}) => resolveLlmProviderConfig({
    providerConfigId,
    providerOverride,
    modelOverride,
});

module.exports = {
    resolveProviderConfig,
};
