import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    FiAlertCircle,
    FiChevronDown,
    FiChevronUp,
    FiEdit2,
    FiPlus,
    FiSave,
    FiSend,
    FiTrash2,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axiosInstance';
import PublishExamModal from '../../components/teacher/PublishExamModal';

const QUESTION_TYPES = [
    { value: 'single_choice', label: 'MCQ' },
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'true_false', label: 'True / False' },
    { value: 'matching', label: 'Matching' },
    { value: 'ordering', label: 'Ordering' },
    { value: 'negative_qcm', label: 'Negative QCM' },
];

const DIFFICULTIES = ['recall', 'understanding', 'application', 'analysis', 'evaluation', 'create'];
const generateId = () => Math.random().toString(36).slice(2, 11);

const createQuestionTemplate = () => ({
    id: generateId(),
    type: 'single_choice',
    difficulty: 'recall',
    text: '',
    options: ['', ''],
    correctAnswers: [],
    trueFalseAnswer: true,
    matchingPairs: [
        { left: '', right: '' },
        { left: '', right: '' },
    ],
    orderedItems: ['', ''],
    explanation: '',
    scoringOverride: {
        active: false,
        correct: 1,
        incorrect: -0.5,
        unanswered: 0,
    },
});

const clampNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeQuestionForType = (question, scoringDefaults) => {
    const baseQuestion = {
        ...createQuestionTemplate(),
        ...question,
        scoringOverride: {
            ...createQuestionTemplate().scoringOverride,
            ...(question.scoringOverride || {}),
            correct: question.scoringOverride?.correct ?? scoringDefaults.correct,
            incorrect: question.scoringOverride?.incorrect ?? scoringDefaults.incorrect,
            unanswered: question.scoringOverride?.unanswered ?? scoringDefaults.unanswered,
        },
    };

    if (baseQuestion.type === 'single_choice' || baseQuestion.type === 'multiple_choice' || baseQuestion.type === 'negative_qcm') {
        return {
            ...baseQuestion,
            options: baseQuestion.options?.length ? baseQuestion.options : ['', ''],
            correctAnswers: baseQuestion.correctAnswers || [],
        };
    }

    if (baseQuestion.type === 'true_false') {
        return {
            ...baseQuestion,
            trueFalseAnswer: typeof baseQuestion.trueFalseAnswer === 'boolean' ? baseQuestion.trueFalseAnswer : true,
        };
    }

    if (baseQuestion.type === 'matching') {
        return {
            ...baseQuestion,
            matchingPairs: baseQuestion.matchingPairs?.length ? baseQuestion.matchingPairs : [{ left: '', right: '' }, { left: '', right: '' }],
        };
    }

    if (baseQuestion.type === 'ordering') {
        return {
            ...baseQuestion,
            orderedItems: baseQuestion.orderedItems?.length ? baseQuestion.orderedItems : ['', ''],
        };
    }

    return baseQuestion;
};

const getQuestionValidationErrors = (question, index) => {
    const prefix = `Question ${index + 1}`;
    const errors = [];

    if (!question.text?.trim()) {
        errors.push(`${prefix}: question text is required.`);
    }

    if (!question.type) {
        errors.push(`${prefix}: question type is required.`);
        return errors;
    }

    if (!question.difficulty) {
        errors.push(`${prefix}: difficulty is required.`);
    }

    if (question.type === 'single_choice' || question.type === 'multiple_choice' || question.type === 'negative_qcm') {
        const options = (question.options || []).map((option) => option.trim()).filter(Boolean);
        if (options.length < 2) {
            errors.push(`${prefix}: at least two non-empty options are required.`);
        }

        const correctAnswers = question.correctAnswers || [];
        if (correctAnswers.length === 0) {
            errors.push(`${prefix}: select at least one correct answer.`);
        }

        if ((question.type === 'single_choice' || question.type === 'negative_qcm') && correctAnswers.length !== 1) {
            errors.push(`${prefix}: exactly one correct answer is required for this type.`);
        }

        const invalidAnswers = correctAnswers.filter((answer) => !options.includes(answer));
        if (invalidAnswers.length > 0) {
            errors.push(`${prefix}: correct answers must match the current options.`);
        }
    }

    if (question.type === 'matching') {
        const validPairs = (question.matchingPairs || []).filter((pair) => pair.left?.trim() && pair.right?.trim());
        if (validPairs.length < 2) {
            errors.push(`${prefix}: provide at least two complete matching pairs.`);
        }
    }

    if (question.type === 'ordering') {
        const orderedItems = (question.orderedItems || []).map((item) => item.trim()).filter(Boolean);
        if (orderedItems.length < 2) {
            errors.push(`${prefix}: provide at least two ordered items.`);
        }
    }

    if (question.scoringOverride?.active) {
        ['correct', 'incorrect', 'unanswered'].forEach((field) => {
            if (!Number.isFinite(Number(question.scoringOverride[field]))) {
                errors.push(`${prefix}: scoring override ${field} must be numeric.`);
            }
        });
    }

    return errors;
};

