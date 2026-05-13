import React, { useEffect, useState } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import {
    FiActivity,
    FiAward,
    FiBookOpen,
    FiCalendar,
    FiCheckCircle,
    FiChevronDown,
    FiChevronUp,
    FiDownload,
    FiInbox,
    FiLoader,
    FiUser,
    FiUsers,
    FiXCircle,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { formatAppDateTime } from '../../utils/dateTime';

const statusStyles = {
    correct: {
        card: 'border-emerald-200 bg-emerald-50',
        badge: 'border-emerald-200 bg-emerald-100 text-emerald-700',
        icon: <FiCheckCircle className="mt-0.5 text-emerald-600" />,
        label: 'Correct',
    },
    partial: {
        card: 'border-amber-200 bg-amber-50',
        badge: 'border-amber-200 bg-amber-100 text-amber-700',
        icon: <FiActivity className="mt-0.5 text-amber-600" />,
        label: 'Partial',
    },
    incorrect: {
        card: 'border-rose-200 bg-rose-50',
        badge: 'border-rose-200 bg-rose-100 text-rose-700',
        icon: <FiXCircle className="mt-0.5 text-rose-600" />,
        label: 'Incorrect',
    },
};

const ScoreBadge = ({ score, maxScore }) => (
    <div className="status-badge border-emerald-200 bg-emerald-50 text-emerald-700">
        <FiAward />
        {Number(score).toFixed(2)} / {Number(maxScore || 0).toFixed(2)}
    </div>
);

const formatPrintableName = (title = 'correction') => {
    const safeTitle = String(title)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `${safeTitle || 'correction'}-corrected-paper.html`;
};

const renderAnswer = (value) => {
    if (value === null || value === undefined || value === '') return 'Not answered';
    if (Array.isArray(value)) {
        if (value.length === 0) return 'Not answered';
        if (value.every((item) => item && typeof item === 'object' && ('left' in item || 'right' in item))) {
            return value.map((item) => `${item.left || 'Blank'} -> ${item.right || 'Blank'}`).join('; ');
        }
        return value.map((item, index) => `${index + 1}. ${renderAnswer(item)}`).join('  ');
    }
    if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}: ${renderAnswer(item)}`).join('; ');
    return String(value);
};

const openHtmlDocument = async (url, fallbackName = 'correction.html') => {
    const response = await axiosInstance.get(url, { responseType: 'blob' });
    const objectUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'text/html;charset=utf-8' }));
    const popup = window.open(objectUrl, '_blank', 'noopener,noreferrer');

    if (!popup) {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.download = fallbackName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    window.setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
    }, 60_000);
};

const DetailPill = ({ icon, label, value, sub }) => (
    <div className="rounded-[20px] border border-white/80 bg-white/85 p-4 shadow-sm">
        <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                {icon}
            </span>
            <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
                <p className="mt-1 break-words text-base font-extrabold text-slate-900">{value}</p>
                {sub ? <p className="mt-1 text-sm text-slate-500">{sub}</p> : null}
            </div>
        </div>
    </div>
);

const CorrectionOverview = ({ correctionDocument, detail, onOpenPrintable }) => {
    if (!correctionDocument && !detail) return null;

    const correctionStudent = correctionDocument?.student || {};
    const detailStudent = detail?.student || {};
    const correctionExam = correctionDocument?.exam || {};
    const detailExam = detail?.exam || {};
    const correctionModule = correctionDocument?.moduleInfo || {};
    const detailModule = detail?.moduleInfo || {};
    const student = {
        ...detailStudent,
        ...correctionStudent,
        fullName: correctionStudent.fullName || detailStudent.fullName,
        username: correctionStudent.username || detailStudent.username,
        dateOfBirth: correctionStudent.dateOfBirth || detailStudent.dateOfBirth,
        groupLabel: correctionStudent.groupLabel || detailStudent.groupLabel,
    };
    const exam = {
        ...detailExam,
        ...correctionExam,
        title: correctionExam.title || detailExam.title,
        durationMinutes: correctionExam.durationMinutes || detailExam.durationMinutes,
    };
    const moduleInfo = {
        ...detailModule,
        ...correctionModule,
        label: correctionModule.label || detailModule.label,
    };
    const result = correctionDocument?.result || {
        score: detail?.score,
        maxScore: detail?.max_score,
        passStatus: detail?.pass_status,
        submittedAt: detail?.submitted_at,
    };
    const scoreValue = `${Number(result.score || 0).toFixed(2)} / ${Number(result.maxScore || 0).toFixed(2)}`;

    return (
        <div className="space-y-4 border-t border-slate-200 px-6 pb-6 pt-5">
            <div className="rounded-[28px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-600">Corrected Paper</p>
                        <h3 className="mt-2 text-2xl font-black text-slate-900">{exam.title || 'Exam correction'}</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">A clean summary of your submitted paper, final mark, module, and question-by-question correction.</p>
                    </div>
                    {detail?.correction_document_view_url ? (
                        <button
                            type="button"
                            onClick={onOpenPrintable}
                            className="ghost-button !rounded-xl !px-4 !py-2"
                        >
                            <FiDownload />
                            <span>Printable view</span>
                        </button>
                    ) : null}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <DetailPill icon={<FiUser />} label="Student" value={student.fullName || 'Unknown student'} sub={student.username || 'No username'} />
                    <DetailPill icon={<FiUsers />} label="Group" value={student.groupLabel || 'N/A'} sub={student.dateOfBirth ? `Born ${student.dateOfBirth}` : 'No date of birth'} />
                    <DetailPill icon={<FiBookOpen />} label="Module" value={moduleInfo.label || 'N/A'} sub={exam.durationMinutes ? `${exam.durationMinutes} minute exam` : 'Module details'} />
                    <DetailPill icon={<FiAward />} label="Final grade" value={scoreValue} sub={result.passStatus || 'No status'} />
                </div>

                <div className="mt-3 rounded-[20px] border border-white/80 bg-white/75 px-4 py-3 text-sm font-semibold text-slate-600">
                    Submitted on {result.submittedAt ? formatAppDateTime(result.submittedAt) : 'N/A'}
                </div>
            </div>
        </div>
    );
};

const AnswerDetail = ({ examData, answers, correctionDocument }) => {
    const correctionQuestions = correctionDocument?.questions || [];
    const fallbackQuestions = examData?.questions || [];

    const rows = correctionQuestions.length > 0
        ? correctionQuestions.map((question, index) => ({
            id: question.questionId || question.question_id || `${index}`,
            text: question.text,
            explanation: question.explanation,
            status: question.status || question.grading_status,
            studentAnswer: question.student_answer,
            correctAnswer: question.correct_answer,
            awardedScore: question.awarded_score,
            maxScore: question.max_score,
            index: question.index || index + 1,
        }))
        : fallbackQuestions.map((question, index) => {
            const answer = answers.find((item) => item.question_id === question.id);
            return {
                id: question.id,
                text: question.text,
                explanation: question.explanation,
                status: answer?.grading_status,
                studentAnswer: answer?.student_answer,
                correctAnswer: answer?.correct_answer,
                awardedScore: answer?.awarded_score ?? 0,
                maxScore: answer?.max_score ?? 0,
                index: index + 1,
            };
        });

    return (
        <div className="space-y-3 border-t border-slate-200 px-6 pb-6 pt-4">
            {rows.map((row) => {
                const status = statusStyles[row.status] || statusStyles.incorrect;

                return (
                    <div key={row.id} className={`rounded-[24px] border p-5 text-sm shadow-sm ${status.card}`}>
                        <div className="flex items-start gap-3">
                            {status.icon}
                            <div className="w-full space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-base font-extrabold text-slate-900">Question {row.index}</p>
                                    <span className={`status-badge ${status.badge}`}>{status.label}</span>
                                </div>
                                <p className="rounded-2xl border border-white/70 bg-white/70 p-3 font-semibold leading-6 text-slate-800">{row.text}</p>
                                <div className="grid gap-3 lg:grid-cols-2">
                                    <div className="rounded-2xl border border-white/80 bg-white/75 p-3">
                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Your answer</p>
                                        <p className="mt-2 leading-6 text-slate-700">{renderAnswer(row.studentAnswer)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/80 bg-white/75 p-3">
                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Correct answer</p>
                                        <p className="mt-2 leading-6 text-slate-700">{renderAnswer(row.correctAnswer)}</p>
                                    </div>
                                </div>
                                <div className="inline-flex rounded-2xl border border-white/80 bg-white/80 px-4 py-2 font-bold text-slate-800">
                                    Score: {Number(row.awardedScore ?? 0).toFixed(2)} / {Number(row.maxScore ?? 0).toFixed(2)}
                                </div>
                                {row.explanation ? (
                                    <p className="rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-slate-600">
                                        <span className="font-semibold text-cyan-700">Explanation:</span> {row.explanation}
                                    </p>
                                ) : null}
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
    const [loading, setLoading] = useState(false);

    const toggle = async () => {
        if (!open && !detail) {
            setLoading(true);
            try {
                const response = await axiosInstance.get(`/student/results/${result.result_id}`);
                setDetail(response.data);
            } finally {
                setLoading(false);
            }
        }
        setOpen((current) => !current);
    };

    const openPrintable = async (event) => {
        if (event) {
            event.stopPropagation();
        }
        if (!result.correction_document_url && !detail?.correction_document_view_url) {
            return;
        }
        const targetUrl = detail?.correction_document_view_url || result.correction_document_url;
        await openHtmlDocument(targetUrl, formatPrintableName(result.exam_title));
    };

    return (
        <div className="surface-card overflow-hidden">
            <div className="flex cursor-pointer flex-col gap-4 bg-white/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70" onClick={toggle}>
                <div>
                    <p className="text-lg font-extrabold text-slate-900">{result.exam_title}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        <FiCalendar />
                        <span>{formatAppDateTime(result.submitted_at)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {result.module_name ? (
                            <span className="status-badge border-slate-200 bg-slate-50 text-slate-600">
                                <FiBookOpen />
                                {result.module_name}
                            </span>
                        ) : null}
                        <span className="status-badge border-cyan-200 bg-cyan-50 text-cyan-700">
                            {result.pass_status} / {result.percentage_score}%
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {result.correction_document_url ? (
                        <button
                            type="button"
                            onClick={openPrintable}
                            className="ghost-button !rounded-xl !px-4 !py-2"
                        >
                            <FiDownload />
                            <span>Printable</span>
                        </button>
                    ) : null}
                    <ScoreBadge score={result.score} maxScore={result.max_score} />
                    {open ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
                </div>
            </div>
            {open ? (
                loading ? (
                    <div className="flex justify-center py-8"><FiLoader className="animate-spin text-2xl text-cyan-600" /></div>
                ) : (
                    <div className="space-y-0">
                        <CorrectionOverview correctionDocument={detail?.correction_document} detail={detail} onOpenPrintable={openPrintable} />
                        <AnswerDetail
                            examData={detail?.examData}
                            answers={detail?.answers || []}
                            correctionDocument={detail?.correction_document}
                        />
                    </div>
                )
            ) : null}
        </div>
    );
};

const StudentResults = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axiosInstance.get('/student/results')
            .then((response) => setResults(response.data))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-8 pb-20">
            <header className="page-hero">
                <p className="eyebrow">Student Results</p>
                <h1 className="page-title">Review corrected exams with detailed answer-by-answer feedback</h1>
                <p className="page-subtitle">Your result view shows only your submitted exams, marks, answers, and corrected copies.</p>
            </header>

            {loading ? (
                <div className="flex h-52 flex-col items-center justify-center gap-4">
                    <FiLoader className="animate-spin text-4xl text-cyan-600" />
                    <p className="font-medium text-slate-400">Loading your results...</p>
                </div>
            ) : results.length === 0 ? (
                <div className="empty-state">
                    <FiInbox className="mx-auto mb-4 text-5xl text-slate-300" />
                    <p className="text-lg font-semibold text-slate-500">No results yet</p>
                    <p className="mt-1 text-sm text-slate-400">Complete an exam to see your corrected copy here.</p>
                    <Link to="/student/dashboard" className="secondary-button mt-5">
                        Browse Exams
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {results.map((result) => <ResultCard key={result.result_id} result={result} />)}
                </div>
            )}
        </div>
    );
};

export default StudentResults;
