const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const verifyJWT = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (!authHeader?.startsWith('Bearer ')) throw new AppError(401, "You're not logged in!");
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.userId = decoded.userInfo.userId;
        req.role = decoded.userInfo.role;
        req.username = decoded.userInfo.username;
        if (decoded.userInfo.departmentId) {
            req.departmentId = decoded.userInfo.departmentId;
        }
        next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return next(new AppError(401, "Session expired."));
        }
        if (err.name === "JsonWebTokenError") {
            return next(new AppError(401, "Invalid authorization token."));
        }
        next(err);
    }
};

module.exports = verifyJWT;
