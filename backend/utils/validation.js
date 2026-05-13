const AppError = require('./AppError');

const requireFields = (payload, fields) => {
    const missing = fields.filter((field) => {
        const value = payload[field];
        return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
        throw new AppError(400, `Missing required fields: ${missing.join(', ')}`);
    }
};

const sanitizeString = (value, { min = 0, max = 255, fieldName = 'value' } = {}) => {
    if (typeof value !== 'string') {
        throw new AppError(400, `${fieldName} must be a string.`);
    }

    const trimmed = value.trim();
    if (trimmed.length < min) {
        throw new AppError(400, `${fieldName} must be at least ${min} characters long.`);
    }
    if (trimmed.length > max) {
        throw new AppError(400, `${fieldName} must be at most ${max} characters long.`);
    }

    return trimmed;
};

const parsePositiveInt = (value, fieldName) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new AppError(400, `${fieldName} must be a positive integer.`);
    }
    return parsed;
};

module.exports = {
    requireFields,
    sanitizeString,
    parsePositiveInt,
};
