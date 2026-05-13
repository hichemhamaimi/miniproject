const bcrypt = require('bcrypt');

const BCRYPT_PREFIXES = ['$2a$', '$2b$', '$2x$', '$2y$'];

const isBcryptHash = (value = '') => BCRYPT_PREFIXES.some((prefix) => value.startsWith(prefix));

const verifyPassword = async (plainPassword, storedPasswordHash) => {
    if (!storedPasswordHash) {
        return { isValid: false, shouldUpgradeHash: false };
    }

    if (isBcryptHash(storedPasswordHash)) {
        const isValid = await bcrypt.compare(plainPassword, storedPasswordHash);
        return { isValid, shouldUpgradeHash: false };
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
