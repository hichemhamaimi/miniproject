const normalizeUrl = (value, fallback) => {
    const candidate = (value || fallback || '').trim();
    return candidate.replace(/\/+$/, '');
};

const splitOrigins = (value = '') => value
    .split(',')
    .map((origin) => normalizeUrl(origin, ''))
    .filter(Boolean);

const serverPort = Number.parseInt(process.env.PORT || '3500', 10);
const frontendUrl = normalizeUrl(process.env.FRONTEND_URL, 'http://localhost:5173');
const publicApiUrl = normalizeUrl(process.env.PUBLIC_API_URL || process.env.API_URL, `http://localhost:${serverPort}`);
const corsAllowedOrigins = [...new Set([
    frontendUrl,
    ...splitOrigins(process.env.CORS_ORIGINS),
])];
const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
    serverPort,
    frontendUrl,
    publicApiUrl,
    corsAllowedOrigins,
    isProduction,
    auth: {
        accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
        refreshTokenTtlDays: Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '14', 10),
        refreshCookieName: process.env.REFRESH_TOKEN_COOKIE_NAME || 'examq_refresh_token',
    },
    seb: {
        tokenSecret: process.env.SEB_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET,
        tokenTtl: process.env.SEB_TOKEN_TTL || '12h',
        sessionTransferSecret: process.env.SEB_SESSION_TRANSFER_SECRET || process.env.SEB_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET,
        sessionTransferTtl: process.env.SEB_SESSION_TRANSFER_TTL || '30m',
    },
};
