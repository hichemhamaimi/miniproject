import React, { useEffect, useMemo, useState } from 'react';
import { FiCpu, FiEdit2, FiHelpCircle, FiRefreshCw, FiSave, FiShield, FiTrash2 } from 'react-icons/fi';
import axiosInstance from '../../utils/axiosInstance';
import Tooltip from '../../components/teacher/Tooltip';

const providerOptions = {
    llm: [
        { value: 'groq', label: 'Groq' },
        { value: 'openai', label: 'OpenAI / OpenAI-compatible' },
        { value: 'anthropic', label: 'Anthropic' },
        { value: 'gemini', label: 'Google Gemini' },
        { value: 'mistral', label: 'Mistral' },
        { value: 'ollama', label: 'Ollama / Local host' },
    ],
    embedding: [
        { value: 'transformers', label: 'Local Transformers' },
        { value: 'openai', label: 'OpenAI-compatible embeddings' },
        { value: 'groq', label: 'Groq-compatible embeddings' },
    ],
};

const initialForm = {
    service_type: 'llm',
    provider_name: 'groq',
    label: '',
    description: '',
    model_name: '',
    base_url: '',
    api_key: '',
    is_active: true,
    is_default: false,
};

const fieldHelp = {
    service_type: 'Choose whether this entry is available for text generation or for embeddings used in retrieval.',
    provider_name: 'This selects the request adapter. OpenAI-compatible entries can point to remote, LAN, or local hosts through the base URL field.',
    label: 'Teachers and admins will see this friendly name in dropdowns.',
    description: 'Use this short note to explain cost, speed, hosting location, or intended use.',
    model_name: 'The exact model identifier sent to the provider API.',
    base_url: 'Optional for hosted defaults. Required for LAN or local endpoints such as Ollama or OpenAI-compatible gateways.',
    api_key: 'Stored encrypted on the server. Leave blank while editing if you want to keep the currently saved key.',
    is_default: 'For LLMs, this becomes the default teacher selection. For embeddings, this chooses the single retrieval embedding service for the whole platform.',
};

const groupedByService = (providers) => ({
    llm: providers.filter((provider) => provider.service_type === 'llm'),
    embedding: providers.filter((provider) => provider.service_type === 'embedding'),
});

