import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCpu, FiHelpCircle } from 'react-icons/fi';
import axiosInstance from '../../utils/axiosInstance';
import Tooltip from '../../components/teacher/Tooltip';

const LLMSettings = () => {
    const [options, setOptions] = useState({ llmProviders: [], embeddingProvider: null });
    const [error, setError] = useState('');

    useEffect(() => {
        axiosInstance.get('/teacher/ai-options')
            .then((response) => setOptions(response.data))
            .catch((loadError) => setError(loadError.response?.data?.message || 'Failed to load AI options.'));
    }, []);

    return (
        <div className="mx-auto max-w-5xl space-y-8 pb-20">
            <header className="page-hero">
                <p className="eyebrow">Teacher AI Settings</p>
                <h1 className="page-title">Provider management now lives with the superadmin</h1>
                <p className="page-subtitle">
                    Teachers choose the LLM for mindmaps and exam generation directly inside the guided workflow. The platform provider catalog and embedding service are managed globally.
                </p>
            </header>

            {error ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>
            ) : null}

            <section className="grid gap-6 lg:grid-cols-2">
                <div className="surface-card p-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                            <FiCpu className="text-xl" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Available LLMs</h2>
                            <p className="text-sm text-slate-500">These are selectable inside the teacher exam workflow.</p>
                        </div>
                    </div>
                    <div className="mt-5 space-y-3">
                        {options.llmProviders.length > 0 ? options.llmProviders.map((provider) => (
                            <div key={provider.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-slate-900">{provider.label}</p>
                                    <Tooltip text={provider.description || 'No description provided.'}>
                                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] text-slate-700">
                                            <FiHelpCircle />
                                        </span>
                                    </Tooltip>
                                </div>
                                <p className="mt-1 text-sm text-slate-500">{provider.provider_name} | {provider.model_name}</p>
                            </div>
                        )) : (
                            <p className="text-sm text-slate-500">No platform-managed LLMs are configured yet.</p>
                        )}
                    </div>
                </div>

                <div className="surface-card p-6">
                    <h2 className="text-lg font-bold text-slate-900">Current embedding service</h2>
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <p className="font-bold text-slate-900">{options.embeddingProvider?.label || 'System embedding default'}</p>
                        <p className="mt-1 text-sm text-slate-500">
                            {(options.embeddingProvider?.provider_name || 'Default provider')} | {(options.embeddingProvider?.model_name || 'Default model')}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                            {options.embeddingProvider?.description || 'This is selected globally by the superadmin and used for retrieval across the platform.'}
                        </p>
                    </div>

                    <Link to="/teacher/exam-workflow" className="action-button mt-6 inline-flex">
                        Continue to workflow
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default LLMSettings;
