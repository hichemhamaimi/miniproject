import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { FaArrowUp, FaArrowDown, FaLock, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';

const TakeExam = () => {
    const { examId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [exam, setExam] = useState(null);
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSEBBlocked, setIsSEBBlocked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    const [remainingTime, setRemainingTime] = useState(null); // milliseconds
    const socketRef = useRef(null);
    const timerIntervalRef = useRef(null);

    // Function to calculate HH:MM:SS
    const formatTime = (ms) => {
        if (ms <= 0) return "00:00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const submitExamPayload = async (autoSubmit = false) => {
        setSubmitting(true);
        try {
            const submissionPayload = {
                answers: Object.entries(answers).map(([qId, ans]) => ({
                    questionId: qId,
                    answer: ans
                }))
            };

            await axiosInstance.post(`/student/exams/${examId}/submit`, submissionPayload);
            
            if (autoSubmit) {
                alert("Time is up! Your answers have been automatically submitted.");
            } else {
                alert("Exam submitted successfully!");
            }
            
            // Clean up sockets
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            navigate('/student/dashboard');
        } catch (err) {
            console.error("Submission failed", err);
            // Even if it fails, if it's auto-submit, we probably shouldn't let them keep editing
            if (!autoSubmit) {
                alert("Failed to submit exam.");
            }
            setSubmitting(false);
        }
    };

    useEffect(() => {
        const fetchAndStartExam = async () => {
            try {
                const res = await axiosInstance.post(`/student/exams/${examId}/start`, {}, {
                    // Send a dummy SEB header if we are simulating the behavior in dev (remove in real prod)
                    // headers: { 'x-safeexambrowser': '1' } 
                });
                
                const examData = res.data.examData;
                
                // Initialize answers
                const initialAnswers = {};
                examData.questions.forEach(q => {
                    if (q.type === 'ordering') {
                        initialAnswers[q.id] = [...q.orderedItems].sort(() => Math.random() - 0.5);
                    } else if (q.type === 'matching') {
                        initialAnswers[q.id] = q.matchingPairs.map(p => ({ left: p.left, right: '' }));
                    } else if (q.type === 'multiple_choice') {
                        initialAnswers[q.id] = [];
                    }
                });
                setAnswers(initialAnswers);
                setExam(res.data);
                setLoading(false);

                // --- INITIALIZE WEBSOCKET FOR TIMER ---
                socketRef.current = io(process.env.REACT_APP_API_URL || 'http://localhost:3500');
                
                socketRef.current.on('connect', () => {
                    // Join the exam session room
                    socketRef.current.emit('join_exam', { examId, studentId: user.id });
                });

                // Server gives us the authoritative remaining time
                socketRef.current.on('timer_sync', (data) => {
                    setRemainingTime(data.remainingMs);
                    
                    // Start a local visual countdown to prevent hammering the server
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                    
                    timerIntervalRef.current = setInterval(() => {
                        setRemainingTime(prev => {
                            if (prev <= 1000) {
                                clearInterval(timerIntervalRef.current);
                                return 0;
                            }
                            return prev - 1000;
                        });
                    }, 1000);
                });

                // Server dictates time is up
                socketRef.current.on('TIME_EXPIRED', () => {
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                    setRemainingTime(0);
                    submitExamPayload(true); // Force auto-submit
                });

            } catch (err) {
                console.error(err);
                if (err.response?.data?.code === 'SEB_REQUIRED') {
                    setIsSEBBlocked(true);
                } else {
                    setError(err.response?.data?.message || 'Failed to connect to exam session.');
                }
                setLoading(false);
            }
        };
        fetchAndStartExam();

        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (socketRef.current) socketRef.current.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [examId, user]);

    // Input handlers
    const handleAnswerChange = (questionId, value) => setAnswers(prev => ({ ...prev, [questionId]: value }));
    const handleMultipleChoiceChange = (questionId, optionStr, isChecked) => {
        setAnswers(prev => {
            const current = prev[questionId] || [];
            if (isChecked) return { ...prev, [questionId]: [...current, optionStr] };
            return { ...prev, [questionId]: current.filter(val => val !== optionStr) };
        });
    };
    const handleMatchingChange = (questionId, leftItem, rightSelected) => {
        setAnswers(prev => {
            const current = prev[questionId] || [];
            const updated = current.map(pair => pair.left === leftItem ? { ...pair, right: rightSelected } : pair);
            return { ...prev, [questionId]: updated };
        });
    };
    const moveOrderingItem = (questionId, index, direction) => {
        setAnswers(prev => {
            const arr = [...(prev[questionId] || [])];
            if (direction === 'up' && index > 0) [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
            else if (direction === 'down' && index < arr.length - 1) [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
            return { ...prev, [questionId]: arr };
        });
    };

    const handleManualSubmit = () => {
        if (!window.confirm("Are you sure you want to finish early? You cannot change your answers afterward.")) return;
        submitExamPayload(false);
    };

    // --- RENDER SEB BLOCKER ---
    if (isSEBBlocked) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in-up">
                <FaLock className="text-red-500 w-24 h-24 mb-6 shadow-xl rounded-full p-4 bg-red-50" />
                <h1 className="text-3xl font-extrabold text-slate-800 mb-4">Safe Exam Browser Required</h1>
                <p className="text-lg text-slate-600 max-w-lg mb-8">
                    Security settings require this exam to be taken exclusively through the <strong>Safe Exam Browser (SEB)</strong>. Standard web browsers are strictly prohibited.
                </p>
                <div className="bg-slate-100 p-6 rounded-2xl w-full max-w-lg text-left shadow-inner">
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><FaExclamationTriangle className="text-amber-500" /> Instructions</h3>
                    <ol className="list-decimal pl-5 space-y-2 text-slate-600 text-sm">
                        <li>Ensure SEB is installed on your machine.</li>
                        <li>Download the <span className="font-mono text-xs bg-slate-200 px-1 rounded">.seb</span> configuration file provided by your instructor.</li>
                        <li>Open the file, which will launch SEB, lock your environment, and bring you directly to the exam login page.</li>
                    </ol>
                </div>
            </div>
        );
    }

    if (loading) return <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-600"></div></div>;
    if (error) return <div className="p-8 text-center text-red-500 font-bold bg-red-50 border border-red-200 rounded-2xl m-4">{error}</div>;

    const questions = exam.examData.questions;
    const isTimeUrgent = remainingTime !== null && remainingTime < 300000; // Less than 5 mins

    return (
        <div className="max-w-4xl mx-auto pb-20 mt-8 relative animate-fade-in">
            {/* Countdown HUD */}
            {remainingTime !== null && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-mono font-bold text-xl transition-colors ${
                    isTimeUrgent ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-emerald-400'
                }`}>
                    <FaLock />
                    {formatTime(remainingTime)}
                </div>
            )}

            <header className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center mb-8">
                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{exam.title}</h1>
                <p className="text-slate-500 mt-2 font-medium">Please read all questions carefully. Do not refresh or exit the fullscreen session.</p>
            </header>

            <div className="space-y-6">
                {questions.map((q, index) => (
                    <div key={q.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                        <div className="flex gap-4 mb-6">
                            <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-700 font-bold rounded-full">{index + 1}</span>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 leading-snug">{q.text}</h3>
                                {q.type === 'negative_qcm' && <span className="inline-block mt-2 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded">Select the INCORRECT statement</span>}
                                {q.type === 'multiple_choice' && <span className="inline-block mt-2 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">Select ALL that apply</span>}
                            </div>
                        </div>

                        <div className="ml-12">
                            {(q.type === 'single_choice' || q.type === 'negative_qcm') && (
                                <div className="space-y-3">
                                    {q.options.map((opt, i) => (
                                        <label key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition">
                                            <input 
                                                type="radio" name={`q_${q.id}`} value={opt} checked={answers[q.id] === opt}
                                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-slate-700">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {q.type === 'multiple_choice' && (
                                <div className="space-y-3">
                                    {q.options.map((opt, i) => (
                                        <label key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition">
                                            <input 
                                                type="checkbox" value={opt} checked={answers[q.id]?.includes(opt) || false}
                                                onChange={(e) => handleMultipleChoiceChange(q.id, opt, e.target.checked)}
                                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                            />
                                            <span className="text-slate-700">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {q.type === 'true_false' && (
                                <div className="flex gap-6">
                                    {['true', 'false'].map((opt) => (
                                        <label key={opt} className="flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                                            <input 
                                                type="radio" name={`q_${q.id}`} value={opt === 'true'} checked={answers[q.id] === (opt === 'true')}
                                                onChange={() => handleAnswerChange(q.id, opt === 'true')}
                                                className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-slate-800 font-bold uppercase">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {q.type === 'matching' && (
                                <div className="space-y-4">
                                    {q.matchingPairs.map((pair, i) => (
                                        <div key={i} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                                            <div className="flex-1 font-semibold text-slate-700">{pair.left}</div>
                                            <div className="flex-shrink-0 text-slate-400 font-bold hidden md:block">➔</div>
                                            <select 
                                                className="flex-1 bg-white border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={answers[q.id]?.find(p => p.left === pair.left)?.right || ''}
                                                onChange={(e) => handleMatchingChange(q.id, pair.left, e.target.value)}
                                            >
                                                <option value="">-- Match with... --</option>
                                                {[...q.matchingPairs].sort((a,b) => a.right.localeCompare(b.right)).map((p, ri) => (
                                                    <option key={ri} value={p.right}>{p.right}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {q.type === 'ordering' && (
                                <div className="space-y-3">
                                    {(answers[q.id] || []).map((item, i) => (
                                        <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 bg-white shadow-sm">
                                            <span className="font-bold text-slate-400 w-6 text-center">{i + 1}.</span>
                                            <div className="flex-1 text-slate-800 font-medium">{item}</div>
                                            <div className="flex flex-col gap-1">
                                                <button onClick={() => moveOrderingItem(q.id, i, 'up')} disabled={i === 0} className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 border-none transition disabled:opacity-30">
                                                    <FaArrowUp size={12} />
                                                </button>
                                                <button onClick={() => moveOrderingItem(q.id, i, 'down')} disabled={i === (answers[q.id]?.length || 0) - 1} className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 border-none transition disabled:opacity-30">
                                                    <FaArrowDown size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl shadow-xl mt-8 flex justify-between items-center text-white sticky bottom-6 z-10 border border-slate-700">
                <div className="text-sm">
                    <span className="font-bold block mb-1">Make sure you have answered all questions.</span>
                    <span className="opacity-70">Exams are collected automatically when time expires.</span>
                </div>
                <button 
                    onClick={handleManualSubmit} 
                    disabled={submitting}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-8 py-3 rounded-xl font-extrabold hover:shadow-lg transition-all disabled:opacity-50"
                >
                    {submitting ? 'Submitting...' : 'Finish Exam Early'}
                </button>
            </div>
        </div>
    );
};

export default TakeExam;