const getExamValidationErrors = (exam) => {
    if (!exam) return [];

    const errors = [];

    if (!exam.title?.trim()) {
        errors.push('Exam title is required.');
    }

    if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
        errors.push('At least one question is required.');
        return errors;
    }

    ['correct', 'incorrect', 'unanswered'].forEach((field) => {
        if (!Number.isFinite(Number(exam.scoringDefaults?.[field]))) {
            errors.push(`Default scoring field "${field}" must be numeric.`);
        }
    });

    exam.questions.forEach((question, index) => {
        errors.push(...getQuestionValidationErrors(question, index));
    });

    return errors;
};

const QuestionEditor = ({ question, index, validationErrors, scoringDefaults, onChange, onRemove, isLocked }) => {
    const [open, setOpen] = useState(index === 0);

    const updateQuestion = (changes) => {
        onChange(index, { ...question, ...changes });
    };

    const setQuestionType = (nextType) => {
        updateQuestion(normalizeQuestionForType({ ...question, type: nextType }, scoringDefaults));
    };

    const updateOption = (optionIndex, nextValue) => {
        const nextOptions = [...(question.options || [])];
        const previousValue = nextOptions[optionIndex] || '';
        nextOptions[optionIndex] = nextValue;
        const nextCorrectAnswers = (question.correctAnswers || []).map((answer) => (answer === previousValue ? nextValue : answer));
        updateQuestion({
            options: nextOptions,
            correctAnswers: nextCorrectAnswers.filter(Boolean),
        });
    };

    const removeOption = (optionIndex) => {
        const nextOptions = [...(question.options || [])];
        const removedValue = nextOptions[optionIndex];
        nextOptions.splice(optionIndex, 1);
        updateQuestion({
            options: nextOptions.length >= 2 ? nextOptions : ['', ''],
            correctAnswers: (question.correctAnswers || []).filter((answer) => answer !== removedValue),
        });
    };

    const addOption = () => {
        updateQuestion({
            options: [...(question.options || []), ''],
        });
    };

    const updateMatchingPair = (pairIndex, side, value) => {
        const nextPairs = [...(question.matchingPairs || [])];
        nextPairs[pairIndex] = { ...nextPairs[pairIndex], [side]: value };
        updateQuestion({ matchingPairs: nextPairs });
    };

    const updateOrderedItem = (itemIndex, value) => {
        const nextItems = [...(question.orderedItems || [])];
        nextItems[itemIndex] = value;
        updateQuestion({ orderedItems: nextItems });
    };

    return (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex cursor-pointer items-center justify-between px-6 py-5 hover:bg-slate-50" onClick={() => setOpen((current) => !current)}>
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">{index + 1}</span>
                        <p className="text-sm font-semibold text-slate-800">{question.text || '(empty question text)'}</p>
                    </div>
                    {validationErrors.length > 0 ? (
                        <p className="text-sm font-semibold text-rose-600">{validationErrors[0]}</p>
                    ) : null}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            if (isLocked) return;
                            onRemove(index);
                        }}
                        disabled={isLocked}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                    >
                        <FiTrash2 />
                    </button>
                    {open ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
                </div>
            </div>

            {open ? (
                <div className="space-y-6 border-t border-slate-100 px-6 pb-6 pt-5">
                    {validationErrors.length > 0 ? (
                        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4">
                            {validationErrors.map((error) => (
                                <p key={error} className="text-sm font-medium text-rose-700">{error}</p>
                            ))}
                        </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                        <select value={question.type} onChange={(event) => setQuestionType(event.target.value)} className="select-field" disabled={isLocked}>
                            {QUESTION_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </select>
                        <select value={question.difficulty} onChange={(event) => updateQuestion({ difficulty: event.target.value })} className="select-field" disabled={isLocked}>
                            {DIFFICULTIES.map((difficulty) => (
                                <option key={difficulty} value={difficulty}>{difficulty}</option>
                            ))}
                        </select>
                    </div>

                    <textarea
                        rows={3}
                        value={question.text}
                        onChange={(event) => updateQuestion({ text: event.target.value })}
                        className="textarea-field"
                        placeholder="Question text"
                        disabled={isLocked}
                    />

                    {(question.type === 'single_choice' || question.type === 'multiple_choice' || question.type === 'negative_qcm') ? (
                        <div className="space-y-3">
                            {(question.options || []).map((option, optionIndex) => {
                                const checked = (question.correctAnswers || []).includes(option);
                                return (
                                    <div key={`${question.id}-${optionIndex}`} className="flex items-center gap-3">
                                        <input
                                            type={question.type === 'multiple_choice' ? 'checkbox' : 'radio'}
                                            name={`question-${question.id}`}
                                            checked={checked}
                                            onChange={() => {
                                                if (isLocked) return;
                                                if (question.type === 'multiple_choice') {
                                                    const currentAnswers = question.correctAnswers || [];
                                                    updateQuestion({
                                                        correctAnswers: checked
                                                            ? currentAnswers.filter((item) => item !== option)
                                                            : [...currentAnswers, option].filter(Boolean),
                                                    });
                                                } else {
                                                    updateQuestion({ correctAnswers: option ? [option] : [] });
                                                }
                                            }}
                                            className="h-4 w-4 text-cyan-600 focus:ring-cyan-500"
                                            disabled={isLocked}
                                        />
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(event) => updateOption(optionIndex, event.target.value)}
                                            className="input-field flex-1 !py-2.5"
                                            disabled={isLocked}
                                        />
                                        {(question.options || []).length > 2 ? (
                                            <button type="button" onClick={() => removeOption(optionIndex)} disabled={isLocked} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50">
                                                <FiTrash2 />
                                            </button>
                                        ) : null}
                                    </div>
                                );
                            })}
                            <button type="button" onClick={addOption} disabled={isLocked} className="ghost-button !px-4 !py-2 disabled:cursor-not-allowed disabled:opacity-50">
                                <FiPlus />
                                <span>Add option</span>
                            </button>
                        </div>
                    ) : null}

                    {question.type === 'true_false' ? (
                        <select
                            value={String(question.trueFalseAnswer)}
                            onChange={(event) => updateQuestion({ trueFalseAnswer: event.target.value === 'true' })}
                            className="select-field"
                            disabled={isLocked}
                        >
                            <option value="true">True</option>
                            <option value="false">False</option>
                        </select>
                    ) : null}

                    {question.type === 'matching' ? (
                        <div className="space-y-3">
                            {(question.matchingPairs || []).map((pair, pairIndex) => (
                                <div key={`${question.id}-pair-${pairIndex}`} className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
                                    <input
                                        type="text"
                                        value={pair.left}
                                        onChange={(event) => updateMatchingPair(pairIndex, 'left', event.target.value)}
                                        className="input-field !py-2.5"
                                        placeholder="Left item"
                                        disabled={isLocked}
                                    />
                                    <input
                                        type="text"
                                        value={pair.right}
                                        onChange={(event) => updateMatchingPair(pairIndex, 'right', event.target.value)}
                                        className="input-field !py-2.5"
                                        placeholder="Right item"
                                        disabled={isLocked}
                                    />
                                    {(question.matchingPairs || []).length > 2 ? (
                                        <button type="button" onClick={() => updateQuestion({ matchingPairs: question.matchingPairs.filter((_, itemIndex) => itemIndex !== pairIndex) })} disabled={isLocked} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50">
                                            <FiTrash2 />
                                        </button>
                                    ) : null}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => updateQuestion({ matchingPairs: [...(question.matchingPairs || []), { left: '', right: '' }] })}
                                disabled={isLocked}
                                className="ghost-button !px-4 !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FiPlus />
                                <span>Add pair</span>
                            </button>
                        </div>
                    ) : null}

                    {question.type === 'ordering' ? (
                        <div className="space-y-3">
                            {(question.orderedItems || []).map((item, itemIndex) => (
                                <div key={`${question.id}-ordered-${itemIndex}`} className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-500">{itemIndex + 1}</span>
                                    <input
                                        type="text"
                                        value={item}
                                        onChange={(event) => updateOrderedItem(itemIndex, event.target.value)}
                                        className="input-field flex-1 !py-2.5"
                                        placeholder={`Ordered item ${itemIndex + 1}`}
                                        disabled={isLocked}
                                    />
                                    {(question.orderedItems || []).length > 2 ? (
                                        <button type="button" onClick={() => updateQuestion({ orderedItems: question.orderedItems.filter((_, currentIndex) => currentIndex !== itemIndex) })} disabled={isLocked} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50">
                                            <FiTrash2 />
                                        </button>
                                    ) : null}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => updateQuestion({ orderedItems: [...(question.orderedItems || []), ''] })}
                                disabled={isLocked}
                                className="ghost-button !px-4 !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FiPlus />
                                <span>Add item</span>
                            </button>
                        </div>
                    ) : null}

                    <textarea
                        rows={2}
                        value={question.explanation || ''}
                        onChange={(event) => updateQuestion({ explanation: event.target.value })}
                        className="textarea-field"
                        placeholder="Explanation"
                        disabled={isLocked}
                    />

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
                            <input
                                type="checkbox"
                                checked={Boolean(question.scoringOverride?.active)}
                                onChange={(event) => updateQuestion({
                                    scoringOverride: {
                                        ...question.scoringOverride,
                                        active: event.target.checked,
                                        correct: question.scoringOverride?.correct ?? scoringDefaults.correct,
                                        incorrect: question.scoringOverride?.incorrect ?? scoringDefaults.incorrect,
                                        unanswered: question.scoringOverride?.unanswered ?? scoringDefaults.unanswered,
                                    },
                                })}
                                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                disabled={isLocked}
                            />
                            <span>Override default marks for this question</span>
                        </label>

                        {question.scoringOverride?.active ? (
                            <div className="mt-4 grid gap-4 md:grid-cols-3">
                                {[
                                    { key: 'correct', label: 'Correct' },
                                    { key: 'incorrect', label: 'Incorrect' },
                                    { key: 'unanswered', label: 'Unanswered' },
                                ].map((field) => (
                                    <div key={`${question.id}-${field.key}`}>
                                        <label className="label-text">{field.label}</label>
                                        <input
                                            type="number"
                                            step="0.25"
                                            value={question.scoringOverride[field.key]}
                                            onChange={(event) => updateQuestion({
                                                scoringOverride: {
                                                    ...question.scoringOverride,
                                                    [field.key]: clampNumber(event.target.value, 0),
                                                },
                                            })}
                                            className="input-field"
                                            disabled={isLocked}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

const AIExamReview = () => {
    const { examId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);
    const [availableGroups, setAvailableGroups] = useState([]);
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [unpublishing, setUnpublishing] = useState(false);

    useEffect(() => {
        axiosInstance.get(`/teacher/ai-exams/${examId}`)
            .then(async (response) => {
                const normalizedExam = {
                    ...response.data,
                    scoringDefaults: {
                        correct: response.data.scoringDefaults?.correct ?? 1,
                        incorrect: response.data.scoringDefaults?.incorrect ?? -0.5,
                        unanswered: response.data.scoringDefaults?.unanswered ?? 0,
                    },
                };

                normalizedExam.questions = (response.data.questions || []).map((question) => normalizeQuestionForType(question, normalizedExam.scoringDefaults));
                setExam(normalizedExam);

                if (response.data.moduleId) {
                    const workflow = await axiosInstance.get(`/teacher/modules/${response.data.moduleId}/workflow`);
                    setAvailableGroups(workflow.data.groups || []);
                }
            })
            .catch(() => setStatus({ type: 'error', text: 'Failed to load exam.' }))
            .finally(() => setLoading(false));
    }, [examId]);

    const validationErrors = useMemo(() => getExamValidationErrors(exam), [exam]);
    const isLocked = exam?.status === 'published';

    const maxScore = useMemo(() => {
        if (!exam) return 0;
        return Number(exam.questions.reduce((sum, question) => {
            const reward = question.scoringOverride?.active
                ? clampNumber(question.scoringOverride.correct, exam.scoringDefaults.correct)
                : clampNumber(exam.scoringDefaults.correct, 1);
            return sum + reward;
        }, 0).toFixed(2));
    }, [exam]);

    const updateQuestion = (index, nextQuestion) => {
        setExam((current) => {
            const nextQuestions = [...current.questions];
            nextQuestions[index] = normalizeQuestionForType(nextQuestion, current.scoringDefaults);
            return { ...current, questions: nextQuestions };
        });
    };

    const removeQuestion = (index) => {
        setExam((current) => ({
            ...current,
            questions: current.questions.filter((_, questionIndex) => questionIndex !== index),
        }));
    };

    const addQuestion = () => {
        setExam((current) => ({
            ...current,
            questions: [
                ...current.questions,
                normalizeQuestionForType(createQuestionTemplate(), current.scoringDefaults),
            ],
        }));
    };

    const updateScoringDefaults = (field, value) => {
        setExam((current) => ({
            ...current,
            scoringDefaults: {
                ...current.scoringDefaults,
                [field]: clampNumber(value, 0),
            },
        }));
    };

    const saveDraft = async () => {
        if (!exam) return;

        setSaving(true);
        setStatus(null);

        try {
            const response = await axiosInstance.put(`/teacher/ai-exams/${examId}`, {
                title: exam.title,
                questions: exam.questions,
                scoringDefaults: exam.scoringDefaults,
            });

            const normalizedExam = {
                ...response.data,
                scoringDefaults: {
                    correct: response.data.scoringDefaults?.correct ?? 1,
                    incorrect: response.data.scoringDefaults?.incorrect ?? -0.5,
                    unanswered: response.data.scoringDefaults?.unanswered ?? 0,
                },
            };
            normalizedExam.questions = (response.data.questions || []).map((question) => normalizeQuestionForType(question, normalizedExam.scoringDefaults));
            setExam(normalizedExam);
            setStatus({ type: 'success', text: 'Draft saved successfully.' });
        } catch (error) {
            const errorText = error.response?.data?.errors?.length
                ? error.response.data.errors.join(' ')
                : error.response?.data?.message || 'Failed to save draft.';
            setStatus({ type: 'error', text: errorText });
        } finally {
            setSaving(false);
        }
    };

    const unpublishExam = async () => {
        if (!exam || !isLocked) return;
        setUnpublishing(true);
        setStatus(null);
        try {
            const response = await axiosInstance.post(`/teacher/ai-exams/${examId}/unpublish`);
            setExam((current) => ({
                ...current,
                ...response.data.exam,
            }));
            setStatus({ type: 'success', text: 'Publication cancelled. You can edit the draft again.' });
        } catch (error) {
            setStatus({ type: 'error', text: error.response?.data?.message || 'Failed to cancel publication.' });
        } finally {
            setUnpublishing(false);
        }
    };

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" /></div>;
    }

    if (!exam) {
        return <div className="py-20 text-center text-slate-400">Exam not found.</div>;
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6 pb-20">
            <header className="page-hero">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="eyebrow">Step 6</p>
                        <h1 className="page-title">Review and edit generated exam</h1>
                        <p className="page-subtitle">Adjust questions, answers, correct choices, and points before publishing the exam to students.</p>
                    </div>
                    {location.state?.moduleId ? (
                        <Link to={`/teacher/exam-workflow/${location.state.moduleId}`} className="ghost-button !border-white/20 !bg-white/10 !text-white hover:!bg-white/20">
                            Back to workflow
                        </Link>
                    ) : null}
                </div>
            </header>

            <div className="surface-card p-6">
                {isLocked ? (
                    <div className="mb-5 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                        This exam is published and locked for editing. Cancel publication to make changes, then publish again when you are ready.
                    </div>
                ) : null}
                <label className="label-text">Exam title</label>
                <input
                    value={exam.title}
                    onChange={(event) => setExam((current) => ({ ...current, title: event.target.value }))}
                    className="input-field"
                    disabled={isLocked}
                />

                <div className="mt-6 grid gap-4 lg:grid-cols-[1fr,1fr]">
                    <div className="surface-muted p-5">
                        <p className="text-sm font-semibold text-slate-500">Default scoring</p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-3">
                            {[
                                { key: 'correct', label: 'Correct' },
                                { key: 'incorrect', label: 'Incorrect' },
                                { key: 'unanswered', label: 'Unanswered' },
                            ].map((field) => (
                                <div key={field.key}>
                                    <label className="label-text">{field.label}</label>
                                    <input
                                        type="number"
                                        step="0.25"
                                        value={exam.scoringDefaults[field.key]}
                                        onChange={(event) => updateScoringDefaults(field.key, event.target.value)}
                                        className="input-field"
                                        disabled={isLocked}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="surface-muted p-5">
                        <p className="text-sm font-semibold text-slate-500">Draft summary</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Questions</p>
                                <p className="mt-2 text-2xl font-extrabold text-slate-900">{exam.questions.length}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Status</p>
                                <p className="mt-2 text-2xl font-extrabold capitalize text-slate-900">{exam.status}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Max score</p>
                                <p className="mt-2 text-2xl font-extrabold text-slate-900">{maxScore}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {status ? (
                <div className={`rounded-[24px] border p-4 text-sm font-semibold ${status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    {status.text}
                </div>
            ) : null}

            {validationErrors.length > 0 ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-start gap-3">
                        <FiAlertCircle className="mt-0.5 text-xl text-amber-600" />
                        <div>
                            <p className="font-bold text-amber-800">Validation required before publishing</p>
                            <div className="mt-3 space-y-2">
                                {validationErrors.map((error) => (
                                    <p key={error} className="text-sm text-amber-700">{error}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                    Draft validation passed. You can save or publish when ready.
                </div>
            )}

            <div className="space-y-4">
                {exam.questions.map((question, index) => (
                    <QuestionEditor
                        key={question.id || index}
                        question={question}
                        index={index}
                        validationErrors={getQuestionValidationErrors(question, index)}
                        scoringDefaults={exam.scoringDefaults}
                        onChange={updateQuestion}
                        onRemove={removeQuestion}
                        isLocked={isLocked}
                    />
                ))}
            </div>

            <button type="button" onClick={addQuestion} disabled={isLocked} className="flex w-full items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-cyan-300 py-4 font-bold text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent">
                <FiPlus />
                <span>Add question</span>
            </button>

            <div className="sticky bottom-4 z-20 flex flex-col items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-xl sm:flex-row">
                <p className="text-sm font-medium text-slate-500">{exam.questions.length} questions | Status: <strong className="capitalize">{exam.status}</strong></p>
                <div className="flex gap-3">
                    {isLocked ? (
                        <button type="button" onClick={unpublishExam} disabled={unpublishing} className="danger-button">
                            <FiEdit2 />
                            <span>{unpublishing ? 'Cancelling...' : 'Cancel publication'}</span>
                        </button>
                    ) : null}
                    <button type="button" onClick={saveDraft} disabled={saving || exam.status === 'published'} className="action-button">
                        <FiSave />
                        <span>{saving ? 'Saving...' : 'Save draft'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsPublishModalOpen(true)}
                        disabled={exam.status === 'published' || validationErrors.length > 0}
                        className="secondary-button"
                    >
                        <FiSend />
                        <span>Publish exam</span>
                    </button>
                </div>
            </div>

            <PublishExamModal
                isOpen={isPublishModalOpen}
                onClose={() => setIsPublishModalOpen(false)}
                exam={{ id: exam._id, title: exam.title }}
                availableGroups={availableGroups}
                publishPath={`/teacher/ai-exams/${exam._id}/publish`}
                onPublishSuccess={() => {
                    setStatus({ type: 'success', text: 'Exam published to the live exam system.' });
                    setIsPublishModalOpen(false);
                    navigate(location.state?.moduleId ? `/teacher/modules/${location.state.moduleId}` : '/teacher/modules');
                }}
            />
        </div>
    );
};

export default AIExamReview;
