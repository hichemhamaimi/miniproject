import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { FiLayers, FiPlus, FiMinus, FiArrowRight } from 'react-icons/fi';

const QUESTION_TYPES = [
    { key: 'single_choice', label: 'Single Choice' },
    { key: 'multiple_choice', label: 'Multiple Choice' },
    { key: 'true_false', label: 'True / False' },
    { key: 'matching', label: 'Matching' },
    { key: 'ordering', label: 'Ordering' },
    { key: 'negative_qcm', label: 'Negative QCM' },
];

const DIFFICULTY_LEVELS = [
    { key: 'recall', label: 'Recall', color: 'bg-sky-100 text-sky-700' },
    { key: 'understanding', label: 'Understanding', color: 'bg-teal-100 text-teal-700' },
    { key: 'application', label: 'Application', color: 'bg-amber-100 text-amber-700' },
    { key: 'analysis', label: 'Analysis', color: 'bg-orange-100 text-orange-700' },
    { key: 'evaluation', label: 'Evaluation', color: 'bg-rose-100 text-rose-700' },
];

const defaultTypes = () => Object.fromEntries(
    QUESTION_TYPES.map(t => [t.key, { count: 0, options: 4, correctAnswers: 1 }])
);
const defaultDiff = () => Object.fromEntries(
    DIFFICULTY_LEVELS.map(d => [d.key, 0])
);
const defaultScoring = () => Object.fromEntries(
    QUESTION_TYPES.map(t => [t.key, { reward: 1, penalty: -0.5 }])
);

