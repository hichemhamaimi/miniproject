const normalizeDateInput = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value !== 'string') return new Date(value);

    const normalized = value.includes('T')
        ? value
        : value.replace(' ', 'T');

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const parseAppDateTime = (value) => normalizeDateInput(value);

export const formatAppDateTime = (value, options = {}) => {
    const parsed = normalizeDateInput(value);
    if (!parsed) return 'N/A';
    return parsed.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    });
};

export const toSqlLocalDateTime = (value) => {
    if (!value) return null;
    const safeValue = value.length === 16 ? `${value}:00` : value;
    return safeValue.replace('T', ' ');
};
