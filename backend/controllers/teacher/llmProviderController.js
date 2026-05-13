const pool = require('../../config/dbConnect');
const AppError = require('../../utils/AppError');
const { encrypt } = require('../../utils/crypto');
const { parsePositiveInt, requireFields, sanitizeString } = require('../../utils/validation');

const SUPPORTED_PROVIDERS = ['groq', 'openai', 'anthropic', 'gemini', 'mistral', 'ollama'];

const listProviders = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, provider_name, label, model_name, base_url, is_default, created_at, updated_at
             FROM llm_provider_configs
             WHERE teacher_id = ?
             ORDER BY is_default DESC, updated_at DESC`,
            [req.userId]
        );
        res.status(200).json(rows);
    } catch (error) {
        next(error);
    }
};

const createProvider = async (req, res, next) => {
    try {
        requireFields(req.body, ['provider_name', 'label', 'model_name']);
        const providerName = sanitizeString(req.body.provider_name, { min: 2, max: 50, fieldName: 'provider_name' }).toLowerCase();
        if (!SUPPORTED_PROVIDERS.includes(providerName)) {
            throw new AppError(400, `Unsupported provider_name. Allowed values: ${SUPPORTED_PROVIDERS.join(', ')}`);
        }

        const label = sanitizeString(req.body.label, { min: 2, max: 100, fieldName: 'label' });
        const modelName = sanitizeString(req.body.model_name, { min: 1, max: 100, fieldName: 'model_name' });
        const baseUrl = req.body.base_url ? sanitizeString(req.body.base_url, { min: 1, max: 255, fieldName: 'base_url' }) : null;
        const encryptedApiKey = req.body.api_key ? encrypt(req.body.api_key) : null;
        const isDefault = Boolean(req.body.is_default);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            if (isDefault) {
                await connection.query('UPDATE llm_provider_configs SET is_default = 0 WHERE teacher_id = ?', [req.userId]);
            }

            const [result] = await connection.query(
                `INSERT INTO llm_provider_configs
                 (teacher_id, provider_name, label, api_key_encrypted, model_name, base_url, is_default)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [req.userId, providerName, label, encryptedApiKey, modelName, baseUrl, isDefault ? 1 : 0]
            );

            await connection.commit();
            res.status(201).json({
                id: result.insertId,
                provider_name: providerName,
                label,
                model_name: modelName,
                base_url: baseUrl,
                is_default: isDefault ? 1 : 0,
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        next(error);
    }
};

const setDefaultProvider = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const providerId = parsePositiveInt(req.params.id, 'provider id');
        await connection.beginTransaction();

        const [rows] = await connection.query(
            'SELECT id FROM llm_provider_configs WHERE id = ? AND teacher_id = ? LIMIT 1',
            [providerId, req.userId]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'Provider configuration not found.');
        }

        await connection.query('UPDATE llm_provider_configs SET is_default = 0 WHERE teacher_id = ?', [req.userId]);
        await connection.query('UPDATE llm_provider_configs SET is_default = 1 WHERE id = ?', [providerId]);
        await connection.commit();

        res.status(200).json({ message: 'Default provider updated successfully.' });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

const assignExamProvider = async (req, res, next) => {
    try {
        const examId = parsePositiveInt(req.params.examId, 'exam id');
        const providerId = parsePositiveInt(req.body.provider_config_id, 'provider_config_id');

        const [providerRows] = await pool.query(
            'SELECT id FROM llm_provider_configs WHERE id = ? AND teacher_id = ? LIMIT 1',
            [providerId, req.userId]
        );
        if (providerRows.length === 0) {
            throw new AppError(404, 'Provider configuration not found.');
        }

        const [examRows] = await pool.query(
            'SELECT id FROM exams WHERE id = ? AND teacher_id = ? LIMIT 1',
            [examId, req.userId]
        );
        if (examRows.length === 0) {
            throw new AppError(404, 'Exam not found.');
        }

        await pool.query(
            'UPDATE exams SET llm_provider_config_id = ? WHERE id = ?',
            [providerId, examId]
        );

        res.status(200).json({ message: 'Exam provider assignment saved.' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    assignExamProvider,
    createProvider,
    listProviders,
    setDefaultProvider,
};
