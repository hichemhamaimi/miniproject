import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { FiAlertTriangle, FiArrowDown, FiArrowUp, FiCheckCircle, FiCircle, FiDownload, FiFlag, FiLock, FiPlayCircle, FiRotateCcw } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../utils/runtimeConfig';

const AUTO_SUBMIT_RETRY_DELAYS_MS = [1000, 2500, 5000, 10000, 15000];
const AUTO_SUBMIT_TIMEOUT_MS = 60_000;
const MANUAL_SUBMIT_TIMEOUT_MS = 60_000;

const createSubmitAttemptId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const getSebExitPath = (examId) => `/student/exams/${examId}/seb-exit`;

const getStoredSebToken = (examId) => {
    const queryToken = new URLSearchParams(window.location.search).get('sebToken');
    if (queryToken) {
        window.sessionStorage.setItem(`sebToken:${examId}`, queryToken);
        return queryToken;
    }
    return window.sessionStorage.getItem(`sebToken:${examId}`) || '';
};

const getStoredAuthTransferToken = (examId) => {
    const queryToken = new URLSearchParams(window.location.search).get('authTransfer');
    if (queryToken) {
        window.sessionStorage.setItem(`sebAuthTransfer:${examId}`, queryToken);
        return queryToken;
    }
    return window.sessionStorage.getItem(`sebAuthTransfer:${examId}`) || '';
};