const AIProviders = () => {
    const [providers, setProviders] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [editingProviderId, setEditingProviderId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const providerChoices = useMemo(
        () => providerOptions[form.service_type] || providerOptions.llm,
        [form.service_type]
    );

    const groupedProviders = useMemo(() => groupedByService(providers), [providers]);

    const loadProviders = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get('/superadmin/ai-providers');
            setProviders(response.data);
        } catch (loadError) {
            setError(loadError.response?.data?.message || 'Failed to load AI providers.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProviders().catch(() => {});
    }, []);

    useEffect(() => {
        const allowedProviders = providerOptions[form.service_type] || [];
        if (!allowedProviders.some((option) => option.value === form.provider_name)) {
            setForm((current) => ({
                ...current,
                provider_name: allowedProviders[0]?.value || '',
            }));
        }
    }, [form.service_type, form.provider_name]);

    const resetForm = () => {
        setForm(initialForm);
        setEditingProviderId(null);
    };

    const startEdit = (provider) => {
        setEditingProviderId(provider.id);
        setForm({
            service_type: provider.service_type,
            provider_name: provider.provider_name,
            label: provider.label,
            description: provider.description || '',
            model_name: provider.model_name,
            base_url: provider.base_url || '',
            api_key: '',
            is_active: Boolean(provider.is_active),
            is_default: Boolean(provider.is_default),
        });
        setMessage('');
        setError('');
    };

    const saveProvider = async (event) => {
        event.preventDefault();
        setSaving(true);
        setMessage('');
        setError('');

        try {
            if (editingProviderId) {
                await axiosInstance.put(`/superadmin/ai-providers/${editingProviderId}`, form);
                setMessage('AI provider updated successfully.');
            } else {
                await axiosInstance.post('/superadmin/ai-providers', form);
                setMessage('AI provider created successfully.');
            }
            resetForm();
            await loadProviders();
        } catch (saveError) {
            setError(saveError.response?.data?.message || 'Failed to save AI provider.');
        } finally {
            setSaving(false);
        }
    };

    const makeDefault = async (provider) => {
        try {
            await axiosInstance.put(`/superadmin/ai-providers/${provider.id}/default`);
            setMessage(`${provider.label} is now the default ${provider.service_type} provider.`);
            await loadProviders();
        } catch (actionError) {
            setError(actionError.response?.data?.message || 'Failed to update the default provider.');
        }
    };

    const removeProvider = async (provider) => {
        const confirmed = window.confirm(`Delete "${provider.label}" from the AI provider registry?`);
        if (!confirmed) return;

        try {
            await axiosInstance.delete(`/superadmin/ai-providers/${provider.id}`);
            setMessage('AI provider deleted successfully.');
            if (editingProviderId === provider.id) {
                resetForm();
            }
            await loadProviders();
        } catch (actionError) {
            setError(actionError.response?.data?.message || 'Failed to delete the AI provider.');
        }
    };

    const renderProviderCard = (provider) => (
        <div key={provider.id} className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-bold text-slate-900">{provider.label}</p>
                        {provider.is_default ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
                                Default
                            </span>
                        ) : null}
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${provider.is_active ? 'border-cyan-200 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                            {provider.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{provider.provider_name} | {provider.model_name}</p>
                    <p className="mt-2 text-sm text-slate-500">{provider.description || 'No description provided yet.'}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {provider.base_url || 'Using provider default host'} | {provider.has_api_key ? 'Encrypted key saved' : 'No key saved'}
                    </p>
                    {provider.decryption_error ? (
                        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                            {provider.decryption_error}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                    {!provider.is_default ? (
                        <button type="button" onClick={() => makeDefault(provider)} className="ghost-button !px-4 !py-2">
                            <FiShield />
                            <span>Make default</span>
                        </button>
                    ) : null}
                    <button type="button" onClick={() => startEdit(provider)} className="ghost-button !px-4 !py-2">
                        <FiEdit2 />
                        <span>Edit</span>
                    </button>
                    <button type="button" onClick={() => removeProvider(provider)} className="ghost-button !border-rose-200 !bg-rose-50 !px-4 !py-2 !text-rose-700 hover:!bg-rose-100">
                        <FiTrash2 />
                        <span>Delete</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 pb-20">
            <header className="page-hero">
                <p className="eyebrow">AI Governance</p>
                <h1 className="page-title">Manage the platform LLM catalog and the global embedding service</h1>
                <p className="page-subtitle">
                    Superadmins control which providers are available to teachers, where those providers are hosted, and which embedding service powers retrieval for the whole platform.
                </p>
            </header>

            {message ? (
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>
            ) : null}
            {error ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>
            ) : null}

            <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
                <form onSubmit={saveProvider} className="surface-card p-6">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-lg font-bold text-slate-900">{editingProviderId ? 'Edit AI provider' : 'Add AI provider'}</p>
                            <p className="mt-1 text-sm text-slate-500">Use one form for both LLM and embedding entries. Defaults are tracked per service type.</p>
                        </div>
                        {editingProviderId ? (
                            <button type="button" onClick={resetForm} className="ghost-button !px-4 !py-2">
                                <FiRefreshCw />
                                <span>Cancel edit</span>
                            </button>
                        ) : null}
                    </div>

                    <div className="mt-6 grid gap-4">
                        {[
                            { key: 'service_type', label: 'Service type', type: 'select' },
                            { key: 'provider_name', label: 'Provider adapter', type: 'select' },
                            { key: 'label', label: 'Display label', type: 'input' },
                            { key: 'description', label: 'Short description', type: 'input' },
                            { key: 'model_name', label: 'Model name', type: 'input' },
                            { key: 'base_url', label: 'Base URL', type: 'input' },
                            { key: 'api_key', label: editingProviderId ? 'New API key (optional)' : 'API key', type: 'input' },
                        ].map((field) => (
                            <div key={field.key}>
                                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <span>{field.label}</span>
                                    <Tooltip text={fieldHelp[field.key]}>
                                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] text-slate-700">
                                            <FiHelpCircle />
                                        </span>
                                    </Tooltip>
                                </label>
                                {field.type === 'select' ? (
                                    <select
                                        className="select-field"
                                        value={form[field.key]}
                                        onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                                    >
                                        {(field.key === 'service_type'
                                            ? [
                                                { value: 'llm', label: 'LLM generation' },
                                                { value: 'embedding', label: 'Embedding retrieval' },
                                            ]
                                            : providerChoices
                                        ).map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type={field.key === 'api_key' ? 'password' : 'text'}
                                        className="input-field"
                                        value={form[field.key]}
                                        onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                                        placeholder={field.key === 'base_url' ? 'http://localhost:11434 or your LAN gateway URL' : ''}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                            <input
                                type="checkbox"
                                checked={form.is_active}
                                onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span>Keep this provider active for the UI</span>
                        </label>
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                            <input
                                type="checkbox"
                                checked={form.is_default}
                                onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))}
                                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className="inline-flex items-center gap-2">
                                <span>Set as default</span>
                                <Tooltip text={fieldHelp.is_default}>
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] text-slate-700">
                                        <FiHelpCircle />
                                    </span>
                                </Tooltip>
                            </span>
                        </label>
                    </div>

                    <button type="submit" disabled={saving} className="action-button mt-6">
                        <FiSave />
                        <span>{saving ? 'Saving...' : (editingProviderId ? 'Update provider' : 'Create provider')}</span>
                    </button>
                </form>

                <div className="space-y-6">
                    <section className="surface-card p-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                                <FiCpu className="text-xl" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Available LLMs</h2>
                                <p className="text-sm text-slate-500">Teachers can choose among these entries for mindmaps and exam generation.</p>
                            </div>
                        </div>
                        <div className="mt-5 space-y-4">
                            {loading ? <p className="text-sm text-slate-500">Loading providers...</p> : (
                                groupedProviders.llm.length > 0
                                    ? groupedProviders.llm.map(renderProviderCard)
                                    : <p className="text-sm text-slate-500">No LLM providers configured yet.</p>
                            )}
                        </div>
                    </section>

                    <section className="surface-card p-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                                <FiShield className="text-xl" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Embedding Service</h2>
                                <p className="text-sm text-slate-500">Exactly one default embedding provider powers retrieval and vector search across the platform.</p>
                            </div>
                        </div>
                        <div className="mt-5 space-y-4">
                            {loading ? <p className="text-sm text-slate-500">Loading providers...</p> : (
                                groupedProviders.embedding.length > 0
                                    ? groupedProviders.embedding.map(renderProviderCard)
                                    : <p className="text-sm text-slate-500">No embedding providers configured yet.</p>
                            )}
                        </div>
                    </section>
                </div>
            </section>
        </div>
    );
};

export default AIProviders;
