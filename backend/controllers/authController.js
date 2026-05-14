const pool = require("../config/dbConnect");
const AppError = require("../utils/AppError");
const { requireFields, sanitizeString } = require("../utils/validation");
const { hashPassword, verifyPassword } = require("../utils/auth");
const { verifySebSessionTransferToken } = require("../utils/sebAccess");
const { issueAuthSession, logoutAuthSession, refreshAuthSession } = require("../services/authSessionService");

const login = async (req, res, next) => {
    try {
        requireFields(req.body, ['username', 'password']);
        const username = sanitizeString(req.body.username, { min: 3, max: 100, fieldName: 'username' });
        const password = sanitizeString(req.body.password, { min: 1, max: 255, fieldName: 'password' });

        const [users] = await pool.query(
            `SELECT id, username, password_hash, role
             FROM users
             WHERE username = ?
             LIMIT 1`,
            [username]
        );
        if (users.length === 0) {
            throw new AppError(401, "Invalid username or password.");
        }

        const foundUser = users[0];
        const passwordCheck = await verifyPassword(password, foundUser.password_hash);

        if (!passwordCheck.isValid) {
            throw new AppError(401, "Invalid username or password.");
        }

        if (passwordCheck.shouldUpgradeHash) {
            const upgradedHash = await hashPassword(password);
            await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [upgradedHash, foundUser.id]);
        }

        const responsePayload = await issueAuthSession({
            res,
            user: foundUser,
            req,
            sessionContext: 'web',
        });
        res.status(200).json(responsePayload);
    } catch (err) { 
        next(err); 
    }
};

const exchangeSebSession = async (req, res, next) => {
    try {
        requireFields(req.body, ['transferToken', 'examId']);
        const examId = Number.parseInt(req.body.examId, 10);
        if (!Number.isInteger(examId) || examId <= 0) {
            throw new AppError(400, 'Invalid exam id.');
        }

        const transferToken = sanitizeString(req.body.transferToken, { min: 10, max: 4000, fieldName: 'transferToken' });
        const verification = verifySebSessionTransferToken(transferToken, { examId });
        if (!verification.valid) {
            throw new AppError(403, `Invalid SEB session handoff token. ${verification.reason}`);
        }

        const { payload } = verification;
        const [users] = await pool.query(
            `SELECT id, username, role
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [payload.studentId]
        );

        if (users.length === 0) {
            throw new AppError(404, 'User not found for SEB session handoff.');
        }

        const foundUser = users[0];
        if (foundUser.role !== 'student') {
            throw new AppError(403, 'SEB session handoff is restricted to students.');
        }

        const responsePayload = await issueAuthSession({
            res,
            user: foundUser,
            req,
            sessionContext: 'seb',
        });
        res.status(200).json(responsePayload);
    } catch (err) {
        next(err);
    }
};

const refresh = async (req, res, next) => {
    try {
        const responsePayload = await refreshAuthSession({ req, res });
        res.status(200).json(responsePayload);
    } catch (err) {
        next(err);
    }
};

const logout = async (req, res, next) => {
    try {
        await logoutAuthSession({ req, res });
        res.status(200).json({ message: 'Logged out successfully.' });
    } catch (err) {
        next(err);
    }
};

module.exports = { login, exchangeSebSession, refresh, logout };
