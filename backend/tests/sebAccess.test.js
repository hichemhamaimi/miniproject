const test = require('node:test');
const assert = require('node:assert/strict');

const runtimeConfigPath = require.resolve('../config/runtime.config');
const sebAccessPath = require.resolve('../utils/sebAccess');

const loadSebAccess = () => {
    delete require.cache[sebAccessPath];
    delete require.cache[runtimeConfigPath];
    return require('../utils/sebAccess');
};

test('SEB access token round-trip validates matching exam and student', () => {
    process.env.ACCESS_TOKEN_SECRET = 'test-secret';
    process.env.SEB_TOKEN_SECRET = 'test-seb-secret';
    const { generateSebAccessToken, verifySebAccessToken } = loadSebAccess();

    const token = generateSebAccessToken({ examId: 42, studentId: 7 });
    const result = verifySebAccessToken(token, { examId: 42, studentId: 7 });

    assert.equal(result.valid, true);
    assert.equal(result.payload.examId, 42);
    assert.equal(result.payload.studentId, 7);
});

test('SEB access token rejects mismatched student', () => {
    process.env.ACCESS_TOKEN_SECRET = 'test-secret';
    process.env.SEB_TOKEN_SECRET = 'test-seb-secret';
    const { generateSebAccessToken, verifySebAccessToken } = loadSebAccess();

    const token = generateSebAccessToken({ examId: 42, studentId: 7 });
    const result = verifySebAccessToken(token, { examId: 42, studentId: 8 });

    assert.equal(result.valid, false);
    assert.match(result.reason, /student/i);
});
