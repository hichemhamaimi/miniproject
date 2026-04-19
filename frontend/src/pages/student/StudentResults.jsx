import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FiAward, FiCalendar, FiCheckCircle, FiXCircle, FiChevronDown, FiChevronUp, FiLoader, FiInbox } from 'react-icons/fi';
import { Link } from 'react-router-dom';

const ScoreBadge = ({ score, maxScore }) => {
    const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const color = pct >= 70 ? 'from-emerald-500 to-teal-500'
        : pct >= 40 ? 'from-amber-400 to-orange-500'
        : 'from-red-500 to-rose-600';
    return (
        <div className={`inline-flex items-center gap-1.5 bg-gradient-to-r ${color} text-white text-xs font-extrabold px-3 py-1.5 rounded-full shadow`}>
            <FiAward className="text-sm" />
            {parseFloat(score).toFixed(2)} pts
        </div>
    );
};

const AnswerDetail = ({ examData, answers }) => {
    if (!examData || !answers) return null;
    const questions = examData.questions || [];

    return (
        <div className="px-6 pb-6 space-y-3 border-t border-indigo-100 pt-4">
            {questions.map((q, i) => {
                const ans = answers.find(a => a.question_id === q.id);
                const isCorrect = ans?.is_correct;
                const studentChoice = ans?.selected_choice;

                return (
                    <div key={q.id || i} className={`rounded-xl p-4 border text-sm ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-start gap-3">
                            {isCorrect
                                ? <FiCheckCircle className="text-emerald-500 mt-0.5 flex-shrink-0 text-base" />
                                : <FiXCircle className="text-red-500 mt-0.5 flex-shrink-0 text-base" />}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-700 mb-1">Q{i + 1}. {q.question || q.text}</p>
                                <p className="text-xs text-slate-500">
                                    <span className="font-bold">Your answer: </span>
                                    {studentChoice === null || studentChoice === undefined
                                        ? <span className="text-slate-400 italic">Not answered</span>
                                        : Array.isArray(studentChoice)
                                            ? studentChoice.join(', ')
                                            : String(studentChoice)}
                                </p>
                                {!isCorrect && q.explanation && (
                                    <p className="text-xs mt-2 text-slate-600 bg-white/60 rounded-lg px-3 py-2 border border-slate-200">
                                        <span className="font-bold text-indigo-600">Explanation: </span>{q.explanation}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ResultCard = ({ result }) => {
    const [open, setOpen] = useState(false);
    const [detail, setDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const toggle = async () => {
        if (!open && !detail) {
            setLoadingDetail(true);
            try {
                const res = await axiosInstance.get(`/student/results/${result.result_id}`);
                setDetail(res.data);
            } catch (_) {}
            setLoadingDetail(false);
        }
        setOpen(o => !o);
    };

    const date = new Date(result.submitted_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div
                className="flex items-center justify-between px-6 py-5 cursor-pointer hover:bg-slate-50 transition"
                onClick={toggle}
            >
                <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate text-base">{result.exam_title}</p>
                    {result.module_name && (
                        <p className="text-xs text-indigo-500 font-semibold mt-0.5">{result.module_name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                        <FiCalendar className="text-sm" />
                        <span>{date}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <ScoreBadge score={result.score} maxScore={detail?.examData?.questions?.length || 1} />
                    {open
                        ? <FiChevronUp className="text-slate-400 text-lg" />
                        : <FiChevronDown className="text-slate-400 text-lg" />}
                </div>
            </div>

            {open && (
                loadingDetail
                    ? <div className="flex justify-center py-6"><FiLoader className="animate-spin text-2xl text-indigo-400" /></div>
                    : detail && <AnswerDetail examData={detail.examData} answers={detail.answers} />
            )}
        </div>
    );
};

const StudentResults = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axiosInstance.get('/student/results')
            .then(r => setResults(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <header className="bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700 rounded-3xl p-8 text-white shadow-xl">
                <h1 className="text-3xl font-extrabold flex items-center gap-3">
                    <FiAward /> My Results
                </h1>
                <p className="text-emerald-200 mt-1">Review your submitted exams and see the feedback</p>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-52 gap-4">
                    <FiLoader className="animate-spin text-4xl text-emerald-500" />
                    <p className="text-slate-400 font-medium">Loading your results…</p>
                </div>
            ) : results.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
                    <FiInbox className="text-5xl text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-semibold text-lg">No results yet</p>
                    <p className="text-slate-400 text-sm mt-1">Complete an exam to see your results here.</p>
                    <Link to="/student/dashboard" className="mt-5 inline-block bg-emerald-600 text-white rounded-xl px-6 py-2.5 font-bold hover:bg-emerald-700 transition text-sm">
                        Browse Exams
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {results.map(r => <ResultCard key={r.result_id} result={r} />)}
                </div>
            )}
        </div>
    );
};

export default StudentResults;