const TakeExam = () => {
    const { examId } = useParams();
    const navigate = useNavigate();
    const { login, user } = useAuth();

    const [exam, setExam] = useState(null);
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSEBBlocked, setIsSEBBlocked] = useState(false);
    const [sebMessage, setSebMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState('');
    const [isLocked, setIsLocked] = useState(false);
    const [starting, setStarting] = useState(false);
    const [sebLaunchReady, setSebLaunchReady] = useState(false);
    const [authBootstrapPending, setAuthBootstrapPending] = useState(false);

    const [remainingTime, setRemainingTime] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [flaggedQuestions, setFlaggedQuestions] = useState({});
    const socketRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const autoSubmitRetryTimersRef = useRef([]);
    const answersRef = useRef({});
    const submittingRef = useRef(false);
    const submittedRef = useRef(false);
    const lockAndAutoSubmitRef = useRef(null);
    const sebTokenRef = useRef(getStoredSebToken(examId));
    const authTransferTokenRef = useRef(getStoredAuthTransferToken(examId));

    const isProtectedEntry = useMemo(() => Boolean(sebTokenRef.current), [examId]);

    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    const formatTime = (ms) => {
        if (ms <= 0) return '00:00:00';
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleDownloadSeb = useCallback(async () => {
        try {
            const response = await axiosInstance.get(`/student/exams/${examId}/seb`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            let filename = `exam_${examId}.seb`;
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch.length === 2) {
                    filename = filenameMatch[1];
                }
            }

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading SEB file', err);
            alert(err.response?.data?.message || 'Failed to download SEB file.');
        }
    }, [examId]);

    const clearAutoSubmitRetryTimers = useCallback(() => {
        autoSubmitRetryTimersRef.current.forEach((timerId) => clearTimeout(timerId));
        autoSubmitRetryTimersRef.current = [];
    }, []);

    const startCountdown = useCallback((initialRemainingMs) => {
        const normalizedRemainingMs = Number(initialRemainingMs);
        if (!Number.isFinite(normalizedRemainingMs)) return;

        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        const safeRemainingMs = Math.max(0, normalizedRemainingMs);
        setRemainingTime(safeRemainingMs);

        if (safeRemainingMs <= 0) {
            lockAndAutoSubmitRef.current?.();
            return;
        }

        timerIntervalRef.current = setInterval(() => {
            setRemainingTime((prev) => {
                const nextValue = Math.max(0, (prev ?? 0) - 1000);
                if (nextValue <= 0) {
                    clearInterval(timerIntervalRef.current);
                    lockAndAutoSubmitRef.current?.();
                }
                return nextValue;
            });
        }, 1000);
    }, []);

    const initializeExamSession = useCallback((responseData) => {
        const examData = responseData.examData;
        const initialAnswers = {};
        examData.questions.forEach((q) => {
            if (q.type === 'ordering') {
                initialAnswers[q.id] = [];
            } else if (q.type === 'matching') {
                initialAnswers[q.id] = (q.matchingPairs || []).map((p) => ({ left: p.left || '', right: '' }));
            } else if (q.type === 'multiple_choice') {
                initialAnswers[q.id] = [];
            } else {
                initialAnswers[q.id] = null;
            }
        });
        answersRef.current = initialAnswers;
        submittingRef.current = false;
        submittedRef.current = false;
        clearAutoSubmitRetryTimers();
        setAnswers(initialAnswers);
        setCurrentQuestionIndex(0);
        setFlaggedQuestions({});
        setExam(responseData);
        setIsLocked(false);
        setSubmitMessage('');
        startCountdown(responseData.remaining_ms);

        socketRef.current = io(getSocketUrl());

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join_exam', { examId, studentId: user.userId });
        });

        socketRef.current.on('timer_sync', (data) => {
            startCountdown(data.remainingMs);
        });

        socketRef.current.on('TIME_EXPIRED', () => {
            lockAndAutoSubmitRef.current?.();
        });
    }, [clearAutoSubmitRetryTimers, examId, startCountdown, user?.userId]);

    const startExamSession = useCallback(async () => {
        setStarting(true);
        setError(null);
        try {
            const headers = sebTokenRef.current
                ? { 'x-seb-access-token': sebTokenRef.current }
                : {};
            const res = await axiosInstance.post(`/student/exams/${examId}/start`, {}, { headers });
            setIsSEBBlocked(false);
            setSebLaunchReady(false);
            initializeExamSession(res.data);
        } catch (err) {
            console.error(err);
            const code = err.response?.data?.code;
            if (code === 'SEB_REQUIRED' || code === 'SEB_TOKEN_REQUIRED' || code === 'SEB_TOKEN_INVALID') {
                setIsSEBBlocked(true);
                setSebMessage(err.response?.data?.message || 'This exam must be opened from Safe Exam Browser.');
            } else {
                const fallbackError = err.response?.data?.message || err.response?.data?.error || err.toString();
                setError(`Failed to connect to exam session. Details: ${fallbackError}`);
            }
        } finally {
            setLoading(false);
            setStarting(false);
        }
    }, [examId, initializeExamSession]);

    const finishExamSession = useCallback((message) => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        window.sessionStorage.removeItem(`sebToken:${examId}`);
        window.sessionStorage.removeItem(`sebAuthTransfer:${examId}`);

        if (isProtectedEntry) {
            setSubmitMessage(`${message} Unlocking Safe Exam Browser...`);
            window.location.assign(getSebExitPath(examId));
            return;
        }

        alert(message);
        navigate('/student/dashboard?seb_quit=true');
    }, [examId, isProtectedEntry, navigate]);

    const submitExamPayload = useCallback(async (autoSubmit = false, attempt = 1) => {
        if (submittedRef.current) return;
        if (submittingRef.current) return;

        if (autoSubmit) {
            setIsLocked(true);
            setSubmitMessage(`Time is up. Auto-submitting your answers${attempt > 1 ? ` (attempt ${attempt})` : ''}...`);
        }

        submittingRef.current = true;
        setSubmitting(true);
        const submitAttemptId = createSubmitAttemptId();
        try {
            const submissionPayload = {
                answers: Object.entries(answersRef.current).map(([qId, ans]) => ({
                    questionId: qId,
                    answer: ans,
                })),
            };
            const submitSummary = {
                submitAttemptId,
                examId,
                autoSubmit,
                attempt,
                answerCount: submissionPayload.answers.length,
                answeredCount: submissionPayload.answers.filter((item) => {
                    if (Array.isArray(item.answer)) {
                        return item.answer.some((value) => {
                            if (value && typeof value === 'object') return Boolean(value.right || value.answer || value.value);
                            return value !== null && value !== undefined && value !== '';
                        });
                    }
                    return item.answer !== null && item.answer !== undefined && item.answer !== '';
                }).length,
                remainingTime,
            };
            console.info('[ExamSubmit] Sending submission', submitSummary);

            await axiosInstance.post(
                `/student/exams/${examId}/submit`,
                submissionPayload,
                {
                    headers: {
                        ...(autoSubmit ? { 'x-exam-auto-submit': 'true' } : {}),
                        ...(sebTokenRef.current ? { 'x-seb-access-token': sebTokenRef.current } : {}),
                        'x-submit-attempt-id': submitAttemptId,
                    },
                    timeout: autoSubmit ? AUTO_SUBMIT_TIMEOUT_MS : MANUAL_SUBMIT_TIMEOUT_MS,
                }
            );

            submittedRef.current = true;
            clearAutoSubmitRetryTimers();
            finishExamSession(autoSubmit
                ? 'Time is up! Your answers have been automatically submitted.'
                : 'Exam submitted successfully!');
        } catch (err) {
            console.error('[ExamSubmit] Submission failed', {
                submitAttemptId,
                examId,
                autoSubmit,
                attempt,
                status: err.response?.status,
                response: err.response?.data,
                code: err.code,
                message: err.message,
            });
            const status = err.response?.status;
            const serverMessage = err.response?.data?.message || '';
            const serverAttemptId = err.response?.data?.submitAttemptId || submitAttemptId;
            if (status === 409 || serverMessage.toLowerCase().includes('already submitted')) {
                submittedRef.current = true;
                finishExamSession('This exam session was already submitted.');
                return;
            }

            if (autoSubmit && attempt < AUTO_SUBMIT_RETRY_DELAYS_MS.length) {
                const retryDelay = AUTO_SUBMIT_RETRY_DELAYS_MS[attempt - 1];
                const failureReason = err.code === 'ECONNABORTED'
                    ? 'The server took too long to respond.'
                    : (err.response?.data?.error || err.response?.data?.message || 'The submission request failed.');
                setSubmitMessage(`${failureReason} Retrying in ${Math.ceil(retryDelay / 1000)} second(s)... Attempt ID: ${serverAttemptId}`);
                submittingRef.current = false;
                setSubmitting(false);
                const retryTimer = window.setTimeout(() => {
                    submitExamPayload(true, attempt + 1);
                }, retryDelay);
                autoSubmitRetryTimersRef.current.push(retryTimer);
                return;
            }

            if (autoSubmit) {
                const failureText = err.response?.data?.error || err.response?.data?.message || err.message || 'Unknown error.';
                setSubmitMessage(`Auto-submit could not complete. Keep this page open and check your connection; manual changes are locked. Attempt ID: ${serverAttemptId}. Error: ${failureText}`);
            } else {
                const failureText = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to submit exam.';
                alert(`Failed to submit exam. Attempt ID: ${serverAttemptId}. ${failureText}`);
            }
            submittingRef.current = false;
            setSubmitting(false);
        }
    }, [clearAutoSubmitRetryTimers, examId, finishExamSession, remainingTime]);

    useEffect(() => {
        lockAndAutoSubmitRef.current = () => {
            if (submittedRef.current) return;
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            setRemainingTime(0);
            setIsLocked(true);
            submitExamPayload(true);
        };
    }, [submitExamPayload]);

    const bootstrapSebSession = useCallback(async () => {
        if (!authTransferTokenRef.current) {
            setSebLaunchReady(true);
            setLoading(false);
            return;
        }

        setAuthBootstrapPending(true);
        try {
            const response = await axiosInstance.post('/auth/seb-exchange', {
                examId: Number(examId),
                transferToken: authTransferTokenRef.current,
            });
            login(response.data);
            window.sessionStorage.removeItem(`sebAuthTransfer:${examId}`);
            authTransferTokenRef.current = '';
            const url = new URL(window.location.href);
            url.searchParams.delete('authTransfer');
            window.history.replaceState({}, document.title, url.toString());
            setSebLaunchReady(true);
        } catch (err) {
            console.error('SEB auth bootstrap failed', err);
            setError(err.response?.data?.message || 'Failed to restore your student session inside Safe Exam Browser.');
        } finally {
            setAuthBootstrapPending(false);
            setLoading(false);
        }
    }, [examId, login]);

    useEffect(() => {
        if (isProtectedEntry) {
            bootstrapSebSession();
            return undefined;
        }

        startExamSession();

        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            clearAutoSubmitRetryTimers();
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [bootstrapSebSession, clearAutoSubmitRetryTimers, isProtectedEntry, startExamSession]);

    useEffect(() => () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        clearAutoSubmitRetryTimers();
        if (socketRef.current) socketRef.current.disconnect();
    }, [clearAutoSubmitRetryTimers]);

    const handleAnswerChange = (questionId, value) => {
        if (isLocked || submitting) return;
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
    };
    const handleToggleAnswer = (questionId, value) => {
        if (isLocked || submitting) return;
        setAnswers((prev) => ({ ...prev, [questionId]: prev[questionId] === value ? null : value }));
    };
    const handleMultipleChoiceChange = (questionId, optionStr, isChecked) => {
        if (isLocked || submitting) return;
        setAnswers((prev) => {
            const current = prev[questionId] || [];
            if (isChecked) return { ...prev, [questionId]: [...current, optionStr] };
            return { ...prev, [questionId]: current.filter((val) => val !== optionStr) };
        });
    };
    const handleMatchingChange = (questionId, leftItem, rightSelected) => {
        if (isLocked || submitting) return;
        setAnswers((prev) => {
            const current = prev[questionId] || [];
            const updated = current.map((pair) => pair.left === leftItem ? { ...pair, right: rightSelected } : pair);
            return { ...prev, [questionId]: updated };
        });
    };
    const clearAnswer = (questionId) => {
        if (isLocked || submitting) return;
        setAnswers((prev) => ({ ...prev, [questionId]: null }));
    };
    const clearMatchingAnswer = (questionId) => {
        if (isLocked || submitting) return;
        setAnswers((prev) => ({
            ...prev,
            [questionId]: (prev[questionId] || []).map((pair) => ({ ...pair, right: '' })),
        }));
    };
    const startOrderingAnswer = (questionId, orderedItems = []) => {
        if (isLocked || submitting) return;
        setAnswers((prev) => ({ ...prev, [questionId]: [...orderedItems] }));
    };
    const clearOrderingAnswer = (questionId) => {
        if (isLocked || submitting) return;
        setAnswers((prev) => ({ ...prev, [questionId]: [] }));
    };
    const moveOrderingItem = (questionId, index, direction) => {
        if (isLocked || submitting) return;
        setAnswers((prev) => {
            const arr = [...(prev[questionId] || [])];
            if (direction === 'up' && index > 0) [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
            else if (direction === 'down' && index < arr.length - 1) [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
            return { ...prev, [questionId]: arr };
        });
    };

    const questions = exam?.examData?.questions || [];
    const currentQuestion = questions[currentQuestionIndex] || questions[0] || null;
    const interactionDisabled = isLocked || submitting;

    const isQuestionAnswered = useCallback((question) => {
        if (!question) return false;
        const answer = answers[question.id];
        if (answer === null || answer === undefined || answer === '') return false;
        if (question.type === 'multiple_choice' || question.type === 'ordering') {
            return Array.isArray(answer) && answer.length > 0;
        }
        if (question.type === 'matching') {
            return Array.isArray(answer) && answer.some((pair) => String(pair?.right || '').trim() !== '');
        }
        return true;
    }, [answers]);

    const answeredCount = useMemo(
        () => questions.filter((question) => isQuestionAnswered(question)).length,
        [isQuestionAnswered, questions]
    );

    const flaggedCount = useMemo(
        () => questions.filter((question) => flaggedQuestions[question.id]).length,
        [flaggedQuestions, questions]
    );

    const goToQuestion = useCallback((index) => {
        setCurrentQuestionIndex(clamp(index, 0, Math.max(questions.length - 1, 0)));
    }, [questions.length]);

    const goToPreviousQuestion = useCallback(() => {
        setCurrentQuestionIndex((prev) => clamp(prev - 1, 0, Math.max(questions.length - 1, 0)));
    }, [questions.length]);

    const goToNextQuestion = useCallback(() => {
        setCurrentQuestionIndex((prev) => clamp(prev + 1, 0, Math.max(questions.length - 1, 0)));
    }, [questions.length]);

    const toggleFlaggedQuestion = useCallback((questionId) => {
        if (!questionId) return;
        setFlaggedQuestions((prev) => ({
            ...prev,
            [questionId]: !prev[questionId],
        }));
    }, []);

    useEffect(() => {
        if (currentQuestionIndex > Math.max(questions.length - 1, 0)) {
            setCurrentQuestionIndex(Math.max(questions.length - 1, 0));
        }
    }, [currentQuestionIndex, questions.length]);

    useEffect(() => {
        const handleKeyboardNavigation = (event) => {
            if (!exam || questions.length === 0) return;
            const tagName = event.target?.tagName;
            const isFormControl = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tagName) || event.target?.isContentEditable;
            if (isFormControl) return;

            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                event.preventDefault();
                goToNextQuestion();
            }
            if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                event.preventDefault();
                goToPreviousQuestion();
            }
        };

        window.addEventListener('keydown', handleKeyboardNavigation);
        return () => window.removeEventListener('keydown', handleKeyboardNavigation);
    }, [exam, goToNextQuestion, goToPreviousQuestion, questions.length]);

    const handleManualSubmit = () => {
        if (isLocked || submitting) return;
        if (!window.confirm('Are you sure you want to finish early? You cannot change your answers afterward.')) return;
        submitExamPayload(false);
    };

    if (isSEBBlocked) {
        return (
            <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-rose-50 text-rose-600 shadow-lg">
                    <FiLock className="text-4xl" />
                </div>
                <h1 className="mt-6 text-3xl font-extrabold text-slate-800">Safe Exam Browser Required</h1>
                <p className="mt-4 max-w-xl text-lg text-slate-600">
                    {sebMessage || 'This exam must be opened through Safe Exam Browser (SEB).'}
                </p>
                <div className="surface-card mt-8 w-full max-w-xl p-6 text-left">
                    <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-700"><FiAlertTriangle className="text-amber-500" /> Instructions</h3>
                    <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
                        <li>Stay in your normal browser for this step.</li>
                        <li>Download the <span className="rounded bg-slate-200 px-1 font-mono text-xs">.seb</span> configuration file.</li>
                        <li>Double-click the downloaded file to launch Safe Exam Browser.</li>
                        <li>Once SEB opens, click <strong>Start Exam</strong> from inside that protected window.</li>
                    </ol>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <button onClick={handleDownloadSeb} className="action-button">
                            <FiDownload />
                            <span>Download SEB File</span>
                        </button>
                        <button onClick={() => navigate('/student/dashboard')} className="ghost-button">
                            Back to dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (authBootstrapPending) {
        return (
            <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center p-6 text-center">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
                <h1 className="mt-6 text-3xl font-extrabold text-slate-800">Preparing your protected session</h1>
                <p className="mt-4 max-w-xl text-lg text-slate-600">
                    Safe Exam Browser is restoring your student session and verifying the secure launch token.
                </p>
            </div>
        );
    }

    if (sebLaunchReady && !exam) {
        return (
            <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center p-6 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-cyan-50 text-cyan-700 shadow-lg">
                    <FiLock className="text-4xl" />
                </div>
                <h1 className="mt-6 text-3xl font-extrabold text-slate-800">Safe Exam Browser ready</h1>
                <p className="mt-4 max-w-xl text-lg text-slate-600">
                    You opened the exam from the downloaded SEB configuration. Start the exam from this protected window when you are ready.
                </p>
                <div className="surface-card mt-8 w-full max-w-xl p-6 text-left">
                    <h3 className="text-lg font-bold text-slate-800">Before you start</h3>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        <li>Make sure your connection is stable.</li>
                        <li>Keep the Safe Exam Browser window open for the whole session.</li>
                        <li>Once started, SEB unlocks only after a successful submission or when the timer expires and auto-submit completes.</li>
                    </ul>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <button onClick={startExamSession} disabled={starting || authBootstrapPending} className="action-button">
                            <FiPlayCircle />
                            <span>{authBootstrapPending ? 'Restoring session...' : starting ? 'Starting...' : 'Start Exam'}</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) return <div className="flex justify-center p-12"><div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div></div>;
    if (error) return <div className="surface-card m-4 border-red-200 p-8 text-center font-bold text-red-500">{error}</div>;
    if (!exam) return <div className="surface-card m-4 p-8 text-center font-bold text-slate-500">Exam not available.</div>;

    const isTimeUrgent = remainingTime !== null && remainingTime < 300000;
    const currentQuestionAnswered = isQuestionAnswered(currentQuestion);
    const currentQuestionFlagged = Boolean(flaggedQuestions[currentQuestion?.id]);

    return (
        <div className="relative mx-auto min-h-[calc(100vh-7rem)] max-w-7xl pb-8">
            {remainingTime !== null && (
                <div className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-[22px] px-5 py-3 font-mono text-xl font-bold shadow-2xl transition-colors ${
                    isTimeUrgent ? 'animate-pulse bg-rose-600 text-white' : 'bg-slate-900 text-emerald-300'
                }`}>
                    <FiLock />
                    {formatTime(remainingTime)}
                </div>
            )}

            <header className="mb-5 rounded-[28px] border border-slate-200 bg-white/90 px-5 py-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="eyebrow !text-cyan-700">Exam Session</p>
                        <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{exam.title}</h1>
                        <p className="mt-1 text-sm font-medium text-slate-500">Question {currentQuestionIndex + 1} of {questions.length}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[24rem]">
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                            <span className="block text-lg font-extrabold text-emerald-700">{answeredCount}</span>
                            <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Answered</span>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <span className="block text-lg font-extrabold text-slate-700">{Math.max(questions.length - answeredCount, 0)}</span>
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Open</span>
                        </div>
                        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2">
                            <span className="block text-lg font-extrabold text-amber-700">{flaggedCount}</span>
                            <span className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Flagged</span>
                        </div>
                    </div>
                </div>
            </header>

            {(isLocked || submitMessage) && (
                <div className="mb-6 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    {submitMessage || 'This exam is locked. Answers can no longer be changed.'}
                </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[18rem,minmax(0,1fr)]">
                <aside className="surface-card h-fit p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)]">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-extrabold text-slate-900">Questions</h2>
                            <p className="text-xs font-semibold text-slate-500">Use the list or arrow keys.</p>
                        </div>
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">{questions.length}</span>
                    </div>
                    <div className="grid max-h-[18rem] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-8 lg:max-h-[calc(100vh-14rem)] lg:grid-cols-1">
                        {questions.map((question, index) => {
                            const answered = isQuestionAnswered(question);
                            const flagged = Boolean(flaggedQuestions[question.id]);
                            const active = index === currentQuestionIndex;
                            return (
                                <button
                                    key={question.id}
                                    type="button"
                                    onClick={() => goToQuestion(index)}
                                    className={`group flex min-h-[3rem] items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                                        active
                                            ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                                            : flagged
                                                ? 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300'
                                                : answered
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                    aria-current={active ? 'true' : undefined}
                                >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                                        active ? 'bg-white text-slate-900' : 'bg-white/80'
                                    }`}>
                                        {index + 1}
                                    </span>
                                    <span className="hidden min-w-0 flex-1 lg:block">
                                        <span className="block truncate text-sm font-bold">Question {index + 1}</span>
                                        <span className={`mt-0.5 flex items-center gap-1 text-xs font-semibold ${
                                            active ? 'text-slate-200' : flagged ? 'text-amber-700' : answered ? 'text-emerald-700' : 'text-slate-400'
                                        }`}>
                                            {flagged ? <FiFlag /> : answered ? <FiCheckCircle /> : <FiCircle />}
                                            {flagged ? 'Flagged' : answered ? 'Answered' : 'Not answered'}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-500">
                        <span className="flex items-center gap-2"><FiCheckCircle className="text-emerald-600" /> Answered</span>
                        <span className="flex items-center gap-2"><FiCircle className="text-slate-400" /> Not answered yet</span>
                        <span className="flex items-center gap-2"><FiFlag className="text-amber-600" /> Flagged for review</span>
                    </div>
                </aside>

                <main className="min-w-0">
                    {currentQuestion ? (
                        <div className="surface-card flex min-h-[34rem] flex-col p-5 md:p-8">
                            <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                                <div className="flex gap-4">
                                    <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl font-extrabold ${
                                        currentQuestionFlagged ? 'bg-amber-100 text-amber-700' : currentQuestionAnswered ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-900 text-white'
                                    }`}>{currentQuestionIndex + 1}</span>
                                    <div>
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            {currentQuestion.type === 'negative_qcm' && <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600">Select the incorrect statement</span>}
                                            {currentQuestion.type === 'multiple_choice' && <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Select all that apply</span>}
                                            {currentQuestionFlagged ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700"><FiFlag /> Flagged</span> : null}
                                            {currentQuestionAnswered ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><FiCheckCircle /> Answered</span> : <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500"><FiCircle /> Not answered</span>}
                                        </div>
                                        <h3 className="text-lg font-extrabold leading-snug text-slate-900 md:text-xl">{currentQuestion.text}</h3>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleFlaggedQuestion(currentQuestion.id)}
                                    disabled={interactionDisabled}
                                    className={`ghost-button shrink-0 !px-4 !py-2 ${currentQuestionFlagged ? '!border-amber-200 !bg-amber-50 !text-amber-700' : ''}`}
                                >
                                    <FiFlag />
                                    <span>{currentQuestionFlagged ? 'Unflag' : 'Flag'}</span>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-1">
                                <div className="mx-auto max-w-3xl">
                                    {(currentQuestion.type === 'single_choice' || currentQuestion.type === 'negative_qcm') && (
                                        <div className="space-y-3">
                                            {(currentQuestion.options || []).map((opt, i) => (
                                                <label key={i} className="surface-muted flex cursor-pointer items-center gap-3 p-4 transition hover:border-slate-300">
                                                    <input
                                                        type="radio" name={`q_${currentQuestion.id}`} value={opt} checked={answers[currentQuestion.id] === opt}
                                                        onClick={() => handleToggleAnswer(currentQuestion.id, opt)}
                                                        onChange={() => {}}
                                                        disabled={interactionDisabled}
                                                        className="h-5 w-5 text-cyan-600 focus:ring-cyan-500"
                                                    />
                                                    <span className="text-slate-700">{opt}</span>
                                                </label>
                                            ))}
                                            {answers[currentQuestion.id] ? (
                                                <button type="button" onClick={() => clearAnswer(currentQuestion.id)} disabled={interactionDisabled} className="ghost-button !px-4 !py-2">
                                                    <FiRotateCcw />
                                                    <span>Clear answer</span>
                                                </button>
                                            ) : null}
                                        </div>
                                    )}

                                    {currentQuestion.type === 'multiple_choice' && (
                                        <div className="space-y-3">
                                            {(currentQuestion.options || []).map((opt, i) => (
                                                <label key={i} className="surface-muted flex cursor-pointer items-center gap-3 p-4 transition hover:border-slate-300">
                                                    <input
                                                        type="checkbox" value={opt} checked={(answers[currentQuestion.id] || []).includes(opt)}
                                                        onChange={(e) => handleMultipleChoiceChange(currentQuestion.id, opt, e.target.checked)}
                                                        disabled={interactionDisabled}
                                                        className="h-5 w-5 rounded text-cyan-600 focus:ring-cyan-500"
                                                    />
                                                    <span className="text-slate-700">{opt}</span>
                                                </label>
                                            ))}
                                            {(answers[currentQuestion.id] || []).length > 0 ? (
                                                <button type="button" onClick={() => handleAnswerChange(currentQuestion.id, [])} disabled={interactionDisabled} className="ghost-button !px-4 !py-2">
                                                    <FiRotateCcw />
                                                    <span>Clear selections</span>
                                                </button>
                                            ) : null}
                                        </div>
                                    )}

                                    {currentQuestion.type === 'true_false' && (
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {['true', 'false'].map((opt) => (
                                                <label key={opt} className="surface-muted flex cursor-pointer items-center justify-center gap-3 p-5 transition hover:border-slate-300">
                                                    <input
                                                        type="radio" name={`q_${currentQuestion.id}`} value={opt === 'true'} checked={answers[currentQuestion.id] === (opt === 'true')}
                                                        onClick={() => handleToggleAnswer(currentQuestion.id, opt === 'true')}
                                                        onChange={() => {}}
                                                        disabled={interactionDisabled}
                                                        className="h-5 w-5 text-cyan-600 focus:ring-cyan-500"
                                                    />
                                                    <span className="font-bold uppercase text-slate-800">{opt}</span>
                                                </label>
                                            ))}
                                            {answers[currentQuestion.id] !== null && answers[currentQuestion.id] !== undefined ? (
                                                <button type="button" onClick={() => clearAnswer(currentQuestion.id)} disabled={interactionDisabled} className="ghost-button !px-4 !py-2 md:col-span-2">
                                                    <FiRotateCcw />
                                                    <span>Clear answer</span>
                                                </button>
                                            ) : null}
                                        </div>
                                    )}

                                    {currentQuestion.type === 'matching' && (
                                        <div className="space-y-4">
                                            {(currentQuestion.matchingPairs || []).map((pair, i) => (
                                                <div key={i} className="surface-muted flex flex-col gap-4 p-4 md:flex-row md:items-center">
                                                    <div className="flex-1 font-semibold text-slate-700">{pair.left}</div>
                                                    <select
                                                        className="select-field flex-1"
                                                        value={(answers[currentQuestion.id] || []).find((p) => p.left === pair.left)?.right || ''}
                                                        onChange={(e) => handleMatchingChange(currentQuestion.id, pair.left, e.target.value)}
                                                        disabled={interactionDisabled}
                                                    >
                                                        <option value="">-- Match with... --</option>
                                                        {[...(currentQuestion.matchingPairs || [])].sort((a, b) => (a.right || '').localeCompare(b.right || '')).map((p, ri) => (
                                                            <option key={ri} value={p.right}>{p.right}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ))}
                                            {(answers[currentQuestion.id] || []).some((pair) => pair.right) ? (
                                                <button type="button" onClick={() => clearMatchingAnswer(currentQuestion.id)} disabled={interactionDisabled} className="ghost-button !px-4 !py-2">
                                                    <FiRotateCcw />
                                                    <span>Clear matches</span>
                                                </button>
                                            ) : null}
                                        </div>
                                    )}

                                    {currentQuestion.type === 'ordering' && (
                                        <div className="space-y-3">
                                            {(answers[currentQuestion.id] || []).length === 0 ? (
                                                <div className="surface-muted flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                                    <span className="text-sm font-semibold text-slate-600">No order selected.</span>
                                                    <button type="button" onClick={() => startOrderingAnswer(currentQuestion.id, currentQuestion.orderedItems || [])} disabled={interactionDisabled} className="ghost-button !px-4 !py-2">
                                                        <span>Start ordering</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    {(answers[currentQuestion.id] || []).map((item, i) => (
                                                        <div key={i} className="surface-muted flex items-center gap-4 px-4 py-3">
                                                            <span className="w-6 text-center font-bold text-slate-400">{i + 1}.</span>
                                                            <div className="flex-1 font-medium text-slate-800">{item}</div>
                                                            <div className="flex flex-col gap-1">
                                                                <button onClick={() => moveOrderingItem(currentQuestion.id, i, 'up')} disabled={interactionDisabled || i === 0} className="ghost-button !rounded-xl !px-2 !py-2 disabled:opacity-30">
                                                                    <FiArrowUp size={12} />
                                                                </button>
                                                                <button onClick={() => moveOrderingItem(currentQuestion.id, i, 'down')} disabled={interactionDisabled || i === (answers[currentQuestion.id]?.length || 0) - 1} className="ghost-button !rounded-xl !px-2 !py-2 disabled:opacity-30">
                                                                    <FiArrowDown size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={() => clearOrderingAnswer(currentQuestion.id)} disabled={interactionDisabled} className="ghost-button !px-4 !py-2">
                                                        <FiRotateCcw />
                                                        <span>Clear order</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <button type="button" onClick={goToPreviousQuestion} disabled={currentQuestionIndex === 0} className="ghost-button disabled:cursor-not-allowed disabled:opacity-40">
                                    <FiArrowUp />
                                    <span>Previous</span>
                                </button>
                                <div className="text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                                    Arrow up/down also navigates
                                </div>
                                <button type="button" onClick={goToNextQuestion} disabled={currentQuestionIndex === questions.length - 1} className="secondary-button disabled:cursor-not-allowed disabled:opacity-40">
                                    <FiArrowDown />
                                    <span>Next</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="surface-card p-8 text-center font-bold text-slate-500">No questions available.</div>
                    )}

                    <div className="sticky bottom-6 z-10 mt-5 flex flex-col gap-4 rounded-[28px] border border-slate-800 bg-slate-900 p-5 text-white shadow-2xl lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-sm">
                            <span className="mb-1 block font-bold">Review flagged and unanswered questions before submitting.</span>
                            <span className="text-slate-300">Exams are collected automatically when time expires.</span>
                        </div>
                        <button onClick={handleManualSubmit} disabled={interactionDisabled} className="secondary-button">
                            {submitting ? 'Submitting...' : isLocked ? 'Exam Locked' : 'Finish Exam Early'}
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TakeExam;
