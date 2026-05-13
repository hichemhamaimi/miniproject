const crypto = require('crypto');
const AppError = require('./AppError');

let warnedAboutFallbackKey = false;

const getKey = () => {
    const secret = process.env.APP_ENCRYPTION_KEY
        || process.env.ACCESS_TOKEN_SECRET
        || process.env.REFRESH_TOKEN_SECRET;

    if (!secret) {
        throw new AppError(500, 'APP_ENCRYPTION_KEY is not configured, and no fallback auth secret is available.');
    }

    if (!process.env.APP_ENCRYPTION_KEY && !warnedAboutFallbackKey) {
        warnedAboutFallbackKey = true;
        console.warn('[Crypto] APP_ENCRYPTION_KEY is not set. Falling back to an auth secret for encryption. Set APP_ENCRYPTION_KEY explicitly to keep AI provider secret storage stable across future auth secret changes.');
    }

    return crypto.createHash('sha256').update(secret).digest();
};

const encrypt = (plainText) => {
    if (!plainText) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (payload) => {
    if (!payload) return null;
    const [ivHex, authTagHex, encryptedHex] = payload.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, 'hex')),
        decipher.final(),
    ]);
    return decrypted.toString('utf8');
};

module.exports = {
    encrypt,
    decrypt,
};
