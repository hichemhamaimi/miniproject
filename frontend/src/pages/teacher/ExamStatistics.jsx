import React, { useEffect, useMemo, useState } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import {
    FiAlertCircle,
    FiAward,
    FiBarChart2,
    FiLayers,
    FiLoader,
    FiShield,
    FiTarget,
    FiTrendingUp,
    FiUsers,
} from 'react-icons/fi';
import { Link, useParams } from 'react-router-dom';
import { formatAppDateTime } from '../../utils/dateTime';
import Tooltip from '../../components/teacher/Tooltip';

const HELP = {
    average: 'Arithmetic mean of student scores across the finished cohort.',
    median: 'Middle score after ordering all results from lowest to highest.',
    stdDev: 'Spread of scores. Higher values mean the class performance was more dispersed.',
    passRate: 'Percentage of final results that met or exceeded the pass threshold.',
    completion: 'Percentage of eligible assigned students that ended up with a stored final result.',
    questionSuccess: 'Weighted success rate per question, with partial credit contributing partially.',
    scoreDistribution: 'Distribution of student scores across buckets to reveal clustering and spread.',
    hardestQuestion: 'Question with the lowest success rate in the current snapshot.',
    easiestQuestion: 'Question with the highest success rate in the current snapshot.',
    discrimination: 'How strongly a question separates stronger and weaker performers.',
    variance: 'Question with the widest spread of awarded scores.',
    weightedAccuracy: 'Student accuracy adjusted for partial credit.',
    consistency: 'How stable a student performed across the full paper.',
    performanceBand: 'Teacher-facing grouping derived from the overall percentage score.',
    partialRate: 'Percentage of answers that earned some credit without reaching full correctness.',
    difficulty: 'Difficulty label derived from the observed success rate.',
    avgScore: 'Average and median awarded score for the question.',
    commonWrong: 'Most common wrong answer or distractor observed for the item.',
    signals: 'Compact warning and interpretation flags such as mastery gap, volatility, and ambiguity.',
    correlations: 'Relationship between how two questions rise or fall together across students.',
};

const formatNumber = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

const InfoHint = ({ text }) => (
    <Tooltip text={text}>
        <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-black text-slate-500 transition hover:border-cyan-300 hover:text-cyan-700"
            aria-label="More information"
        >
            ?
        </button>
    </Tooltip>
);

const SectionHeading = ({ title, description, help, action }) => (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
            <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{title}</h2>
                {help ? <InfoHint text={help} /> : null}
            </div>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
    </div>
);

