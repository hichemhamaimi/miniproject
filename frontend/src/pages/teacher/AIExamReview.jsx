import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { FiEdit2, FiTrash2, FiPlus, FiSave, FiSend, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const TYPES = [
    { value: 'single_choice', label: 'Single Choice' },
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'true_false', label: 'True / False' },
    { value: 'matching', label: 'Matching' },
    { value: 'ordering', label: 'Ordering' },
    { value: 'negative_qcm', label: 'Negative QCM' },
];
const DIFFICULTIES = ['recall', 'understanding', 'application', 'analysis', 'evaluation'];
const DIFF_COLORS = { recall: 'sky', understanding: 'teal', application: 'amber', analysis: 'orange', evaluation: 'rose' };

const generateId = () => Math.random().toString(36).substr(2, 9);

const QuestionEditor = ({ q, idx, onChange, onRemove }) => {
    const [open, setOpen] = useState(idx === 0);

    const update = (field, value) => onChange(idx, { ...q, [field]: value });

    const addOption = () => update('options', [...(q.options || []), '']);
    const removeOption = (oi) => {
        const opts = (q.options || []).filter((_, i) => i !== oi);
        update('options', opts);
    };
    const updateOption = (oi, val) => {
        const opts = [...(q.options || [])];
        opts[oi] = val;
        update('options', opts);
    };
    const toggleCorrect = (opt) => {
        const ca = q.correctAnswers || [];
        if (q.type === 'single_choice' || q.type === 'negative_qcm') {
            update('correctAnswers', [opt]);
        } else {
            update('correctAnswers', ca.includes(opt) ? ca.filter(x => x !== opt) : [...ca, opt]);
        }
    };

    const diffColor = DIFF_COLORS[q.difficulty] || 'slate';

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition"
                onClick={() => setOpen(o => !o)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{idx + 1}</span>
                    <p className="font-semibold text-slate-800 text-sm truncate">{q.text || '(empty question text)'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold bg-${diffColor}-100 text-${diffColor}-700 flex-shrink-0 hidden sm:inline`}>{q.difficulty}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition">
                        <FiTrash2 />
                    </button>
                    {open ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
                </div>
            </div>

            {open && (
                <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Type</label>
                            <select value={q.type} onChange={e => update('type', e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Difficulty</label>
                            <select value={q.difficulty} onChange={e => update('difficulty', e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                                {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Question Text</label>
                        <textarea rows={3} value={q.text} onChange={e => update('text', e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none" />
                    </div>

                    {/* Options for single/multiple/negative */}
                    {(q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'negative_qcm') && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                                Options {q.type === 'single_choice' || q.type === 'negative_qcm' ? '(radio = correct)' : '(check = correct)'}
                            </label>
                            <div className="space-y-2">
                                {(q.options || []).map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-2">
                                        {q.type === 'multiple_choice' ? (
                                            <input type="checkbox" checked={(q.correctAnswers || []).includes(opt)}
                                                onChange={() => toggleCorrect(opt)}
                                                className="w-4 h-4 accent-indigo-600 flex-shrink-0" />
                                        ) : (
                                            <input type="radio" name={`correct-${q.id}`} checked={(q.correctAnswers || [])[0] === opt}
                                                onChange={() => toggleCorrect(opt)}
                                                className="w-4 h-4 accent-indigo-600 flex-shrink-0" />
                                        )}
                                        <input type="text" value={opt} onChange={e => updateOption(oi, e.target.value)}
                                            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-indigo-500 focus:outline-none" />
                                        {(q.options || []).length > 2 && (
                                            <button onClick={() => removeOption(oi)} className="text-red-400 hover:text-red-600 p-1"><FiTrash2 className="text-xs" /></button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addOption} className="text-xs text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1 mt-1">
                                    <FiPlus /> Add Option
                                </button>
                            </div>
                        </div>
                    )}

                    {/* True/False */}
                    {q.type === 'true_false' && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Correct Answer</label>
                            <select value={String(q.trueFalseAnswer)} onChange={e => update('trueFalseAnswer', e.target.value === 'true')}
                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white w-40">
                                <option value="true">True</option>
                                <option value="false">False</option>
                            </select>
                        </div>
                    )}

                    {/* Matching */}
                    {q.type === 'matching' && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Matching Pairs</label>
                            <div className="space-y-2">
                                {(q.matchingPairs || []).map((pair, pi) => (
                                    <div key={pi} className="flex items-center gap-2">
                                        <input type="text" value={pair.left} placeholder="Left"
                                            onChange={e => { const p = [...q.matchingPairs]; p[pi] = { ...p[pi], left: e.target.value }; update('matchingPairs', p); }}
                                            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                                        <span className="text-slate-400 font-bold">←→</span>
                                        <input type="text" value={pair.right} placeholder="Right"
                                            onChange={e => { const p = [...q.matchingPairs]; p[pi] = { ...p[pi], right: e.target.value }; update('matchingPairs', p); }}
                                            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                                        {(q.matchingPairs || []).length > 2 && (
                                            <button onClick={() => update('matchingPairs', q.matchingPairs.filter((_, i) => i !== pi))} className="text-red-400"><FiTrash2 className="text-xs" /></button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => update('matchingPairs', [...(q.matchingPairs || []), { left: '', right: '' }])}
                                    className="text-xs text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1"><FiPlus /> Add Pair</button>
                            </div>
                        </div>
                    )}

                    {/* Ordering */}
                    {q.type === 'ordering' && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Ordered Items (correct order)</label>
                            <div className="space-y-2">
                                {(q.orderedItems || []).map((item, ii) => (
                                    <div key={ii} className="flex items-center gap-2">
                                        <span className="text-slate-400 font-bold w-6 text-center">{ii + 1}.</span>
                                        <input type="text" value={item}
                                            onChange={e => { const items = [...q.orderedItems]; items[ii] = e.target.value; update('orderedItems', items); }}
                                            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                                        {(q.orderedItems || []).length > 2 && (
                                            <button onClick={() => update('orderedItems', q.orderedItems.filter((_, i) => i !== ii))} className="text-red-400"><FiTrash2 className="text-xs" /></button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => update('orderedItems', [...(q.orderedItems || []), ''])}
                                    className="text-xs text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1"><FiPlus /> Add Item</button>
                            </div>
                        </div>
                    )}

                    {/* Explanation */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Explanation</label>
                        <textarea rows={2} value={q.explanation || ''} onChange={e => update('explanation', e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none" />
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const AIExamReview = () => {
    const { examId } = useParams();
    const navigate = useNavigate();
    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        axiosInstance.get(`/teacher/ai-exams/${examId}`)
            .then(r => setExam(r.data))
            .catch(() => setStatus({ type: 'error', text: 'Failed to load exam.' }))
            .finally(() => setLoading(false));
    }, [examId]);

    const handleChange = (idx, updated) => {
        setExam(prev => {
            const qs = [...prev.questions];
            qs[idx] = updated;
            return { ...prev, questions: qs };
        });
    };

    const handleRemove = (idx) => {
        setExam(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }));
    };

    const handleAddQuestion = () => {
        setExam(prev => ({
            ...prev,
            questions: [...prev.questions, {
                id: generateId(), type: 'single_choice', difficulty: 'recall',
                text: '', options: ['', ''], correctAnswers: [], explanation: ''
            }]
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const updated = await axiosInstance.put(`/teacher/ai-exams/${examId}`, {
                title: exam.title,
                questions: exam.questions,
                scoringDefaults: exam.scoringDefaults
            });
            setExam(updated.data);
            setStatus({ type: 'success', text: 'Draft saved!' });
        } catch (err) {
            setStatus({ type: 'error', text: err.response?.data?.message || 'Save failed.' });
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!window.confirm('Publish this exam? Students will be able to access it.')) return;
        setPublishing(true);
        setStatus(null);
        try {
            await axiosInstance.post(`/teacher/ai-exams/${examId}/publish`);
            setStatus({ type: 'success', text: 'Exam published!' });
            setTimeout(() => navigate('/teacher/published-exams'), 1500);
        } catch (err) {
            setStatus({ type: 'error', text: err.response?.data?.message || 'Publish failed.' });
        } finally {
            setPublishing(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>;

    if (!exam) return <div className="text-center py-20 text-slate-400">Exam not found.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <header className="bg-gradient-to-r from-indigo-700 to-violet-700 p-8 rounded-3xl shadow-xl text-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold flex items-center gap-3"><FiEdit2 className="opacity-80" /> Review Exam</h1>
                        <input
                            type="text"
                            value={exam.title}
                            onChange={e => setExam(prev => ({ ...prev, title: e.target.value }))}
                            className="mt-2 bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-xl px-4 py-2 text-lg font-semibold w-full max-w-lg focus:outline-none focus:ring-2 focus:ring-white"
                        />
                    </div>
                    <span className={`text-xs font-bold px-4 py-2 rounded-full ${exam.status === 'published' ? 'bg-emerald-400 text-white' : 'bg-white/20 text-white'}`}>
                        {exam.status.toUpperCase()}
                    </span>
                </div>
                <p className="text-indigo-200 mt-3">{exam.questions.length} question{exam.questions.length !== 1 ? 's' : ''}</p>
            </header>

            {status && (
                <div className={`p-4 rounded-2xl font-semibold text-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {status.text}
                </div>
            )}

            <div className="space-y-4">
                {exam.questions.map((q, idx) => (
                    <QuestionEditor key={q.id || idx} q={q} idx={idx} onChange={handleChange} onRemove={handleRemove} />
                ))}
            </div>

            <button onClick={handleAddQuestion}
                className="w-full border-2 border-dashed border-indigo-300 text-indigo-600 font-bold py-4 rounded-2xl hover:bg-indigo-50 hover:border-indigo-500 transition flex items-center justify-center gap-2">
                <FiPlus /> Add Question
            </button>

            {/* Action Bar */}
            <div className="sticky bottom-4 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 z-20">
                <p className="text-sm text-slate-500 font-medium">{exam.questions.length} questions · Status: <strong className="capitalize">{exam.status}</strong></p>
                <div className="flex gap-3">
                    <button onClick={handleSave} disabled={saving || exam.status === 'published'}
                        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold transition disabled:opacity-50">
                        <FiSave /> {saving ? 'Saving…' : 'Save Draft'}
                    </button>
                    <button onClick={handlePublish} disabled={publishing || exam.status === 'published'}
                        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                        <FiSend /> {publishing ? 'Publishing…' : 'Publish Exam'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIExamReview;
