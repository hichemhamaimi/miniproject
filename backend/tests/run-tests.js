const assert = require('node:assert/strict');

const runtimeConfigPath = require.resolve('../config/runtime.config');
const sebAccessPath = require.resolve('../utils/sebAccess');
const { AUTO_SUBMIT_GRACE_MS, canFinalizeExpiredSession } = require('../utils/examSession');
const { gradeExam } = require('../services/gradingService');

const loadSebAccess = () => {
    delete require.cache[sebAccessPath];
    delete require.cache[runtimeConfigPath];
    return require('../utils/sebAccess');
};

const tests = [
    {
        name: 'SEB token round-trip validates matching exam and student',
        run() {
            process.env.ACCESS_TOKEN_SECRET = 'test-secret';
            process.env.SEB_TOKEN_SECRET = 'test-seb-secret';
            const { generateSebAccessToken, verifySebAccessToken } = loadSebAccess();

            const token = generateSebAccessToken({ examId: 42, studentId: 7 });
            const result = verifySebAccessToken(token, { examId: 42, studentId: 7 });

            assert.equal(result.valid, true);
            assert.equal(result.payload.examId, 42);
            assert.equal(result.payload.studentId, 7);
        },
    },
    {
        name: 'SEB token rejects mismatched student',
        run() {
            process.env.ACCESS_TOKEN_SECRET = 'test-secret';
            process.env.SEB_TOKEN_SECRET = 'test-seb-secret';
            const { generateSebAccessToken, verifySebAccessToken } = loadSebAccess();

            const token = generateSebAccessToken({ examId: 42, studentId: 7 });
            const result = verifySebAccessToken(token, { examId: 42, studentId: 8 });

            assert.equal(result.valid, false);
            assert.match(result.reason, /student/i);
        },
    },
    {
        name: 'expired sessions can be finalized during the auto-submit grace window',
        run() {
            const now = Date.now();
            const session = {
                status: 'EXPIRED',
                end_time: new Date(now - 5_000).toISOString(),
            };

            assert.equal(canFinalizeExpiredSession(session, true, now), true);
        },
    },
    {
        name: 'expired sessions are rejected after the grace window',
        run() {
            const now = Date.now();
            const session = {
                status: 'EXPIRED',
                end_time: new Date(now - AUTO_SUBMIT_GRACE_MS - 1_000).toISOString(),
            };

            assert.equal(canFinalizeExpiredSession(session, true, now), false);
        },
    },
    {
        name: 'manual submissions do not bypass expired session rules',
        run() {
            const now = Date.now();
            const session = {
                status: 'EXPIRED',
                end_time: new Date(now - 5_000).toISOString(),
            };

            assert.equal(canFinalizeExpiredSession(session, false, now), false);
        },
    },
    {
        name: 'blank matching answers are treated as unanswered',
        run() {
            const result = gradeExam({
                examData: {
                    scoringDefaults: { correct: 1, incorrect: -0.5, unanswered: 0 },
                    questions: [{
                        id: 'q1',
                        type: 'matching',
                        matchingPairs: [{ left: 'A', right: '1' }, { left: 'B', right: '2' }],
                    }],
                },
            }, [{
                questionId: 'q1',
                answer: [{ left: 'A', right: '' }, { left: 'B', right: '' }],
            }]);

            assert.equal(result.totalScore, 0);
            assert.equal(result.gradedQuestions[0].studentAnswer.length, 2);
        },
    },
    {
        name: 'empty ordering answers are treated as unanswered',
        run() {
            const result = gradeExam({
                examData: {
                    scoringDefaults: { correct: 1, incorrect: -0.5, unanswered: 0 },
                    questions: [{
                        id: 'q1',
                        type: 'ordering',
                        orderedItems: ['A', 'B', 'C'],
                    }],
                },
            }, [{
                questionId: 'q1',
                answer: [],
            }]);

            assert.equal(result.totalScore, 0);
            assert.equal(result.gradedQuestions[0].studentAnswer.length, 0);
        },
    },
];

let failed = false;

tests.forEach((testCase) => {
    try {
        testCase.run();
        console.log(`PASS ${testCase.name}`);
    } catch (error) {
        failed = true;
        console.error(`FAIL ${testCase.name}`);
        console.error(error);
    }
});

if (failed) {
    process.exitCode = 1;
} else {
    console.log(`All ${tests.length} backend checks passed.`);
}
