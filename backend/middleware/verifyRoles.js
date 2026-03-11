const AppError = require("../utils/AppError");

const verifyRoles = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req?.role) throw new AppError(401, "Unprivileged! No role found in request.");
            if (!allowedRoles.includes(req.role)) throw new AppError(401, "Protected route! Unauthorized role.");
            next();
        } catch (err) {
            next(err);
        }
    };
};

module.exports = verifyRoles;
