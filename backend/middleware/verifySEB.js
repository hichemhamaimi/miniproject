/**
 * Middleware to enforce Safe Exam Browser usage.
 * It checks the User-Agent or custom header sent by SEB.
 * 
 * Note: In a production environment with SEB Server, 
 * you would also verify the Config Key (CK) or Browser Exam Key (BEK).
 */
const verifySEB = (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const sebHeader = req.headers['x-safeexambrowser'];

    // Basic SEB Detection (Looking for 'SEB' in user agent or custom header)
    const isSEB = userAgent.includes('SEB') || sebHeader;

    if (!isSEB) {
        return res.status(403).json({
            message: "Access Denied: You must use Safe Exam Browser to access this exam.",
            code: "SEB_REQUIRED"
        });
    }

    next();
};

module.exports = verifySEB;
