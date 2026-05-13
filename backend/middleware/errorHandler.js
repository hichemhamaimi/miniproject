const devLogger = require('../utils/devLogger');

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (err.code === 'ER_DUP_ENTRY') {
        err.statusCode = 409;
        err.status = 'fail';
        err.message = 'A unique record already exists for the submitted data.';
    }

    devLogger.log('ERROR', 'Express error handler captured an error', {
        method: req?.method,
        url: req?.originalUrl,
        statusCode: err.statusCode,
        status: err.status,
        message: err.message,
        stack: err.stack,
    });

    res.status(err.statusCode).json({
        status: err.status,
        message: err.message
    });
};
module.exports = errorHandler;