const MetricCard = ({ icon, label, value, sub, help, tone = 'slate' }) => {
    const tones = {
        slate: 'border-slate-200 bg-white text-slate-900',
        blue: 'border-sky-200 bg-sky-50 text-sky-950',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
        amber: 'border-amber-200 bg-amber-50 text-amber-950',
        rose: 'border-rose-200 bg-rose-50 text-rose-950',
    };

    return (
        <div className={`rounded-[22px] border p-4 shadow-sm ${tones[tone] || tones.slate}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-lg shadow-sm">
                    {icon}
                </div>
                {help ? <InfoHint text={help} /> : null}
            </div>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
            {sub ? <p className="mt-1 text-sm text-slate-600">{sub}</p> : null}
        </div>
    );
};

const PendingState = ({ readiness, message }) => (
    <div className="mx-auto mt-12 max-w-3xl rounded-[28px] border border-amber-200 bg-amber-50 p-8">
        <div className="flex items-start gap-3">
            <FiAlertCircle className="mt-1 text-2xl text-amber-700" />
            <div>
                <p className="text-lg font-bold text-amber-900">{message}</p>
                <p className="mt-2 text-sm text-amber-800">
                    Statistics are shown as soon as at least one student result exists; final snapshots are marked when the exam is complete.
                </p>
            </div>
        </div>
        {readiness ? (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
                <MetricCard label="Exam Ended" value={readiness.examEnded ? 'Yes' : 'No'} />
                <MetricCard label="Submitted" value={`${readiness.submittedStudents} / ${readiness.eligibleStudents}`} />
                <MetricCard label="Pending" value={readiness.pendingStudents?.length || 0} />
            </div>
        ) : null}
        <Link to="/teacher/published-exams" className="mt-6 inline-flex text-sm font-bold text-slate-700 hover:underline">
            Back to exams
        </Link>
    </div>
);

const Badge = ({ text, tone = 'slate' }) => {
    const tones = {
        slate: 'border-slate-200 bg-slate-100 text-slate-700',
        amber: 'border-amber-200 bg-amber-100 text-amber-800',
        rose: 'border-rose-200 bg-rose-100 text-rose-800',
        emerald: 'border-emerald-200 bg-emerald-100 text-emerald-800',
        blue: 'border-sky-200 bg-sky-100 text-sky-800',
    };

    return <span className={`status-badge ${tones[tone] || tones.slate}`}>{text}</span>;
};

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
            <p className="text-sm font-bold text-slate-900">{label}</p>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
                {payload.map((entry) => (
                    <p key={entry.dataKey} style={{ color: entry.color }}>
                        {entry.name}: {formatNumber(entry.value)}
                    </p>
                ))}
            </div>
        </div>
    );
};

const renderChoiceSummary = (items = []) => {
    if (!items.length) return 'No recorded selections';
    return items
        .slice(0, 3)
        .map((item) => `${item.choice} (${item.percentage}%)`)
        .join(' | ');
};

const normalizeBandLabel = (band) => String(band || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const ExamStatistics = () => {
    const { examId } = useParams();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(null);
    const [showAllStudents, setShowAllStudents] = useState(false);
    const [showAllQuestions, setShowAllQuestions] = useState(false);

    useEffect(() => {
        axiosInstance.get(`/teacher/statistics/${examId}`)
            .then((response) => {
                setStats(response.data);
                setPending(null);
            })
            .catch((responseError) => {
                if (responseError.response?.status === 409) {
                    setPending({
                        message: responseError.response?.data?.message || 'Statistics are not ready yet.',
                        readiness: responseError.response?.data?.readiness || null,
                    });
                    setError('');
                    return;
                }
                setError(responseError.response?.data?.message || 'Failed to load statistics.');
            })
            .finally(() => setLoading(false));
    }, [examId]);

    const questionLookup = useMemo(
        () => new Map((stats?.questions || []).map((question) => [question.question_id, question])),
        [stats]
    );

    const topStudents = useMemo(
        () => [...(stats?.students || [])].sort((a, b) => b.score - a.score).slice(0, 4),
        [stats]
    );

    if (loading) {
        return (
            <div className="flex h-72 flex-col items-center justify-center gap-4">
                <FiLoader className="animate-spin text-4xl text-indigo-600" />
                <p className="text-slate-500">Loading analytics...</p>
            </div>
        );
    }

    if (pending) {
        return <PendingState readiness={pending.readiness} message={pending.message} />;
    }

    if (error) {
        return (
            <div className="mx-auto mt-16 max-w-xl rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
                <p className="font-semibold text-red-600">{error}</p>
                <Link to="/teacher/published-exams" className="mt-4 inline-block text-sm font-bold text-indigo-600 hover:underline">
                    Back to exams
                </Link>
            </div>
        );
    }

    const global = stats?.global || {};
    const questions = stats?.questions || [];
    const students = stats?.students || [];
    const scoreDistribution = global.score_distribution || [];
    const hardestQuestion = questionLookup.get(global.insights?.hardest_question_id);
    const easiestQuestion = questionLookup.get(global.insights?.easiest_question_id);
    const discriminatingQuestion = questionLookup.get(global.insights?.most_discriminating_question_id);
    const varianceQuestion = questionLookup.get(global.insights?.highest_variance_question_id);
    const bandData = Object.entries(global.performance_bands || {}).map(([band, count]) => ({
        band: normalizeBandLabel(band),
        count,
    }));
    const visibleStudents = showAllStudents ? students : students.slice(0, 10);
    const visibleQuestions = showAllQuestions ? questions : questions.slice(0, 8);

    return (
        <div className="mx-auto max-w-6xl space-y-6 pb-16">
            <header className="page-hero overflow-hidden px-6 py-6 md:px-7 md:py-7">
                <Link to="/teacher/published-exams" className="text-sm font-semibold text-cyan-100 hover:text-white">
                    Back to exams
                </Link>
                <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                        <p className="eyebrow">Teacher Analytics</p>
                        <h1 className="page-title flex items-center gap-3 text-[2rem] md:text-[2.15rem]">
                            <FiBarChart2 /> {stats?.exam?.title}
                        </h1>
                        <p className="page-subtitle max-w-2xl">
                            Compact snapshot of cohort outcomes, question quality, and student-level patterns.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[340px]">
                        <div className="rounded-[24px] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Generated</p>
                            <p className="mt-2 text-sm font-semibold text-white">{formatAppDateTime(stats?.exam?.generated_at)}</p>
                        </div>
                        <div className="rounded-[24px] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Coverage</p>
                            <p className="mt-2 text-sm font-semibold text-white">{global.submitted_students} submitted / {global.eligible_students} eligible</p>
                        </div>
                    </div>
                </div>
            </header>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <MetricCard icon={<FiTrendingUp />} label="Average" value={global.average_grade || 0} sub={`${global.average_percentage || 0}% average`} help={HELP.average} tone="blue" />
                <MetricCard icon={<FiTarget />} label="Median" value={global.median_grade || 0} sub={`Q1 ${global.quartile_1 || 0} | Q3 ${global.quartile_3 || 0}`} help={HELP.median} tone="emerald" />
                <MetricCard icon={<FiLayers />} label="Std. Dev." value={global.standard_deviation || 0} sub={`IQR ${global.interquartile_range || 0}`} help={HELP.stdDev} tone="amber" />
                <MetricCard icon={<FiAward />} label="Highest" value={global.highest_grade || 0} sub={`Lowest ${global.lowest_grade || 0}`} tone="slate" />
                <MetricCard icon={<FiShield />} label="Pass Rate" value={`${global.pass_rate || 0}%`} sub={`Fail ${global.fail_rate || 0}%`} help={HELP.passRate} tone="emerald" />
                <MetricCard icon={<FiUsers />} label="Completion" value={`${global.completion_rate || 0}%`} sub={`Threshold ${global.pass_threshold || 0}`} help={HELP.completion} tone="rose" />
            </section>

            <section className="grid gap-4 xl:grid-cols-4">
                <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-rose-900">Hardest</p>
                        <InfoHint text={HELP.hardestQuestion} />
                    </div>
                    <p className="mt-2 text-sm text-rose-800">{hardestQuestion ? `Q${hardestQuestion.index} - ${hardestQuestion.text}` : 'N/A'}</p>
                </div>
                <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-emerald-900">Easiest</p>
                        <InfoHint text={HELP.easiestQuestion} />
                    </div>
                    <p className="mt-2 text-sm text-emerald-800">{easiestQuestion ? `Q${easiestQuestion.index} - ${easiestQuestion.text}` : 'N/A'}</p>
                </div>
                <div className="rounded-[22px] border border-sky-200 bg-sky-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-sky-900">Most discriminating</p>
                        <InfoHint text={HELP.discrimination} />
                    </div>
                    <p className="mt-2 text-sm text-sky-800">{discriminatingQuestion ? `Q${discriminatingQuestion.index} - ${discriminatingQuestion.text}` : 'N/A'}</p>
                </div>
                <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-amber-900">Highest variance</p>
                        <InfoHint text={HELP.variance} />
                    </div>
                    <p className="mt-2 text-sm text-amber-800">{varianceQuestion ? `Q${varianceQuestion.index} - ${varianceQuestion.text}` : 'N/A'}</p>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
                <div className="surface-card overflow-hidden">
                    <SectionHeading
                        title="Question success"
                        description="Full success and partial-credit rate per question."
                        help={HELP.questionSuccess}
                    />
                    <div className="p-5">
                        <div className="h-64 md:h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={questions.map((question) => ({ name: `Q${question.index}`, success: question.success_rate, partial: question.partial_rate }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="name" />
                                    <YAxis unit="%" />
                                    <RechartsTooltip content={<ChartTooltip />} />
                                    <Bar name="Success" dataKey="success" fill="#2563eb" radius={[8, 8, 0, 0]} />
                                    <Bar name="Partial" dataKey="partial" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="surface-card overflow-hidden">
                    <SectionHeading
                        title="Score distribution"
                        description="See clustering and spread across the cohort."
                        help={HELP.scoreDistribution}
                    />
                    <div className="p-5">
                        <div className="h-64 md:h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={scoreDistribution}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="range" />
                                    <YAxis allowDecimals={false} />
                                    <RechartsTooltip content={<ChartTooltip />} />
                                    <Bar name="Students" dataKey="count" radius={[8, 8, 0, 0]}>
                                        {scoreDistribution.map((entry, index) => (
                                            <Cell key={`${entry.range}-${index}`} fill={index % 2 === 0 ? '#06b6d4' : '#0ea5e9'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.12fr,0.88fr]">
                <div className="surface-card overflow-hidden">
                    <SectionHeading
                        title="Student performance"
                        description="Compact ranked view with partial-credit-aware metrics."
                        help={HELP.weightedAccuracy}
                        action={students.length > 10 ? (
                            <button
                                type="button"
                                onClick={() => setShowAllStudents((current) => !current)}
                                className="ghost-button !rounded-xl !px-4 !py-2"
                            >
                                {showAllStudents ? 'Show less' : `Show all ${students.length}`}
                            </button>
                        ) : null}
                    />
                    <div className="overflow-x-auto">
                        <table className="min-w-[920px] text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-5 py-3">Student</th>
                                    <th className="px-5 py-3">Rank</th>
                                    <th className="px-5 py-3">Score</th>
                                    <th className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            Accuracy
                                            <InfoHint text={HELP.weightedAccuracy} />
                                        </div>
                                    </th>
                                    <th className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            Consistency
                                            <InfoHint text={HELP.consistency} />
                                        </div>
                                    </th>
                                    <th className="px-5 py-3">Question Mix</th>
                                    <th className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            Band
                                            <InfoHint text={HELP.performanceBand} />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleStudents.map((student) => (
                                    <tr key={student.student_id} className="border-t border-slate-100 align-top">
                                        <td className="px-5 py-4">
                                            <p className="font-bold text-slate-800">{student.name}</p>
                                            <p className="mt-1 text-slate-500">{student.username}</p>
                                        </td>
                                        <td className="px-5 py-4 font-semibold text-slate-700">#{student.rank}</td>
                                        <td className="px-5 py-4 text-slate-600">{student.score} / {student.max_score}</td>
                                        <td className="px-5 py-4 text-slate-600">{student.weighted_accuracy}%</td>
                                        <td className="px-5 py-4 text-slate-600">{student.consistency_score}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <Badge text={`${student.correct_answers} correct`} tone="emerald" />
                                                <Badge text={`${student.partial_answers} partial`} tone="amber" />
                                                <Badge text={`${student.incorrect_answers} incorrect`} tone="rose" />
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <Badge text={normalizeBandLabel(student.performance_band)} tone="blue" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="surface-card overflow-hidden">
                    <SectionHeading
                        title="Top performers"
                        description="Fast read on the strongest results in this stored snapshot."
                    />
                    <div className="grid gap-3 p-5">
                        {topStudents.map((student, index) => (
                            <div key={student.student_id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-slate-900">#{index + 1} {student.name}</p>
                                        <p className="mt-1 text-sm text-slate-500">{student.username}</p>
                                    </div>
                                    <Badge text={`${student.score} / ${student.max_score}`} tone="emerald" />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge text={`Percentile ${student.percentile}%`} tone="blue" />
                                    <Badge text={`Accuracy ${student.weighted_accuracy}%`} tone="emerald" />
                                    <Badge text={`Consistency ${student.consistency_score}`} tone="amber" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="surface-card overflow-hidden">
                <SectionHeading
                    title="Question diagnostics"
                    description="Detailed question signals with difficulty, distractors, and spread."
                    help={HELP.signals}
                    action={questions.length > 8 ? (
                        <button
                            type="button"
                            onClick={() => setShowAllQuestions((current) => !current)}
                            className="ghost-button !rounded-xl !px-4 !py-2"
                        >
                            {showAllQuestions ? 'Show less' : `Show all ${questions.length}`}
                        </button>
                    ) : null}
                />
                <div className="overflow-x-auto">
                    <table className="min-w-[1060px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-5 py-3">Question</th>
                                <th className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        Success %
                                        <InfoHint text={HELP.questionSuccess} />
                                    </div>
                                </th>
                                <th className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        Partial %
                                        <InfoHint text={HELP.partialRate} />
                                    </div>
                                </th>
                                <th className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        Difficulty
                                        <InfoHint text={HELP.difficulty} />
                                    </div>
                                </th>
                                <th className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        Discrimination
                                        <InfoHint text={HELP.discrimination} />
                                    </div>
                                </th>
                                <th className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        Avg / Median
                                        <InfoHint text={HELP.avgScore} />
                                    </div>
                                </th>
                                <th className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        Common Wrong
                                        <InfoHint text={HELP.commonWrong} />
                                    </div>
                                </th>
                                <th className="px-5 py-3">Distractor Summary</th>
                                <th className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        Signals
                                        <InfoHint text={HELP.signals} />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleQuestions.map((question) => (
                                <tr key={question.question_id} className="border-t border-slate-100 align-top">
                                    <td className="px-5 py-4">
                                        <p className="font-bold text-slate-800">Q{question.index}</p>
                                        <p className="mt-1 max-w-md text-slate-500">{question.text}</p>
                                    </td>
                                    <td className="px-5 py-4 font-semibold text-slate-700">{question.success_rate}%</td>
                                    <td className="px-5 py-4 text-slate-600">{question.partial_rate}%</td>
                                    <td className="px-5 py-4">
                                        <Badge
                                            text={normalizeBandLabel(question.difficulty_label)}
                                            tone={question.success_rate >= 70 ? 'emerald' : question.success_rate >= 45 ? 'amber' : 'rose'}
                                        />
                                    </td>
                                    <td className="px-5 py-4 text-slate-600">{question.discrimination_index}</td>
                                    <td className="px-5 py-4 text-slate-600">{question.average_awarded_score} / {question.median_awarded_score}</td>
                                    <td className="px-5 py-4 text-slate-600">{question.most_common_wrong_answer || 'N/A'}</td>
                                    <td className="px-5 py-4">
                                        <p className="max-w-xs text-slate-600">{renderChoiceSummary(question.wrong_answer_distribution || question.distractor_analysis || [])}</p>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex max-w-xs flex-wrap gap-2">
                                            <Badge text={`Gap ${question.mastery_gap}%`} tone="rose" />
                                            <Badge text={`Volatility ${question.volatility_index}`} tone="amber" />
                                            {question.ambiguous_flag ? <Badge text="Ambiguous" tone="amber" /> : null}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
                <div className="surface-card overflow-hidden">
                    <SectionHeading
                        title="Question correlations"
                        description="Useful for spotting overlapping skills or duplicate-style items."
                        help={HELP.correlations}
                    />
                    <div className="grid gap-3 p-5">
                        {(stats?.correlations || []).slice(0, 4).map((entry) => (
                            <div key={entry.question_id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                                <p className="font-semibold text-slate-900">Q{questionLookup.get(entry.question_id)?.index || '?'}</p>
                                <p className="mt-1 text-sm text-slate-500">{questionLookup.get(entry.question_id)?.text || ''}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(entry.correlations || []).slice(0, 3).map((correlation) => (
                                        <Badge
                                            key={`${entry.question_id}-${correlation.with_question_id}`}
                                            text={`Q${questionLookup.get(correlation.with_question_id)?.index || '?'}: ${correlation.correlation}`}
                                            tone={Math.abs(correlation.correlation) >= 0.5 ? 'blue' : 'slate'}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="surface-card overflow-hidden">
                    <SectionHeading
                        title="Performance bands"
                        description="High-level cohort split by performance category."
                        help={HELP.performanceBand}
                    />
                    <div className="grid gap-4 p-5 sm:grid-cols-2">
                        {bandData.map((entry) => (
                            <div key={entry.band} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{entry.band}</p>
                                <p className="mt-2 text-2xl font-extrabold text-slate-900">{entry.count}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ExamStatistics;
