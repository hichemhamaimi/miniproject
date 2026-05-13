const jwt = require('jsonwebtoken');
const runtimeConfig = require('../config/runtime.config');

const normalizeNumber = (value) => Number.parseInt(value, 10);

const getSebSecret = () => runtimeConfig.seb.tokenSecret;
const getSebSessionTransferSecret = () => runtimeConfig.seb.sessionTransferSecret || getSebSecret();

const generateSebAccessToken = ({ examId, studentId }) => {
    const secret = getSebSecret();
    if (!secret) {
        throw new Error('SEB token secret is not configured.');
    }

    return jwt.sign(
        {
            purpose: 'seb_access',
            examId: normalizeNumber(examId),
            studentId: normalizeNumber(studentId),
        },
        secret,
        { expiresIn: runtimeConfig.seb.tokenTtl }
    );
};

const verifySebAccessToken = (token, { examId, studentId }) => {
    const secret = getSebSecret();
    if (!secret) {
        return { valid: false, reason: 'SEB token secret is not configured.' };
    }

    try {
        const payload = jwt.verify(token, secret);
        if (payload.purpose !== 'seb_access') {
            return { valid: false, reason: 'Invalid SEB token purpose.' };
        }

        if (normalizeNumber(payload.examId) !== normalizeNumber(examId)) {
            return { valid: false, reason: 'SEB token does not match this exam.' };
        }

        if (normalizeNumber(payload.studentId) !== normalizeNumber(studentId)) {
            return { valid: false, reason: 'SEB token does not match this student.' };
        }

        return { valid: true, payload };
    } catch (error) {
        return { valid: false, reason: error.message };
    }
};

const generateSebSessionTransferToken = ({ examId, studentId, username, role }) => {
    const secret = getSebSessionTransferSecret();
    if (!secret) {
        throw new Error('SEB session transfer secret is not configured.');
    }

    return jwt.sign(
        {
            purpose: 'seb_session_transfer',
            examId: normalizeNumber(examId),
            studentId: normalizeNumber(studentId),
            username: String(username || ''),
            role: String(role || 'student'),
        },
        secret,
        { expiresIn: runtimeConfig.seb.sessionTransferTtl }
    );
};

const verifySebSessionTransferToken = (token, { examId } = {}) => {
    const secret = getSebSessionTransferSecret();
    if (!secret) {
        return { valid: false, reason: 'SEB session transfer secret is not configured.' };
    }

    try {
        const payload = jwt.verify(token, secret);
        if (payload.purpose !== 'seb_session_transfer') {
            return { valid: false, reason: 'Invalid SEB session transfer token purpose.' };
        }

        if (examId !== undefined && normalizeNumber(payload.examId) !== normalizeNumber(examId)) {
            return { valid: false, reason: 'SEB session transfer token does not match this exam.' };
        }

        return { valid: true, payload };
    } catch (error) {
        return { valid: false, reason: error.message };
    }
};

module.exports = {
    generateSebAccessToken,
    verifySebAccessToken,
    generateSebSessionTransferToken,
    verifySebSessionTransferToken,
};
