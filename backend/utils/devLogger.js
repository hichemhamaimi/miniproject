const fs = require('fs');
const path = require('path');
const util = require('util');

const LOG_DIR = path.join(__dirname, '..', 'logs', 'dev');
const SESSION_PREFIX = 'backend-dev';
const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(password|password_hash|authorization|api_?key|token|secret|cookie)/i;

let enabled = process.env.NODE_ENV !== 'production';
let sessionFilePath = null;
let sessionStartedAt = null;
let consolePatched = false;
let originalConsole = null;

const ensureLogDirectory = () => {
    fs.mkdirSync(LOG_DIR, { recursive: true });
};

const timestamp = () => new Date().toISOString();

const sessionTimestamp = () => timestamp()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');

const safeInspect = (value) => util.inspect(value, {
    depth: 8,
    breakLength: 120,
    maxArrayLength: 50,
    maxStringLength: 10_000,
    compact: false,
});

const redactValue = (value) => {
    if (value === null || value === undefined) return value;

    if (Array.isArray(value)) {
        return value.map((item) => redactValue(item));
    }

    if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => {
            if (SENSITIVE_KEY_PATTERN.test(key)) {
                return [key, REDACTED];
            }
            return [key, redactValue(nestedValue)];
        }));
    }

    return value;
};

const normalizeMessage = (message, payload) => {
    if (payload === undefined) return message;
    return `${message}\n${safeInspect(redactValue(payload))}`;
};

const appendLine = (line) => {
    if (!enabled || !sessionFilePath) return;
    fs.appendFileSync(sessionFilePath, `${line}\n`, 'utf8');
};

const log = (level, event, payload) => {
    if (!enabled) return;
    appendLine(`[${timestamp()}] [${level}] ${normalizeMessage(event, payload)}`);
};

const patchConsole = () => {
    if (!enabled || consolePatched) return;

    originalConsole = {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        info: console.info.bind(console),
    };

    ['log', 'warn', 'error', 'info'].forEach((methodName) => {
        console[methodName] = (...args) => {
            const rendered = args.map((arg) => typeof arg === 'string' ? arg : safeInspect(redactValue(arg))).join(' ');
            appendLine(`[${timestamp()}] [console.${methodName}] ${rendered}`);
            originalConsole[methodName](...args);
        };
    });

    consolePatched = true;
};

const initSession = (metadata = {}) => {
    enabled = process.env.NODE_ENV !== 'production';
    if (!enabled) {
        return null;
    }

    ensureLogDirectory();
    sessionStartedAt = new Date();
    sessionFilePath = path.join(LOG_DIR, `${SESSION_PREFIX}-${sessionTimestamp()}.log`);
    fs.writeFileSync(sessionFilePath, '', 'utf8');
    patchConsole();

    log('INFO', 'Development debug session started', {
        pid: process.pid,
        cwd: process.cwd(),
        nodeEnv: process.env.NODE_ENV || 'development',
        metadata,
    });

    process.on('uncaughtException', (error) => {
        log('ERROR', 'Uncaught exception', {
            message: error.message,
            stack: error.stack,
        });
    });

    process.on('unhandledRejection', (reason) => {
        log('ERROR', 'Unhandled promise rejection', reason);
    });

    return sessionFilePath;
};

const requestLogger = () => (req, res, next) => {
    if (!enabled) {
        return next();
    }

    const startedAt = process.hrtime.bigint();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    log('HTTP', `Incoming request ${req.method} ${req.originalUrl}`, {
        requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        query: req.query,
        params: req.params,
        headers: redactValue({
            'content-type': req.headers['content-type'],
            origin: req.headers.origin,
            referer: req.headers.referer,
            authorization: req.headers.authorization,
            cookie: req.headers.cookie,
            'user-agent': req.headers['user-agent'],
        }),
        body: redactValue(req.body),
    });

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        log('HTTP', `Completed request ${req.method} ${req.originalUrl}`, {
            requestId,
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
        });
    });

    next();
};

const getLogFilePath = () => sessionFilePath;
const isEnabled = () => enabled;

module.exports = {
    initSession,
    requestLogger,
    log,
    getLogFilePath,
    isEnabled,
    redactValue,
};
