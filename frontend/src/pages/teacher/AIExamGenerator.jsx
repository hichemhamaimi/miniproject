import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiCheckCircle, FiClock, FiLoader, FiRefreshCw } from 'react-icons/fi';
import axiosInstance from '../../utils/axiosInstance';

const POLL_INTERVAL_MS = 3000;

const StatusStep = ({ label, active, done, icon }) => (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
        active
            ? 'border-cyan-300 bg-cyan-50'
            : done
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-slate-200 bg-slate-50'
    }`}>
        <div className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${
            active
                ? 'bg-cyan-600 text-white'
                : done
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white text-slate-400'
        }`}>
            {icon}
        </div>
        <span className={`text-sm font-semibold ${
            active
                ? 'text-cyan-800'
                : done
                    ? 'text-emerald-700'
                    : 'text-slate-500'
        }`}>
            {label}
        </span>
    </div>
);

const AIExamGenerator = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const pollRef = useRef(null);
    const autoStartedRef = useRef(false);
    const { blueprintId, jobId: initialJobId, moduleId, workflowSummary } = location.state || {};

    const [jobId, setJobId] = useState(initialJobId || null);
    const [jobStatus, setJobStatus] = useState(initialJobId ? 'queued' : 'idle');
    const [resultExamId, setResultExamId] = useState(null);
    const [error, setError] = useState('');
    const [aiOptions, setAiOptions] = useState({ llmProviders: [], defaultLlmProviderId: null });
    const [selectedExamProviderConfigId, setSelectedExamProviderConfigId] = useState('');
    const [loadingAiOptions, setLoadingAiOptions] = useState(false);

    useEffect(() => {
        let active = true;

        const loadProviderChoice = async () => {
            if (!blueprintId) return;
            setLoadingAiOptions(true);
            try {
                const [optionsResponse, blueprintResponse] = await Promise.all([
                    axiosInstance.get('/teacher/ai-options'),
                    axiosInstance.get(`/teacher/blueprints/${blueprintId}`),
                ]);
                if (!active) return;

                const options = optionsResponse.data || { llmProviders: [], defaultLlmProviderId: null };
                const savedProviderId = blueprintResponse.data?.generationContext?.examProviderConfigId;
                setAiOptions(options);
                setSelectedExamProviderConfigId(savedProviderId ? String(savedProviderId) : (options.defaultLlmProviderId ? String(options.defaultLlmProviderId) : ''));
            } catch {
                if (active) {
                    setAiOptions({ llmProviders: [], defaultLlmProviderId: null });
                }
            } finally {
                if (active) {
                    setLoadingAiOptions(false);
                }
            }
        };

        loadProviderChoice();
        return () => {
            active = false;
        };
    }, [blueprintId]);

    const selectedExamProvider = aiOptions.llmProviders.find((provider) => (
        String(provider.id) === String(selectedExamProviderConfigId)
    ));

    const startGeneration = useCallback(async ({ includeProviderOverride = false } = {}) => {
        if (!blueprintId) {
            setError('No blueprint was provided for generation.');
            setJobStatus('failed');
            return;
        }

        try {
            setError('');
            setJobStatus('queued');
            const payload = { blueprintId };
            if (includeProviderOverride) {
                payload.examProviderConfigId = selectedExamProviderConfigId ? Number(selectedExamProviderConfigId) : null;
            }
            const response = await axiosInstance.post('/teacher/ai-exams/generate', payload);
            setJobId(response.data.jobId);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Failed to start exam generation.');
            setJobStatus('failed');
        }
    }, [blueprintId, selectedExamProviderConfigId]);

    const pollStatus = useCallback(async (activeJobId) => {
        try {
            const response = await axiosInstance.get(`/teacher/ai-exams/job/${activeJobId}`);
            const { status, resultExamId: generatedExamId, error: jobError } = response.data;
            setJobStatus(status);

            if (status === 'done' && generatedExamId) {
                setResultExamId(generatedExamId);
                window.clearInterval(pollRef.current);
            }

            if (status === 'failed') {
                setError(jobError || 'Generation failed.');
                window.clearInterval(pollRef.current);
            }
        } catch {
            // Keep polling quietly unless the job itself fails.
        }
    }, []);

    useEffect(() => {
        if (!initialJobId && blueprintId && !autoStartedRef.current) {
            autoStartedRef.current = true;
            startGeneration();
        }
    }, [blueprintId, initialJobId, startGeneration]);

    useEffect(() => {
        if (!jobId) return undefined;

        pollStatus(jobId);
        pollRef.current = window.setInterval(() => {
            pollStatus(jobId);
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(pollRef.current);
    }, [jobId, pollStatus]);

    const isQueued = jobStatus === 'queued';
    const isProcessing = jobStatus === 'processing';
    const isDone = jobStatus === 'done';
    const isFailed = jobStatus === 'failed';

    return (
        <div className="mx-auto max-w-3xl space-y-8 pb-16">
            <header className="page-hero">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="eyebrow">Generation</p>
                        <h1 className="page-title">Building the exam draft</h1>
                        <p className="page-subtitle">
                            The system is generating the draft that will feed Step 6, where the teacher can review, edit, and publish the final exam.
                        </p>
                    </div>
                    {moduleId ? (
                        <Link to={`/teacher/exam-workflow/${moduleId}`} className="ghost-button !border-white/20 !bg-white/10 !text-white hover:!bg-white/20">
                            Back to workflow
                        </Link>
                    ) : null}
                </div>

                {workflowSummary ? (
                    <div className="mt-6 grid gap-3 md:grid-cols-3">
                        <div className="rounded-[24px] border border-white/15 bg-white/10 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Module</p>
                            <p className="mt-2 text-sm font-semibold text-white">{workflowSummary.moduleName}</p>
                        </div>
                        <div className="rounded-[24px] border border-white/15 bg-white/10 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Questions</p>
                            <p className="mt-2 text-sm font-semibold text-white">{workflowSummary.totalQuestions}</p>
                        </div>
                        <div className="rounded-[24px] border border-white/15 bg-white/10 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Selected topics</p>
                            <p className="mt-2 text-sm font-semibold text-white">{workflowSummary.selectedTopicCount}</p>
                        </div>
                    </div>
                ) : null}
            </header>

            <div className="surface-card p-8">
                <div className="space-y-4">
                    <StatusStep
                        done={isProcessing || isDone}
                        active={isQueued}
                        label="Job queued and waiting for the worker"
                        icon={<FiClock />}
                    />
                    <StatusStep
                        done={isDone}
                        active={isProcessing}
                        label="Generating questions and assembling the draft"
                        icon={<FiLoader className={isProcessing ? 'animate-spin' : ''} />}
                    />
                    <StatusStep
                        done={isDone}
                        active={false}
                        label="Saving the draft and preparing review"
                        icon={<FiCheckCircle />}
                    />
                </div>

                {isFailed ? (
                    <div className="mt-6 rounded-[24px] border border-rose-200 bg-rose-50 p-5">
                        <div className="flex items-start gap-3">
                            <FiAlertCircle className="mt-0.5 text-xl text-rose-500" />
                            <div className="flex-1">
                                <p className="font-bold text-rose-700">Generation failed</p>
                                <p className="mt-1 text-sm text-rose-600">{error}</p>
                                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr,auto] lg:items-end">
                                    <div>
                                        <label className="label-text !text-rose-700">LLM for retry</label>
                                        <select
                                            className="select-field !border-rose-200 !bg-white"
                                            value={selectedExamProviderConfigId}
                                            onChange={(event) => setSelectedExamProviderConfigId(event.target.value)}
                                            disabled={loadingAiOptions}
                                        >
                                            <option value="">System default</option>
                                            {aiOptions.llmProviders.map((provider) => (
                                                <option key={`retry-exam-${provider.id}`} value={provider.id}>
                                                    {provider.label} | {provider.model_name}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="mt-2 text-xs font-medium text-rose-600">
                                            {selectedExamProvider
                                                ? `${selectedExamProvider.provider_name} | ${selectedExamProvider.model_name}`
                                                : 'The retry will use the system default LLM.'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => startGeneration({ includeProviderOverride: true })}
                                        className="danger-button !rounded-xl !px-5 !py-3"
                                    >
                                        <FiRefreshCw />
                                        <span>Retry generation</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {isDone && resultExamId ? (
                    <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-6 text-center">
                        <FiCheckCircle className="mx-auto text-5xl text-emerald-500" />
                        <p className="mt-4 text-xl font-extrabold text-emerald-800">Draft created successfully</p>
                        <p className="mt-2 text-sm text-emerald-700">Continue to Step 6 to review questions, correct answers, and marks before publishing.</p>
                        <button
                            type="button"
                            onClick={() => navigate(`/teacher/ai-exam-review/${resultExamId}`, {
                                state: {
                                    moduleId,
                                    fromWorkflow: true,
                                },
                            })}
                            className="secondary-button mt-5"
                        >
                            <span>Open review step</span>
                        </button>
                    </div>
                ) : null}

                {!isFailed && !isDone ? (
                    <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                        <p>This usually takes between 30 and 90 seconds depending on the requested exam size.</p>
                        <p className="mt-1 font-mono text-xs text-slate-400">Job ID: {jobId || 'pending'}</p>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default AIExamGenerator;
