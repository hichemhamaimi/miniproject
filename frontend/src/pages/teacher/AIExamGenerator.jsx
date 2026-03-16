import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { FiCpu, FiCheckCircle, FiAlertCircle, FiLoader, FiClock } from 'react-icons/fi';

const POLL_INTERVAL_MS = 3000;

const StatusStep = ({ active, done, label, icon }) => (
    <div className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${active ? 'bg-violet-50 border-2 border-violet-400' : done ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-100'}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0
            ${active ? 'bg-violet-600 text-white animate-pulse' : done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
            {icon}
        </div>
        <span className={`font-semibold text-sm ${active ? 'text-violet-800' : done ? 'text-emerald-700' : 'text-slate-500'}`}>{label}</span>
    </div>
);

const AIExamGenerator = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { blueprintId, jobId: initJobId } = location.state || {};

    const [jobId, setJobId] = useState(initJobId || null);
    const [jobStatus, setJobStatus] = useState('idle');
    const [error, setError] = useState('');
    const [resultExamId, setResultExamId] = useState(null);
    const pollRef = useRef(null);

    const startGeneration = useCallback(async () => {
        if (!blueprintId) { setError('No blueprint ID provided.'); return; }
        try {
            setJobStatus('queued');
            const res = await axiosInstance.post('/teacher/ai-exams/generate', { blueprintId });
            setJobId(res.data.jobId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to start generation.');
            setJobStatus('failed');
        }
    }, [blueprintId]);

    const pollStatus = useCallback(async (id) => {
        try {
            const res = await axiosInstance.get(`/teacher/ai-exams/job/${id}`);
            const { status, resultExamId: rid, error: jobErr } = res.data;
            setJobStatus(status);
            if (status === 'done' && rid) {
                setResultExamId(rid);
                clearInterval(pollRef.current);
            }
            if (status === 'failed') {
                setError(jobErr || 'Generation failed.');
                clearInterval(pollRef.current);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        if (!initJobId && blueprintId) { startGeneration(); }
        else if (initJobId) { setJobStatus('queued'); }
    }, []);

    useEffect(() => {
        if (!jobId) return;
        pollRef.current = setInterval(() => pollStatus(jobId), POLL_INTERVAL_MS);
        return () => clearInterval(pollRef.current);
    }, [jobId, pollStatus]);

    const isQueued = jobStatus === 'queued';
    const isProcessing = jobStatus === 'processing';
    const isDone = jobStatus === 'done';
    const isFailed = jobStatus === 'failed';

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-16">
            <header className="bg-gradient-to-r from-violet-700 to-indigo-700 p-8 rounded-3xl shadow-xl text-white text-center">
                <FiCpu className="text-5xl mx-auto mb-4 opacity-80 animate-pulse" />
                <h1 className="text-3xl font-extrabold">AI Exam Generator</h1>
                <p className="text-indigo-200 mt-2">Your exam is being crafted by AI…</p>
            </header>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 space-y-4">
                <StatusStep
                    done={isProcessing || isDone}
                    active={isQueued}
                    label="Job queued — waiting for worker"
                    icon={<FiClock />}
                />
                <StatusStep
                    done={isDone}
                    active={isProcessing}
                    label="LLM generating questions…"
                    icon={<FiLoader className={isProcessing ? 'animate-spin' : ''} />}
                />
                <StatusStep
                    done={isDone}
                    active={false}
                    label="Validating & saving exam draft"
                    icon={<FiCheckCircle />}
                />

                {isFailed && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-200 mt-4">
                        <FiAlertCircle className="text-red-500 text-xl flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-red-700">Generation Failed</p>
                            <p className="text-sm text-red-600 mt-1">{error}</p>
                            <button onClick={startGeneration} className="mt-3 bg-red-600 text-white text-sm px-5 py-2 rounded-xl font-bold hover:bg-red-700 transition">
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                {isDone && resultExamId && (
                    <div className="flex flex-col items-center gap-4 p-6 bg-emerald-50 rounded-2xl border border-emerald-200 mt-4 text-center">
                        <FiCheckCircle className="text-5xl text-emerald-500" />
                        <p className="font-bold text-emerald-800 text-lg">Exam Generated Successfully!</p>
                        <p className="text-sm text-emerald-600">Review and edit your exam before publishing.</p>
                        <button
                            onClick={() => navigate(`/teacher/ai-exam-review/${resultExamId}`)}
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all"
                        >
                            Review & Edit Exam →
                        </button>
                    </div>
                )}

                {!isFailed && !isDone && (
                    <div className="text-center mt-4 text-sm text-slate-400">
                        <p>This may take 30–90 seconds depending on the exam size.</p>
                        <p className="mt-1 font-mono text-xs">Job ID: {jobId || '…'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIExamGenerator;
