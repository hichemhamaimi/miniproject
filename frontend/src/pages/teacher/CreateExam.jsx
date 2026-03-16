import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { FaPlus, FaTrash, FaCogs } from 'react-icons/fa';

const QUESTION_TYPES = [
    { value: 'single_choice', label: 'Single Choice' },
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'negative_qcm', label: 'Negative QCM (Find Incorrect)' },
    { value: 'true_false', label: 'True / False' },
    { value: 'matching', label: 'Matching Pairs' },
    { value: 'ordering', label: 'Ordering' }
];

const generateId = () => Math.random().toString(36).substr(2, 9);

const getDefaultQuestion = (type) => {
    const base = {
        id: generateId(),
        type,
        text: '',
        explanation: '',
        scoringOverride: { active: false, correct: 1, incorrect: -0.5, unanswered: 0 }
    };
    switch (type) {
        case 'single_choice':
        case 'negative_qcm':
            return { ...base, options: ['', ''], correctAnswers: [''] };
        case 'multiple_choice':
            return { ...base, options: ['', '', '', ''], correctAnswers: [] };
        case 'true_false':
            return { ...base, trueFalseAnswer: 'true' }; // Will map to boolean
        case 'matching':
            return { ...base, matchingPairs: [{ left: '', right: '' }, { left: '', right: '' }] };
        case 'ordering':
            return { ...base, orderedItems: ['', '', ''] };
        default:
            return base;
    }
};

