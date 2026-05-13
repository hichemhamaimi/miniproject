const pool = require('../../config/dbConnect');
const AppError = require('../../utils/AppError');
const { encrypt } = require('../../utils/crypto');
const { parsePositiveInt, requireFields, sanitizeString } = require('../../utils/validation');
const {
    getAllowedProvidersForService,
    getProviderById,
    listProviders,
    toPublicProvider,
} = require('../../services/aiProviderService');

const parseBooleanFlag = (value, fallback = false) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
    }
    return fallback;
};

const validateProviderInput = (body, { partial = false } = {}) => {
    if (!partial) {
        requireFields(body, ['service_type', 'provider_name', 'label', 'model_name']);
    }

    const next = {};

    if (body.service_type !== undefined) {
        const serviceType = sanitizeString(body.service_type, { min: 3, max: 20, fieldName: 'service_type' }).toLowerCase();
        if (!['llm', 'embedding'].includes(serviceType)) {
            throw new AppError(400, 'service_type must be either "llm" or "embedding".');
        }
        next.serviceType = serviceType;
    }

    const effectiveServiceType = next.serviceType || body.service_type;

    if (body.provider_name !== undefined) {
        const providerName = sanitizeString(body.provider_name, { min: 2, max: 50, fieldName: 'provider_name' }).toLowerCase();
        const allowedProviders = getAllowedProvidersForService(effectiveServiceType);
        if (!allowedProviders.includes(providerName)) {
            throw new AppError(400, `Unsupported provider_name for ${effectiveServiceType}. Allowed values: ${allowedProviders.join(', ')}`);
        }
        next.providerName = providerName;
    }

    if (body.label !== undefined) {
        next.label = sanitizeString(body.label, { min: 2, max: 100, fieldName: 'label' });
    }

    if (body.description !== undefined) {
        next.description = body.description
            ? sanitizeString(body.description, { min: 2, max: 255, fieldName: 'description' })
            : '';
    }

    if (body.model_name !== undefined) {
        next.modelName = sanitizeString(body.model_name, { min: 1, max: 160, fieldName: 'model_name' });
    }

    if (body.base_url !== undefined) {
        next.baseUrl = body.base_url
            ? sanitizeString(body.base_url, { min: 1, max: 255, fieldName: 'base_url' })
            : null;
    }

    if (body.is_active !== undefined) {
        next.isActive = parseBooleanFlag(body.is_active, true);
    }

    if (body.is_default !== undefined) {
        next.isDefault = parseBooleanFlag(body.is_default, false);
    }

    if (body.api_key !== undefined) {
        next.apiKey = body.api_key ? encrypt(body.api_key) : null;
    }

    if (body.clear_api_key !== undefined) {
        next.clearApiKey = parseBooleanFlag(body.clear_api_key, false);
    }

    return next;
};

const listAllProviders = async (req, res, next) => {
    try {
        const providers = await listProviders();
        res.status(200).json(providers.map((provider) => toPublicProvider(provider)));
    } catch (error) {
        next(error);
    }
};

const createProvider = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const payload = validateProviderInput(req.body);
        await connection.beginTransaction();

        if (payload.isDefault) {
            await connection.query(
                'UPDATE ai_provider_configs SET is_default = 0 WHERE service_type = ?',
                [payload.serviceType]
            );
        }

        const [result] = await connection.query(
            `INSERT INTO ai_provider_configs
             (service_type, provider_name, label, description, api_key_encrypted, model_name, base_url, is_active, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                payload.serviceType,
                payload.providerName,
                payload.label,
                payload.description || '',
                payload.apiKey || null,
                payload.modelName,
                payload.baseUrl,
                payload.isActive === false ? 0 : 1,
                payload.isDefault ? 1 : 0,
            ]
        );

        await connection.commit();
        const created = await getProviderById(result.insertId);
        res.status(201).json(toPublicProvider(created));
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

const updateProvider = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const providerId = parsePositiveInt(req.params.id, 'provider id');
        const existing = await getProviderById(providerId, { includeSecret: true });
        if (!existing) {
            throw new AppError(404, 'Provider configuration not found.');
        }

        const payload = validateProviderInput(
            { ...req.body, service_type: req.body.service_type ?? existing.serviceType },
            { partial: true }
        );

        await connection.beginTransaction();

        const serviceType = payload.serviceType || existing.serviceType;
        const providerName = payload.providerName || existing.provider;
        const label = payload.label || existing.label;
        const description = payload.description !== undefined ? payload.description : existing.description;
        const modelName = payload.modelName || existing.modelName;
        const baseUrl = payload.baseUrl !== undefined ? payload.baseUrl : existing.baseUrl;
        const isActive = payload.isActive !== undefined ? payload.isActive : existing.isActive;
        const isDefault = payload.isDefault !== undefined ? payload.isDefault : existing.isDefault;
        const apiKeyEncrypted = payload.clearApiKey
            ? null
            : (payload.apiKey !== undefined ? payload.apiKey : existing.apiKeyEncrypted);

        if (isDefault) {
            await connection.query(
                'UPDATE ai_provider_configs SET is_default = 0 WHERE service_type = ?',
                [serviceType]
            );
        }

        await connection.query(
            `UPDATE ai_provider_configs
             SET service_type = ?, provider_name = ?, label = ?, description = ?, api_key_encrypted = ?, model_name = ?, base_url = ?, is_active = ?, is_default = ?
             WHERE id = ?`,
            [
                serviceType,
                providerName,
                label,
                description,
                apiKeyEncrypted,
                modelName,
                baseUrl,
                isActive ? 1 : 0,
                isDefault ? 1 : 0,
                providerId,
            ]
        );

        await connection.commit();
        const updated = await getProviderById(providerId);
        res.status(200).json(toPublicProvider(updated));
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

const deleteProvider = async (req, res, next) => {
    try {
        const providerId = parsePositiveInt(req.params.id, 'provider id');
        const existing = await getProviderById(providerId);
        if (!existing) {
            throw new AppError(404, 'Provider configuration not found.');
        }

        await pool.query('DELETE FROM ai_provider_configs WHERE id = ?', [providerId]);
        res.status(200).json({ message: 'Provider configuration deleted.' });
    } catch (error) {
        next(error);
    }
};

const setDefaultProvider = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const providerId = parsePositiveInt(req.params.id, 'provider id');
        const existing = await getProviderById(providerId);
        if (!existing) {
            throw new AppError(404, 'Provider configuration not found.');
        }

        await connection.beginTransaction();
        await connection.query(
            'UPDATE ai_provider_configs SET is_default = 0 WHERE service_type = ?',
            [existing.serviceType]
        );
        await connection.query(
            'UPDATE ai_provider_configs SET is_default = 1 WHERE id = ?',
            [providerId]
        );
        await connection.commit();

        const updated = await getProviderById(providerId);
        res.status(200).json(toPublicProvider(updated));
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

module.exports = {
    createProvider,
    deleteProvider,
    listAllProviders,
    setDefaultProvider,
    updateProvider,
};