const Stepper = ({ step }) => {
    const steps = ['Question Types', 'Difficulty', 'Scoring', 'Instructions'];
    return (
        <div className="flex items-center gap-2 mb-6">
            {steps.map((s, i) => (
                <React.Fragment key={s}>
                    <div className={`flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full transition-all
                        ${i === step ? 'bg-violet-600 text-white' : i < step ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        <span>{i + 1}</span> <span className="hidden sm:inline">{s}</span>
                    </div>
                    {i < steps.length - 1 && <div className={`flex-1 h-0.5 rounded ${i < step ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                </React.Fragment>
            ))}
        </div>
    );
};

const BlueprintBuilder = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { materialId, materialTitle, selectedConcepts: initConcepts = [] } = location.state || {};

    const [step, setStep] = useState(0);
    const [questionTypes, setQuestionTypes] = useState(defaultTypes());
    const [difficultyDist, setDifficultyDist] = useState(defaultDiff());
    const [scoringRules, setScoringRules] = useState(defaultScoring());
    const [instructions, setInstructions] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const totalQuestions = Object.values(questionTypes).reduce((s, v) => s + (Number(v.count) || 0), 0);
    const totalDiff = Object.values(difficultyDist).reduce((s, v) => s + (Number(v) || 0), 0);

    const handleSubmit = async () => {
        if (totalQuestions === 0) return setError('Please configure at least one question type with count > 0.');
        if (totalDiff !== totalQuestions) return setError(`Difficulty distribution (${totalDiff}) must equal total questions (${totalQuestions}).`);

        setSubmitting(true);
        setError('');
        try {
            const scoringMap = {};
            for (const [type, rule] of Object.entries(scoringRules)) {
                scoringMap[type] = rule;
            }

            const payload = {
                materials: materialId ? [materialId] : [],
                selectedConcepts: initConcepts,
                questionTypes,
                difficultyDistribution: difficultyDist,
                scoringRules: scoringMap,
                instructions,
                totalQuestions
            };
            const res = await axiosInstance.post('/teacher/blueprints', payload);
            navigate('/teacher/ai-exam-generator', { state: { blueprintId: res.data._id } });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create blueprint.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-16">
            <header className="bg-gradient-to-r from-amber-600 to-orange-600 p-8 rounded-3xl shadow-xl text-white">
                <h1 className="text-3xl font-extrabold flex items-center gap-3"><FiLayers className="opacity-80" /> Exam Blueprint Builder</h1>
                <p className="text-amber-100 mt-1">{materialTitle ? `Based on: ${materialTitle}` : 'Configure your AI exam structure'}</p>
                {initConcepts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {initConcepts.slice(0, 5).map(c => (
                            <span key={c} className="bg-white/20 text-xs font-semibold px-2 py-1 rounded-full">{c}</span>
                        ))}
                        {initConcepts.length > 5 && <span className="bg-white/20 text-xs font-semibold px-2 py-1 rounded-full">+{initConcepts.length - 5} more</span>}
                    </div>
                )}
            </header>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                <Stepper step={step} />

                {/* Step 0: Question Types */}
                {step === 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Question Type Distribution</h2>
                        {QUESTION_TYPES.map(qt => (
                            <div key={qt.key} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-800 text-sm">{qt.label}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setQuestionTypes(prev => ({ ...prev, [qt.key]: { ...prev[qt.key], count: Math.max(0, prev[qt.key].count - 1) } }))}
                                        className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition"><FiMinus className="text-sm" /></button>
                                    <span className="w-8 text-center font-bold text-slate-800">{questionTypes[qt.key].count}</span>
                                    <button type="button" onClick={() => setQuestionTypes(prev => ({ ...prev, [qt.key]: { ...prev[qt.key], count: prev[qt.key].count + 1 } }))}
                                        className="w-7 h-7 rounded-full bg-violet-100 hover:bg-violet-200 text-violet-700 flex items-center justify-center transition"><FiPlus className="text-sm" /></button>
                                </div>
                                {(qt.key === 'single_choice' || qt.key === 'multiple_choice' || qt.key === 'negative_qcm') && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">Options:</span>
                                        <input type="number" min="2" max="10" value={questionTypes[qt.key].options}
                                            onChange={e => setQuestionTypes(prev => ({ ...prev, [qt.key]: { ...prev[qt.key], options: Number(e.target.value) } }))}
                                            className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center" />
                                    </div>
                                )}
                            </div>
                        ))}
                        <div className="mt-4 p-4 bg-violet-50 rounded-2xl flex items-center justify-between">
                            <span className="font-semibold text-violet-700">Total Questions</span>
                            <span className="text-2xl font-extrabold text-violet-700">{totalQuestions}</span>
                        </div>
                    </div>
                )}

                {/* Step 1: Difficulty */}
                {step === 1 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-slate-800 mb-2">Bloom's Taxonomy Distribution</h2>
                        <p className="text-sm text-slate-500 mb-4">Total must equal <strong>{totalQuestions}</strong> questions. Currently: <strong>{totalDiff}</strong></p>
                        {DIFFICULTY_LEVELS.map(dl => (
                            <div key={dl.key} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${dl.color} min-w-[110px] text-center`}>{dl.label}</span>
                                <div className="flex items-center gap-2 ml-auto">
                                    <button type="button" onClick={() => setDifficultyDist(prev => ({ ...prev, [dl.key]: Math.max(0, prev[dl.key] - 1) }))}
                                        className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition"><FiMinus className="text-sm" /></button>
                                    <span className="w-8 text-center font-bold text-slate-800">{difficultyDist[dl.key]}</span>
                                    <button type="button" onClick={() => setDifficultyDist(prev => ({ ...prev, [dl.key]: prev[dl.key] + 1 }))}
                                        className="w-7 h-7 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-700 flex items-center justify-center transition"><FiPlus className="text-sm" /></button>
                                </div>
                            </div>
                        ))}
                        {totalDiff !== totalQuestions && totalQuestions > 0 && (
                            <p className="text-xs text-amber-600 font-semibold">⚠ Distribution ({totalDiff}) must match total questions ({totalQuestions})</p>
                        )}
                    </div>
                )}

                {/* Step 2: Scoring */}
                {step === 2 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Scoring Rules per Question Type</h2>
                        {QUESTION_TYPES.filter(qt => questionTypes[qt.key].count > 0).map(qt => (
                            <div key={qt.key} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <p className="font-semibold text-slate-800 text-sm mb-3">{qt.label}</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-emerald-700 uppercase">Reward (Correct)</label>
                                        <input type="number" step="0.5" value={scoringRules[qt.key].reward}
                                            onChange={e => setScoringRules(prev => ({ ...prev, [qt.key]: { ...prev[qt.key], reward: Number(e.target.value) } }))}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 mt-1 focus:ring-2 focus:ring-emerald-400 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-red-600 uppercase">Penalty (Incorrect)</label>
                                        <input type="number" step="0.5" value={scoringRules[qt.key].penalty}
                                            onChange={e => setScoringRules(prev => ({ ...prev, [qt.key]: { ...prev[qt.key], penalty: Number(e.target.value) } }))}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 mt-1 focus:ring-2 focus:ring-red-400 focus:outline-none" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {QUESTION_TYPES.filter(qt => questionTypes[qt.key].count > 0).length === 0 && (
                            <p className="text-slate-400 text-sm">No question types configured. Go back to Step 1.</p>
                        )}
                    </div>
                )}

                {/* Step 3: Instructions */}
                {step === 3 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-slate-800 mb-2">Special Instructions for the LLM</h2>
                        <p className="text-sm text-slate-500 mb-4">Guide the AI about question style, tone, or constraints.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                            {[
                                'Avoid trick questions', 'Include code-based questions',
                                'Include calculation questions', 'Avoid ambiguous wording',
                                'Require full explanation for each question',
                            ].map(hint => (
                                <button key={hint} type="button"
                                    onClick={() => setInstructions(prev => prev ? `${prev}\n${hint}` : hint)}
                                    className="text-left text-xs bg-slate-100 hover:bg-violet-100 text-slate-700 hover:text-violet-700 px-3 py-2 rounded-xl font-medium transition">
                                    + {hint}
                                </button>
                            ))}
                        </div>
                        <textarea
                            rows={6}
                            className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm bg-slate-50 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                            placeholder="e.g. Avoid trick questions. Use code snippets where relevant. Focus on practical understanding."
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                        />
                    </div>
                )}

                {error && <p className="text-sm text-red-600 font-semibold mt-4">{error}</p>}

                {/* Navigation */}
                <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
                    <button disabled={step === 0} onClick={() => setStep(s => s - 1)}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-30">
                        ← Back
                    </button>
                    {step < 3 ? (
                        <button onClick={() => setStep(s => s + 1)}
                            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-2.5 rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all">
                            Next <FiArrowRight />
                        </button>
                    ) : (
                        <button onClick={handleSubmit} disabled={submitting}
                            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                            {submitting ? 'Creating…' : 'Generate Exam →'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BlueprintBuilder;
