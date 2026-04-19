import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { FiBarChart2, FiUsers, FiAward, FiTrendingDown, FiTrendingUp, FiLoader } from 'react-icons/fi';
import { useParams, Link } from 'react-router-dom';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];

const DIFF_COLOR = {
    Easy: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: '#10b981' },
    Medium: { bg: 'bg-amber-100', text: 'text-amber-700', dot: '#f59e0b' },
    Hard: { bg: 'bg-red-100', text: 'text-red-700', dot: '#ef4444' },
};

const StatCard = ({ icon, label, value, sub, color }) => (
    <div className={`bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">{label}</p>
            <p className="text-3xl font-extrabold text-slate-800">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);

const ExamStatistics = () => {
    const { examId } = useParams();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null); // selected question for detail

    useEffect(() => {
        axiosInstance.get(`/teacher/statistics/${examId}`)
            .then(r => setStats(r.data))
            .catch(e => setError(e.response?.data?.message || 'Failed to load statistics.'))
            .finally(() => setLoading(false));
    }, [examId]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-72 gap-4">
            <FiLoader className="animate-spin text-4xl text-indigo-500" />
            <p className="text-slate-400 font-medium">Loading statistics…</p>
        </div>
    );

    if (error) return (
        <div className="max-w-xl mx-auto mt-20 text-center">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
                <p className="text-red-600 font-semibold">{error}</p>
                <Link to="/teacher/published-exams" className="mt-4 inline-block text-indigo-600 font-bold hover:underline">← Back to exams</Link>
            </div>
        </div>
    );

    const g = stats?.general || {};
    const questions = stats?.questions || [];

    const avg = parseFloat(g.average_score || 0).toFixed(2);
    const high = parseFloat(g.highest_score || 0).toFixed(2);
    const low = parseFloat(g.lowest_score || 0).toFixed(2);
    const total = g.total_students || 0;

    // Bar chart data: correct % per question
    const barData = questions.map((q, i) => ({
        name: `Q${q.index || i + 1}`,
        correct: parseFloat(q.correct_percentage),
        fullText: q.text,
    }));

    // Pie chart: difficulty distribution
    const diffCounts = { Easy: 0, Medium: 0, Hard: 0 };
    questions.forEach(q => { diffCounts[q.difficulty_level] = (diffCounts[q.difficulty_level] || 0) + 1; });
    const pieData = Object.entries(diffCounts)
        .filter(([, v]) => v > 0)
        .map(([name, value], i) => ({ name, value, color: DIFF_COLOR[name]?.dot || COLORS[i] }));

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const q = barData.find(d => d.name === label);
            return (
                <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 max-w-xs">
                    <p className="font-bold text-slate-700 text-xs mb-1">{label}</p>
                    <p className="text-xs text-slate-500 mb-2 line-clamp-2">{q?.fullText}</p>
                    <p className="text-indigo-600 font-extrabold">{payload[0].value.toFixed(1)}% correct</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <header className="bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-800 rounded-3xl p-8 text-white shadow-xl">
                <Link to="/teacher/published-exams" className="text-indigo-200 text-sm font-medium hover:text-white transition mb-3 inline-block">← Back to Exams</Link>
                <h1 className="text-3xl font-extrabold flex items-center gap-3">
                    <FiBarChart2 /> Exam Statistics
                </h1>
                <p className="text-indigo-300 mt-1">Detailed performance analytics for this exam</p>
            </header>

            {/* General Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<FiUsers className="text-indigo-600" />} label="Students" value={total} color="bg-indigo-50" />
                <StatCard icon={<FiAward className="text-emerald-600" />} label="Avg. Score" value={avg} sub="points" color="bg-emerald-50" />
                <StatCard icon={<FiTrendingUp className="text-violet-600" />} label="Highest" value={high} sub="points" color="bg-violet-50" />
                <StatCard icon={<FiTrendingDown className="text-rose-600" />} label="Lowest" value={low} sub="points" color="bg-rose-50" />
            </div>

            {questions.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-100 shadow-sm">
                    <FiBarChart2 className="text-4xl mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No submissions yet. Statistics will appear once students submit this exam.</p>
                </div>
            ) : (
                <>
                    {/* Charts Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Bar Chart */}
                        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h2 className="text-base font-bold text-slate-700 mb-4">Correct Answer Rate per Question</h2>
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={barData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} unit="%" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="correct" radius={[6, 6, 0, 0]}
                                        fill="url(#barGradient)">
                                        {barData.map((_, i) => (
                                            <Cell key={i} fill={parseFloat(barData[i].correct) < 30 ? '#ef4444' : parseFloat(barData[i].correct) < 70 ? '#f59e0b' : '#6366f1'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Pie Chart - Difficulty Distribution */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
                            <h2 className="text-base font-bold text-slate-700 mb-4">Difficulty Distribution</h2>
                            <div className="flex-1 flex items-center justify-center">
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                            {pieData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                                        <Tooltip formatter={(v, n) => [`${v} questions`, n]} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Per-Question Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h2 className="text-base font-bold text-slate-700">Per-Question Breakdown</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Click a row to see more detail</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                        <th className="px-6 py-3 text-left">#</th>
                                        <th className="px-6 py-3 text-left">Question</th>
                                        <th className="px-6 py-3 text-center">Attempts</th>
                                        <th className="px-6 py-3 text-center">Correct</th>
                                        <th className="px-6 py-3 text-center">Correct %</th>
                                        <th className="px-6 py-3 text-center">Difficulty</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {questions.map((q, i) => {
                                        const dc = DIFF_COLOR[q.difficulty_level] || DIFF_COLOR.Medium;
                                        const pct = parseFloat(q.correct_percentage);
                                        return (
                                            <React.Fragment key={q.question_id}>
                                                <tr
                                                    className="hover:bg-indigo-50 cursor-pointer transition"
                                                    onClick={() => setSelected(selected === q.question_id ? null : q.question_id)}
                                                >
                                                    <td className="px-6 py-4 font-bold text-slate-400">Q{q.index || i + 1}</td>
                                                    <td className="px-6 py-4 text-slate-700 max-w-sm">
                                                        <p className="line-clamp-1 font-medium">{q.text}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-slate-600">{q.total_attempts}</td>
                                                    <td className="px-6 py-4 text-center text-emerald-600 font-semibold">{q.correct_count}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="w-20 bg-slate-100 rounded-full h-2">
                                                                <div
                                                                    className="h-2 rounded-full"
                                                                    style={{
                                                                        width: `${pct}%`,
                                                                        backgroundColor: pct < 30 ? '#ef4444' : pct < 70 ? '#f59e0b' : '#6366f1'
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="font-bold text-slate-700">{pct.toFixed(0)}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${dc.bg} ${dc.text}`}>
                                                            {q.difficulty_level}
                                                        </span>
                                                    </td>
                                                </tr>
                                                {selected === q.question_id && (
                                                    <tr className="bg-indigo-50">
                                                        <td colSpan={6} className="px-6 py-4">
                                                            <p className="text-slate-700 font-medium mb-1 text-sm">{q.text}</p>
                                                            {q.mostSelectedWrong && (
                                                                <p className="text-xs text-red-600">
                                                                    <strong>Most selected wrong answer:</strong>{' '}
                                                                    {Array.isArray(q.mostSelectedWrong) ? q.mostSelectedWrong.join(', ') : q.mostSelectedWrong}
                                                                </p>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ExamStatistics;
