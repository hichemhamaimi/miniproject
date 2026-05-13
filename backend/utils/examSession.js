const AUTO_SUBMIT_GRACE_MS = 5 * 60 * 1000;

const getSessionDeadlineMs = (session, examMeta) => {
    const startMs = new Date(session?.start_time).getTime();
    const durationMinutes = Number(examMeta?.duration_minutes);

    if (Number.isNaN(startMs) || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return null;
    }

    const durationDeadlineMs = startMs + (durationMinutes * 60 * 1000);
    const examEndMs = examMeta?.end_time ? new Date(examMeta.end_time).getTime() : null;

    if (examEndMs && !Number.isNaN(examEndMs)) {
        return Math.min(durationDeadlineMs, examEndMs);
    }

    return durationDeadlineMs;
};

const getRemainingSessionMs = (session, examMeta, now = Date.now()) => {
    const deadlineMs = getSessionDeadlineMs(session, examMeta);
    if (!deadlineMs) {
        return null;
    }

    return Math.max(0, deadlineMs - now);
};

const canFinalizeExpiredSession = (session, isAutoSubmitRequest, now = Date.now()) => {
    if (!isAutoSubmitRequest || !session || session.status !== 'EXPIRED' || !session.end_time) {
        return false;
    }

    const finalizedAt = new Date(session.end_time).getTime();
    if (Number.isNaN(finalizedAt)) {
        return false;
    }

    return (now - finalizedAt) <= AUTO_SUBMIT_GRACE_MS;
};

const canAutoSubmitAfterDeadline = (session, examMeta, isAutoSubmitRequest, now = Date.now()) => {
    if (!isAutoSubmitRequest) {
        return false;
    }

    const deadlineMs = getSessionDeadlineMs(session, examMeta);
    if (!deadlineMs) {
        return false;
    }

    return now <= deadlineMs + AUTO_SUBMIT_GRACE_MS;
};

module.exports = {
    AUTO_SUBMIT_GRACE_MS,
    getSessionDeadlineMs,
    getRemainingSessionMs,
    canFinalizeExpiredSession,
    canAutoSubmitAfterDeadline,
};
