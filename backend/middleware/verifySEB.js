const pool = require('../config/dbConnect');
const { verifySebAccessToken } = require('../utils/sebAccess');

const getSebSignal = (req) => {
    const userAgent = req.headers['user-agent'] || '';
    return Boolean(
        /SEB/i.test(userAgent)
        || req.headers['x-safeexambrowser']
        || req.headers['x-safe-exam-browser-request-hash']
        || req.headers['x-safe-exam-browser-config-key-hash']
        || req.headers['x-safe-exam-browser-browser-exam-key-hash']
    );
};

const verifySEB = async (req, res, next) => {
    try {
        const examId = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(examId) || examId <= 0) {
            return res.status(400).json({ message: 'Invalid exam id.' });
        }

        const [examRows] = await pool.query(
            'SELECT id, require_seb FROM exams WHERE id = ? LIMIT 1',
            [examId]
        );

        if (examRows.length === 0) {
            return res.status(404).json({ message: 'Exam not found.' });
        }

        if (!examRows[0].require_seb) {
            return next();
        }

        const sebSignalDetected = getSebSignal(req);
        const sebToken = req.headers['x-seb-access-token']
            || req.headers['x-safe-exam-browser-token']
            || req.query?.sebToken;

        if (!sebToken && !sebSignalDetected) {
            return res.status(403).json({
                message: 'Access denied: this exam must be started from Safe Exam Browser.',
                code: 'SEB_REQUIRED',
            });
        }

        if (!sebToken) {
            return res.status(403).json({
                message: 'SEB access token is missing. Download the exam .seb file and relaunch the exam from Safe Exam Browser.',
                code: 'SEB_TOKEN_REQUIRED',
            });
        }

        const verification = verifySebAccessToken(sebToken, {
            examId,
            studentId: req.userId,
        });

        if (!verification.valid) {
            return res.status(403).json({
                message: 'Your Safe Exam Browser session could not be verified. Download a fresh .seb file and try again.',
                code: 'SEB_TOKEN_INVALID',
                details: verification.reason,
            });
        }

        req.seb = {
            required: true,
            verified: true,
            signalDetected: sebSignalDetected,
            tokenPayload: verification.payload,
        };
        next();
    } catch (error) {
        console.error('SEB verification failed:', error);
        res.status(500).json({
            message: 'Failed to verify Safe Exam Browser access.',
            code: 'SEB_VERIFICATION_FAILED',
        });
    }
};

module.exports = verifySEB;