const CreateExam = () => {
    const location = useLocation();
    const preselectedModuleId = location.state?.preselectedModuleId || '';
    const navigate = useNavigate();
    const [statusMessage, setStatusMessage] = useState(null);
    const [modules, setModules] = useState([]);

    const { register, control, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm({
        defaultValues: {
            title: '',
            module_id: preselectedModuleId,
            duration_minutes: 60,
            scoringDefaults: { correct: 1, incorrect: -0.5, unanswered: 0 },
            questions: []
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "questions" });

    useEffect(() => {
        if (preselectedModuleId) setValue('module_id', preselectedModuleId);
        axiosInstance.get('/teacher/modules')
            .then(res => setModules(res.data))
            .catch(err => console.error("Failed to fetch modules", err));
    }, [preselectedModuleId, setValue]);

    const handleAddQuestion = (type) => {
        append(getDefaultQuestion(type));
    };

    const onSubmit = async (data) => {
        try {
            setStatusMessage(null);
            
            // Format Payload
            const formattedQuestions = data.questions.map(q => {
                const formatted = {
                    id: q.id,
                    type: q.type,
                    text: q.text,
                    explanation: q.explanation,
                    scoringOverride: {
                        active: q.scoringOverride.active,
                        correct: parseFloat(q.scoringOverride.correct),
                        incorrect: parseFloat(q.scoringOverride.incorrect),
                        unanswered: parseFloat(q.scoringOverride.unanswered)
                    }
                };
                
                if (q.type === 'single_choice' || q.type === 'negative_qcm') {
                    formatted.options = q.options;
                    // For single choice, the correctAnswers is bound to the radio value which is the index or option string
                    // We need to map it if it's an index
                    const answerIndex = parseInt(q.correctAnswers[0]);
                    formatted.correctAnswers = [q.options[answerIndex]]; 
                } else if (q.type === 'multiple_choice') {
                    formatted.options = q.options;
                    // Checkboxes return an array of strings (if we bind to values) or booleans
                    // We bind checkboxes to the option string itself
                    formatted.correctAnswers = Array.isArray(q.correctAnswers) ? q.correctAnswers.filter(Boolean) : [];
                } else if (q.type === 'true_false') {
                    formatted.trueFalseAnswer = q.trueFalseAnswer === 'true';
                } else if (q.type === 'matching') {
                    formatted.matchingPairs = q.matchingPairs;
                } else if (q.type === 'ordering') {
                    formatted.orderedItems = q.orderedItems;
                }
                
                return formatted;
            });

            if (formattedQuestions.length === 0) {
                setStatusMessage({ type: 'error', text: 'You must add at least one question to the exam.' });
                return;
            }

            const payload = {
                title: data.title,
                module_id: parseInt(data.module_id) || null,
                duration_minutes: parseInt(data.duration_minutes) || 60,
                examData: {
                    scoringDefaults: {
                        correct: parseFloat(data.scoringDefaults.correct),
                        incorrect: parseFloat(data.scoringDefaults.incorrect),
                        unanswered: parseFloat(data.scoringDefaults.unanswered),
                    },
                    questions: formattedQuestions
                }
            };

            await axiosInstance.post('/teacher/exams', payload);
            setStatusMessage({ type: 'success', text: 'Exam published successfully!' });
            setTimeout(() => navigate('/teacher/dashboard'), 2000);
        } catch (error) {
            setStatusMessage({ type: 'error', text: error.response?.data?.message || 'Failed to publish exam.' });
        }
    };

    // Helper functions for dynamic array manipulation
    const handleAddOption = (index, type) => {
        let currentOptions = watch(`questions.${index}.options`) || [];
        setValue(`questions.${index}.options`, [...currentOptions, '']);
    };

    const handleRemoveOption = (index, optIdx) => {
        let currentOptions = watch(`questions.${index}.options`) || [];
        if (currentOptions.length > 2) {
            const newOptions = currentOptions.filter((_, i) => i !== optIdx);
            setValue(`questions.${index}.options`, newOptions);
        }
    };

    const handleAddPair = (index) => {
        let currentPairs = watch(`questions.${index}.matchingPairs`) || [];
        setValue(`questions.${index}.matchingPairs`, [...currentPairs, { left: '', right: '' }]);
    };

    const handleRemovePair = (index, pairIdx) => {
        let currentPairs = watch(`questions.${index}.matchingPairs`) || [];
        if (currentPairs.length > 2) {
            const newPairs = currentPairs.filter((_, i) => i !== pairIdx);
            setValue(`questions.${index}.matchingPairs`, newPairs);
        }
    };

    const handleAddOrderedItem = (index) => {
        let currentItems = watch(`questions.${index}.orderedItems`) || [];
        setValue(`questions.${index}.orderedItems`, [...currentItems, '']);
    };

    const handleRemoveOrderedItem = (index, itemIdx) => {
        let currentItems = watch(`questions.${index}.orderedItems`) || [];
        if (currentItems.length > 2) {
            const newItems = currentItems.filter((_, i) => i !== itemIdx);
            setValue(`questions.${index}.orderedItems`, newItems);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
            <header className="bg-gradient-to-r from-indigo-700 to-purple-800 p-8 rounded-3xl shadow-lg border border-indigo-600 text-white">
                <h1 className="text-3xl font-extrabold tracking-tight">Create Mixed QCM Exam</h1>
                <p className="text-indigo-200 mt-2 text-lg">Build complex exams with polymorphic question types and custom scoring.</p>
            </header>

            {statusMessage && (
                <div className={`p-4 rounded-xl font-bold text-sm shadow-sm ${statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                    {statusMessage.text}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {/* Meta Configuration */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                    <h2 className="text-xl font-bold text-slate-800 border-b pb-4">Exam Settings</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Exam Title</label>
                            <input 
                                type="text" 
                                className="block w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500"
                                placeholder="e.g. Finals Compilation"
                                {...register('title', { required: 'Title required' })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Assign to Module</label>
                            <select 
                                className="block w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500"
                                {...register('module_id', { required: 'Module required' })}
                            >
                                <option value="">Select a module...</option>
                                {modules.map(mod => <option key={mod.id} value={mod.id}>{mod.abbreviation} - {mod.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Duration (in minutes)</label>
                            <input 
                                type="number" 
                                min="1"
                                className="block w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500"
                                placeholder="e.g. 60"
                                {...register('duration_minutes', { required: 'Duration required', min: 1 })}
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><FaCogs /> Global Scoring Defaults</h3>
                        <div className="grid grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase">Correct (+)</label>
                                <input type="number" step="0.1" className="block w-full border-slate-300 rounded-lg shadow-sm" {...register('scoringDefaults.correct')} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase">Incorrect (-)</label>
                                <input type="number" step="0.1" className="block w-full border-slate-300 rounded-lg shadow-sm" {...register('scoringDefaults.incorrect')} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase">Unanswered</label>
                                <input type="number" step="0.1" className="block w-full border-slate-300 rounded-lg shadow-sm" {...register('scoringDefaults.unanswered')} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Questions Array */}
                <div className="space-y-8">
                    {fields.map((field, index) => {
                        const qType = watch(`questions.${index}.type`);
                        const scoringActive = watch(`questions.${index}.scoringOverride.active`);

                        return (
                            <div key={field.id} className="bg-white p-8 rounded-3xl shadow-lg border border-slate-200 relative transform transition-all hover:-translate-y-1">
                                <button type="button" onClick={() => remove(index)} className="absolute top-6 right-6 text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 w-10 h-10 rounded-full flex items-center justify-center transition" title="Remove Question">
                                    <FaTrash />
                                </button>
                                
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="flex items-center justify-center w-10 h-10 bg-indigo-600 text-white font-bold rounded-full">{index + 1}</span>
                                    <h3 className="text-xl font-bold text-slate-800">
                                        {QUESTION_TYPES.find(t => t.value === qType)?.label || 'Question'}
                                    </h3>
                                    <input type="hidden" {...register(`questions.${index}.type`)} />
                                </div>
                                
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Question Text</label>
                                        <textarea 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500"
                                            rows="2"
                                            placeholder="Write the question prompt here..."
                                            {...register(`questions.${index}.text`, { required: true })}
                                        ></textarea>
                                    </div>

                                    {/* Type Specific Rendering */}
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                                        {(qType === 'single_choice' || qType === 'negative_qcm') && (() => {
                                            const options = watch(`questions.${index}.options`) || [];
                                            return (
                                            <div className="space-y-3">
                                                <label className="block text-sm font-bold text-slate-700 mb-2">Options (Select the correct one)</label>
                                                {options.map((opt, optIdx) => (
                                                    <div key={optIdx} className="flex items-center gap-3">
                                                        <input type="radio" value={optIdx} {...register(`questions.${index}.correctAnswers.0`)} className="w-5 h-5 text-indigo-600 focus:ring-indigo-500" defaultChecked={optIdx === 0} />
                                                        <input type="text" placeholder={`Option ${optIdx + 1}`} className="flex-1 bg-white border border-slate-300 rounded-lg py-2 px-3 focus:ring-indigo-500" {...register(`questions.${index}.options.${optIdx}`)} />
                                                        {options.length > 2 && (
                                                            <button type="button" onClick={() => handleRemoveOption(index, optIdx)} className="text-red-500 hover:text-red-700 p-2"><FaTrash /></button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => handleAddOption(index, qType)} className="mt-2 text-sm text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1">
                                                    <FaPlus /> Add Option
                                                </button>
                                            </div>
                                            );
                                        })()}

                                        {qType === 'multiple_choice' && (() => {
                                            const options = watch(`questions.${index}.options`) || [];
                                            return (
                                            <div className="space-y-3">
                                                <label className="block text-sm font-bold text-slate-700 mb-2">Options (Check all valid correct answers)</label>
                                                {options.map((opt, optIdx) => {
                                                    const optVal = watch(`questions.${index}.options.${optIdx}`); // Watch option string
                                                    return (
                                                        <div key={optIdx} className="flex items-center gap-3">
                                                            <input type="checkbox" value={optVal || ''} {...register(`questions.${index}.correctAnswers`)} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
                                                            <input type="text" placeholder={`Option ${optIdx + 1}`} className="flex-1 bg-white border border-slate-300 rounded-lg py-2 px-3 focus:ring-indigo-500" {...register(`questions.${index}.options.${optIdx}`)} />
                                                            {options.length > 2 && (
                                                                <button type="button" onClick={() => handleRemoveOption(index, optIdx)} className="text-red-500 hover:text-red-700 p-2"><FaTrash /></button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                <button type="button" onClick={() => handleAddOption(index, qType)} className="mt-2 text-sm text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1">
                                                    <FaPlus /> Add Option
                                                </button>
                                            </div>
                                            );
                                        })()}

                                        {qType === 'true_false' && (
                                            <div className="space-y-4">
                                                <label className="block text-sm font-bold text-slate-700 mb-2">Correct Answer</label>
                                                <select className="block w-full md:w-1/2 bg-white border border-slate-300 rounded-lg py-2 px-3 focus:ring-indigo-500" {...register(`questions.${index}.trueFalseAnswer`)}>
                                                    <option value="true">True</option>
                                                    <option value="false">False</option>
                                                </select>
                                            </div>
                                        )}

                                        {qType === 'matching' && (() => {
                                            const pairs = watch(`questions.${index}.matchingPairs`) || [];
                                            return (
                                            <div className="space-y-4">
                                                <label className="block text-sm font-bold text-slate-700 mb-2">Matching Pairs</label>
                                                {pairs.map((pair, pairIdx) => (
                                                    <div key={pairIdx} className="flex gap-4 items-center">
                                                        <input type="text" placeholder="Left Side Item" className="flex-1 border-slate-300 rounded-lg p-2" {...register(`questions.${index}.matchingPairs.${pairIdx}.left`)} />
                                                        <span className="text-slate-400 font-bold">=</span>
                                                        <input type="text" placeholder="Right Side Match" className="flex-1 border-slate-300 rounded-lg p-2" {...register(`questions.${index}.matchingPairs.${pairIdx}.right`)} />
                                                        {pairs.length > 2 && (
                                                            <button type="button" onClick={() => handleRemovePair(index, pairIdx)} className="text-red-500 hover:text-red-700 p-2"><FaTrash /></button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => handleAddPair(index)} className="mt-2 text-sm text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1">
                                                    <FaPlus /> Add Pair
                                                </button>
                                            </div>
                                            );
                                        })()}

                                        {qType === 'ordering' && (() => {
                                            const items = watch(`questions.${index}.orderedItems`) || [];
                                            return (
                                            <div className="space-y-3">
                                                <label className="block text-sm font-bold text-slate-700 mb-2">Ordered Items (Enter in CORRECT order)</label>
                                                {items.map((item, orderIdx) => (
                                                    <div key={orderIdx} className="flex items-center gap-4">
                                                        <span className="w-8 flex justify-center text-slate-400 font-bold">{orderIdx + 1}.</span>
                                                        <input type="text" placeholder={`Item ${orderIdx + 1}`} className="flex-1 border-slate-300 rounded-lg p-2" {...register(`questions.${index}.orderedItems.${orderIdx}`)} />
                                                        {items.length > 2 && (
                                                            <button type="button" onClick={() => handleRemoveOrderedItem(index, orderIdx)} className="text-red-500 hover:text-red-700 p-2"><FaTrash /></button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => handleAddOrderedItem(index)} className="mt-2 text-sm text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1">
                                                    <FaPlus /> Add Item
                                                </button>
                                            </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Scoring Override Config per Question */}
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="flex items-center gap-2 mb-4">
                                            <input type="checkbox" id={`override-${index}`} {...register(`questions.${index}.scoringOverride.active`)} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
                                            <label htmlFor={`override-${index}`} className="text-sm font-bold text-slate-700 cursor-pointer">Override Global Scoring for this Question</label>
                                        </div>
                                        
                                        {scoringActive && (
                                            <div className="grid grid-cols-3 gap-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                                                <div>
                                                    <label className="block text-xs font-semibold text-indigo-800 uppercase">Correct (+)</label>
                                                    <input type="number" step="0.1" className="block w-full border-indigo-200 rounded-lg shadow-sm" {...register(`questions.${index}.scoringOverride.correct`)} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-indigo-800 uppercase">Incorrect (-)</label>
                                                    <input type="number" step="0.1" className="block w-full border-indigo-200 rounded-lg shadow-sm" {...register(`questions.${index}.scoringOverride.incorrect`)} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-indigo-800 uppercase">Unanswered</label>
                                                    <input type="number" step="0.1" className="block w-full border-indigo-200 rounded-lg shadow-sm" {...register(`questions.${index}.scoringOverride.unanswered`)} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Add New Question Toolbar */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky bottom-6 z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex flex-wrap gap-2">
                        <span className="text-sm font-bold text-slate-500 w-full md:w-auto flex items-center mr-2">Add Question Type:</span>
                        {QUESTION_TYPES.map(type => (
                            <button 
                                key={type.value}
                                type="button" 
                                onClick={() => handleAddQuestion(type.value)}
                                className="px-3 py-2 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                            >
                                <FaPlus /> {type.label}
                            </button>
                        ))}
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full md:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-extrabold hover:shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 text-lg"
                    >
                        {isSubmitting ? 'Publishing Exam...' : 'Publish Exam Now'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateExam;
