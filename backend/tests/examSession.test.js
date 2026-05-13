const test = require('node:test');
const assert = require('node:assert/strict');

const { AUTO_SUBMIT_GRACE_MS, canFinalizeExpiredSession } = require('../utils/examSession');

test('expired sessions can be finalized during the auto-submit grace window', () => {
    const now = Date.now();
    const session = {
        status: 'EXPIRED',
        end_time: new Date(now - 5_000).toISOString(),
    };

    assert.equal(canFinalizeExpiredSession(session, true, now), true);
});

test('expired sessions are rejected after the grace window', () => {
    const now = Date.now();
    const session = {
        status: 'EXPIRED',
        end_time: new Date(now - AUTO_SUBMIT_GRACE_MS - 1_000).toISOString(),
    };

    assert.equal(canFinalizeExpiredSession(session, true, now), false);
});

test('manual submissions do not bypass expired session rules', () => {
    const now = Date.now();
    const session = {
        status: 'EXPIRED',
        end_time: new Date(now - 5_000).toISOString(),
    };

    assert.equal(canFinalizeExpiredSession(session, false, now), false);
});
