const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const verifyJWT = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (!authHeader?.startsWith('Bearer ')) throw new AppError(401, "You're not logged in!");
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                if (err.name === "TokenExpiredError") {
                    throw new AppError(403, "Session Expired!");
                } else {
                    throw new AppError(403, "Invalid authorization token!");
                }
            }
            // Add user details to request object
            req.userId = decoded.userInfo.userId;
            req.role = decoded.userInfo.role;
            // Optionally could add a department_id mapped token item if helpful
            if (decoded.userInfo.departmentId) {
                req.departmentId = decoded.userInfo.departmentId;
            }
            next();
        });
    } catch (err) {
        next(err);
    }
};

module.exports = verifyJWT;
