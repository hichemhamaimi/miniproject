const bcrypt = require('bcrypt');

const BCRYPT_PREFIXES = ['$2a$', '$2b$', '$2x$', '$2y$'];
const BCRYPT_COST_ONLY_PREFIX = /^\$\d{2}\$/;

const isBcryptHash = (value = '') => BCRYPT_PREFIXES.some((prefix) => value.startsWith(prefix));
const normalizeBcryptHash = (value = '') => {
    if (isBcryptHash(value)) return value;
    if (BCRYPT_COST_ONLY_PREFIX.test(value)) return `$2b${value}`;
    return null;
};

const verifyPassword = async (plainPassword, storedPasswordHash) => {
    if (!storedPasswordHash) {
        return { isValid: false, shouldUpgradeHash: false };
    }

    const normalizedBcryptHash = normalizeBcryptHash(storedPasswordHash);
    if (normalizedBcryptHash) {
        const isValid = await bcrypt.compare(plainPassword, normalizedBcryptHash);
        return {
            isValid,
            shouldUpgradeHash: isValid && normalizedBcryptHash !== storedPasswordHash,
        };
    }

    // Backward-compatible fallback for legacy plaintext rows.
    const isValid = plainPassword === storedPasswordHash;
    return { isValid, shouldUpgradeHash: isValid };
};

const hashPassword = async (plainPassword) => bcrypt.hash(plainPassword, 12);

module.exports = {
    hashPassword,
    isBcryptHash,
    verifyPassword,
};
