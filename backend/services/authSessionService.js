const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/dbConnect');
const runtimeConfig = require('../config/runtime.config');
const AppError = require('../utils/AppError');
const { ensureRedisConnection } = require('./redisService');

const REFRESH_SESSION_CONTEXTS = new Set(['web', 'seb']);
const REFRESH_KEY_PREFIX = 'auth:refresh:session:';

const getAccessTokenSecret = () => {
    if (!process.env.ACCESS_TOKEN_SECRET) {
        throw new AppError(500, 'ACCESS_TOKEN_SECRET is not configured.');
    }
    return process.env.ACCESS_TOKEN_SECRET;
};

const buildAccessTokenPayload = (user) => ({
    userInfo: {
        userId: user.id,
        role: user.role,
        username: user.username,
    },
});

const generateAccessToken = (user) => jwt.sign(
    buildAccessTokenPayload(user),
    getAccessTokenSecret(),
    { expiresIn: runtimeConfig.auth.accessTokenTtl }
);

const generateRefreshToken = () => crypto.randomBytes(48).toString('hex');

const hashRefreshToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');

const getRefreshExpiryDate = () => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + runtimeConfig.auth.refreshTokenTtlDays);
    return expiresAt;
};

const getRefreshTtlSeconds = () => runtimeConfig.auth.refreshTokenTtlDays * 24 * 60 * 60;

const getCookieOptions = () => ({
    httpOnly: true,
    secure: runtimeConfig.isProduction,
    sameSite: 'lax',
    path: '/auth',
    maxAge: getRefreshTtlSeconds() * 1000,
});

const setRefreshCookie = (res, token) => {
    res.cookie(runtimeConfig.auth.refreshCookieName, token, getCookieOptions());
};

const clearRefreshCookie = (res) => {
    res.clearCookie(runtimeConfig.auth.refreshCookieName, getCookieOptions());
};

const getRefreshTokenFromRequest = (req) => req.cookies?.[runtimeConfig.auth.refreshCookieName] || '';

const sanitizeSessionContext = (value) => (
    REFRESH_SESSION_CONTEXTS.has(value) ? value : 'web'
);

const getRefreshSessionKey = (tokenHash) => `${REFRESH_KEY_PREFIX}${tokenHash}`;

const createRefreshSession = async ({
    userId,
    req,
    sessionContext = 'web',
}) => {
    const rawToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);
    const expiresAt = getRefreshExpiryDate();
    const redis = await ensureRedisConnection();
    const payload = {
        userId,
        sessionContext: sanitizeSessionContext(sessionContext),
        createdAt: new Date().toISOString(),
        userAgent: (req.headers['user-agent'] || '').slice(0, 255) || null,
        ipAddress: (req.ip || req.headers['x-forwarded-for'] || '').toString().slice(0, 64) || null,
    };

    await redis.set(
        getRefreshSessionKey(tokenHash),
        JSON.stringify(payload),
        'EX',
        getRefreshTtlSeconds()
    );

    return { rawToken, tokenHash, expiresAt, payload };
};

const buildAuthResponse = (user, accessToken) => ({
    accessToken,
    role: user.role,
    userId: user.id,
    username: user.username,
});

const issueAuthSession = async ({
    res,
    user,
    req,
    sessionContext = 'web',
}) => {
    const accessToken = generateAccessToken(user);
    const refreshSession = await createRefreshSession({
        userId: user.id,
        req,
        sessionContext,
    });
    setRefreshCookie(res, refreshSession.rawToken);
    return buildAuthResponse(user, accessToken);
};

const revokeRefreshTokenByHash = async (tokenHash) => {
    if (!tokenHash) return;
    const redis = await ensureRedisConnection();
    await redis.del(getRefreshSessionKey(tokenHash));
};

const refreshAuthSession = async ({ req, res }) => {
    const incomingToken = getRefreshTokenFromRequest(req);
    if (!incomingToken) {
        clearRefreshCookie(res);
        throw new AppError(401, 'Refresh token is missing.');
    }

    const incomingTokenHash = hashRefreshToken(incomingToken);
    const redis = await ensureRedisConnection();

    try {
        const sessionKey = getRefreshSessionKey(incomingTokenHash);
        const storedSessionRaw = await redis.get(sessionKey);
        if (!storedSessionRaw) {
            throw new AppError(403, 'Refresh token is invalid or expired.');
        }

        let storedSession;
        try {
            storedSession = JSON.parse(storedSessionRaw);
        } catch (error) {
            await redis.del(sessionKey);
            throw new AppError(403, 'Refresh token session is corrupted.');
        }

        const [users] = await pool.query(
            `SELECT id, username, role
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [storedSession.userId]
        );
        if (users.length === 0) {
            await redis.del(sessionKey);
            throw new AppError(403, 'Refresh session user no longer exists.');
        }

        const nextSession = await createRefreshSession({
            userId: storedSession.userId,
            req,
            sessionContext: storedSession.sessionContext,
        });

        await redis.multi()
            .del(sessionKey)
            .exec();

        const user = users[0];
        const accessToken = generateAccessToken(user);
        setRefreshCookie(res, nextSession.rawToken);

        return buildAuthResponse(user, accessToken);
    } catch (error) {
        clearRefreshCookie(res);
        throw error;
    }
};

const logoutAuthSession = async ({ req, res }) => {
    const incomingToken = getRefreshTokenFromRequest(req);
    if (incomingToken) {
        const tokenHash = hashRefreshToken(incomingToken);
        await revokeRefreshTokenByHash(tokenHash);
    }
    clearRefreshCookie(res);
};

module.exports = {
    buildAuthResponse,
    clearRefreshCookie,
    generateAccessToken,
    getRefreshTokenFromRequest,
    hashRefreshToken,
    issueAuthSession,
    logoutAuthSession,
    refreshAuthSession,
};
