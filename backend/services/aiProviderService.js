const pool = require('../config/dbConnect');
const AppError = require('../utils/AppError');
const { decrypt } = require('../utils/crypto');

const LLM_PROVIDER_NAMES = ['groq', 'openai', 'anthropic', 'gemini', 'mistral', 'ollama'];
const EMBEDDING_PROVIDER_NAMES = ['transformers', 'openai', 'groq'];
const SERVICE_PROVIDER_MAP = {
    llm: LLM_PROVIDER_NAMES,
    embedding: EMBEDDING_PROVIDER_NAMES,
};

const LLM_ENV_DEFAULTS = {
    groq: {
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
        baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    },
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
        baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    },
    mistral: {
        apiKey: process.env.MISTRAL_API_KEY,
        model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
        baseUrl: process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1',
    },
    ollama: {
        apiKey: null,
        model: process.env.OLLAMA_MODEL || 'llama3',
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    },
};

const EMBEDDING_ENV_DEFAULTS = {
    transformers: {
        apiKey: null,
        model: process.env.LOCAL_EMBEDDING_MODEL || process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
        baseUrl: null,
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_EMBEDDING_MODEL || process.env.EXTERNAL_EMBEDDING_MODEL || 'text-embedding-3-small',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    },
    groq: {
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_EMBEDDING_MODEL || process.env.EXTERNAL_EMBEDDING_MODEL || '',
        baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    },
};

const buildDecryptionErrorMessage = (label) => `The saved API key for "${label}" could not be decrypted. Check that APP_ENCRYPTION_KEY matches the key used when this provider was created.`;

const normalizeProviderRow = (row, { includeSecret = false, throwOnDecryptError = false } = {}) => {
    let apiKey = null;
    let decryptionError = null;

    if (includeSecret && row?.api_key_encrypted) {
        try {
            apiKey = decrypt(row.api_key_encrypted);
        } catch (error) {
            decryptionError = buildDecryptionErrorMessage(row?.label || row?.provider_name || 'this provider');
            if (throwOnDecryptError) {
                throw new AppError(500, decryptionError);
            }
        }
    }

    return {
        id: row?.id || null,
        serviceType: row?.service_type || null,
        provider: row?.provider_name || null,
        label: row?.label || '',
        description: row?.description || '',
        apiKey,
        apiKeyEncrypted: row?.api_key_encrypted || null,
        hasApiKey: Boolean(row?.api_key_encrypted || row?.has_api_key),
        decryptionError,
        modelName: row?.model_name || '',
        baseUrl: row?.base_url || null,
        isActive: Boolean(row?.is_active),
        isDefault: Boolean(row?.is_default),
        createdAt: row?.created_at || null,
        updatedAt: row?.updated_at || null,
    };
};

const toPublicProvider = (provider) => ({
    id: provider.id,
    service_type: provider.serviceType,
    provider_name: provider.provider,
    label: provider.label,
    description: provider.description,
    model_name: provider.modelName,
    base_url: provider.baseUrl,
    is_active: provider.isActive ? 1 : 0,
    is_default: provider.isDefault ? 1 : 0,
    has_api_key: provider.hasApiKey ? 1 : 0,
    decryption_error: provider.decryptionError,
    created_at: provider.createdAt,
    updated_at: provider.updatedAt,
});

const ensureAiProviderSchema = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_provider_configs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            service_type ENUM('llm', 'embedding') NOT NULL,
            provider_name VARCHAR(50) NOT NULL,
            label VARCHAR(100) NOT NULL,
            description VARCHAR(255) NULL,
            api_key_encrypted TEXT NULL,
            model_name VARCHAR(160) NOT NULL,
            base_url VARCHAR(255) NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ai_service_default (service_type, is_default, is_active),
            INDEX idx_ai_service_active (service_type, is_active)
        )
    `);
};

const listProviders = async ({ serviceType = null, activeOnly = false, includeSecret = false, throwOnDecryptError = false } = {}) => {
    const conditions = [];
    const params = [];

    if (serviceType) {
        conditions.push('service_type = ?');
        params.push(serviceType);
    }

    if (activeOnly) {
        conditions.push('is_active = 1');
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
        `SELECT id, service_type, provider_name, label, description, api_key_encrypted, model_name, base_url, is_active, is_default, created_at, updated_at
         FROM ai_provider_configs
         ${whereClause}
         ORDER BY service_type ASC, is_default DESC, is_active DESC, updated_at DESC`,
        params
    );

    return rows.map((row) => normalizeProviderRow(row, { includeSecret, throwOnDecryptError }));
};

const getProviderById = async (providerId, { serviceType = null, activeOnly = false, includeSecret = false, throwOnDecryptError = false } = {}) => {
    const conditions = ['id = ?'];
    const params = [providerId];

    if (serviceType) {
        conditions.push('service_type = ?');
        params.push(serviceType);
    }

    if (activeOnly) {
        conditions.push('is_active = 1');
    }

    const [rows] = await pool.query(
        `SELECT id, service_type, provider_name, label, description, api_key_encrypted, model_name, base_url, is_active, is_default, created_at, updated_at
         FROM ai_provider_configs
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        params
    );

    return rows.length ? normalizeProviderRow(rows[0], { includeSecret, throwOnDecryptError }) : null;
};

const getDefaultProvider = async (serviceType, { includeSecret = false, throwOnDecryptError = false } = {}) => {
    const [rows] = await pool.query(
        `SELECT id, service_type, provider_name, label, description, api_key_encrypted, model_name, base_url, is_active, is_default, created_at, updated_at
         FROM ai_provider_configs
         WHERE service_type = ? AND is_default = 1 AND is_active = 1
         LIMIT 1`,
        [serviceType]
    );

    return rows.length ? normalizeProviderRow(rows[0], { includeSecret, throwOnDecryptError }) : null;
};

const getAllowedProvidersForService = (serviceType) => SERVICE_PROVIDER_MAP[serviceType] || [];

const resolveLlmProviderConfig = async ({ providerConfigId = null, providerOverride = null, modelOverride = null } = {}) => {
    let config = null;

    if (providerConfigId) {
        config = await getProviderById(providerConfigId, {
            serviceType: 'llm',
            activeOnly: true,
            includeSecret: true,
            throwOnDecryptError: true,
        });
    }

    if (!config) {
        config = await getDefaultProvider('llm', {
            includeSecret: true,
            throwOnDecryptError: true,
        });
    }

    const fallbackProviderName = providerOverride || config?.provider || process.env.LLM_PROVIDER || 'groq';
    const defaults = LLM_ENV_DEFAULTS[fallbackProviderName] || LLM_ENV_DEFAULTS.groq;

    return {
        id: config?.id || null,
        provider: fallbackProviderName,
        label: config?.label || 'System default',
        modelName: modelOverride || config?.modelName || defaults.model,
        baseUrl: config?.baseUrl || defaults.baseUrl,
        apiKey: config?.apiKey || defaults.apiKey,
        description: config?.description || '',
    };
};

const resolveEmbeddingProviderConfig = async () => {
    const config = await getDefaultProvider('embedding', {
        includeSecret: true,
        throwOnDecryptError: true,
    });
    const fallbackProviderName = config?.provider || process.env.EMBEDDING_PROVIDER || 'transformers';
    const defaults = EMBEDDING_ENV_DEFAULTS[fallbackProviderName] || EMBEDDING_ENV_DEFAULTS.transformers;

    return {
        id: config?.id || null,
        provider: fallbackProviderName,
        label: config?.label || 'System embedding default',
        modelName: config?.modelName || defaults.model,
        baseUrl: config?.baseUrl || defaults.baseUrl,
        apiKey: config?.apiKey || defaults.apiKey,
        description: config?.description || '',
    };
};

module.exports = {
    EMBEDDING_PROVIDER_NAMES,
    LLM_PROVIDER_NAMES,
    ensureAiProviderSchema,
    getAllowedProvidersForService,
    getDefaultProvider,
    getProviderById,
    listProviders,
    normalizeProviderRow,
    resolveEmbeddingProviderConfig,
    resolveLlmProviderConfig,
    toPublicProvider,
};
