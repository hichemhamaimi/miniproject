import React, { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { useNavigate } from 'react-router-dom';
import {
    FiBarChart2,
    FiBookOpen,
    FiChevronDown,
    FiChevronUp,
    FiClock,
    FiDownload,
    FiEdit2,
    FiEyeOff,
    FiFileText,
    FiFolder,
    FiGlobe,
    FiLayers,
    FiUsers,
} from 'react-icons/fi';
import { formatAppDateTime } from '../../utils/dateTime';

const getStatisticsReadinessMessage = (readiness) => {
    if (!readiness) return 'Statistics will be calculated after publication.';
    if ((readiness.submittedStudents || 0) > 0) {
        return readiness.ready
            ? 'Final statistics are ready.'
            : 'Partial statistics are available from submitted results.';
    }
    if (!readiness.examEnded) return 'Statistics unlock when the exam is ended.';
    if (!readiness.allSubmitted) {
        const pendingCount = readiness.pendingStudentCount ?? readiness.pendingStudents?.length ?? 0;
        return `Waiting for ${pendingCount} remaining student submission(s).`;
    }
    return 'Statistics are ready.';
};

const archiveStatusStyles = {
    ENDED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    CLOSED: 'border-slate-200 bg-slate-100 text-slate-700',
};

const cardAccents = [
    {
        icon: 'bg-cyan-600',
        ring: 'border-cyan-100 bg-cyan-50 text-cyan-700',
        stripe: 'from-cyan-500 to-blue-500',
    },
    {
        icon: 'bg-emerald-600',
        ring: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        stripe: 'from-emerald-500 to-teal-500',
    },
    {
        icon: 'bg-violet-600',
        ring: 'border-violet-100 bg-violet-50 text-violet-700',
        stripe: 'from-violet-500 to-indigo-500',
    },
    {
        icon: 'bg-amber-600',
        ring: 'border-amber-100 bg-amber-50 text-amber-700',
        stripe: 'from-amber-500 to-orange-500',
    },
];

const getCardAccent = (seed = 0) => cardAccents[Math.abs(Number(seed) || 0) % cardAccents.length];

const formatExamCode = (exam) => {
    const raw = exam?.publishedExam?.id || exam?.publishedExamId || exam?._id || exam?.id;
    return raw ? `Exam ${String(raw).slice(-6)}` : 'Exam';
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

const PublishedExams = () => {
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [archiveExams, setArchiveExams] = useState([]);
    const [archiveResults, setArchiveResults] = useState({});
    const [expandedArchiveExamId, setExpandedArchiveExamId] = useState(null);
    const [loadingArchiveResultsFor, setLoadingArchiveResultsFor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [loadError, setLoadError] = useState('');
    const [activeTab, setActiveTab] = useState('drafts');

    const fetchExams = useCallback(async () => {
        setLoadError('');
        try {
            const [generatedResponse, archiveResponse] = await Promise.all([
                axiosInstance.get('/teacher/ai-exams'),
                axiosInstance.get('/teacher/ai-exams/archive/history'),
            ]);
            setExams(generatedResponse.data);
            setArchiveExams(archiveResponse.data);
        } catch (error) {
            setLoadError(error.response?.data?.message || 'Failed to load teacher exams.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExams();
    }, [fetchExams]);

    const downloadExamCsv = async (examId) => {
        try {
            const response = await axiosInstance.get(`/teacher/exams/${examId}/export-results`, {
                responseType: 'blob',
            });

            let filename = `exam-${examId}-results.csv`;
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to download the results CSV.');
        }
    };

    const unpublish = async (examId) => {
        await axiosInstance.post(`/teacher/ai-exams/${examId}/unpublish`);
        setMessage('Exam unpublished.');
        fetchExams();
    };

    const loadArchiveResults = async (examId) => {
        if (archiveResults[examId]) {
            return;
        }

        setLoadingArchiveResultsFor(examId);
        try {
            const response = await axiosInstance.get(`/teacher/exams/${examId}/results`);
            setArchiveResults((current) => ({
                ...current,
                [examId]: response.data,
            }));
        } finally {
            setLoadingArchiveResultsFor(null);
        }
    };

    const toggleArchiveExam = async (examId) => {
        if (expandedArchiveExamId === examId) {
            setExpandedArchiveExamId(null);
            return;
        }

        await loadArchiveResults(examId);
        setExpandedArchiveExamId(examId);
    };

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" /></div>;
    }

    const drafts = exams.filter((exam) => exam.status === 'draft');
    const published = exams.filter((exam) => exam.status === 'published' && exam.publishedExam?.status === 'LIVE');

    const TabButton = ({ id, label, count }) => (
        <button
            type="button"
            onClick={() => setActiveTab(id)}
            className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                activeTab === id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
        >
            {label} ({count})
        </button>
    );

    const GeneratedCard = ({ exam }) => {
        const readiness = exam.statisticsReadiness;
        const statsAvailable = Boolean(readiness?.ready || (readiness?.submittedStudents || 0) > 0 || (exam.publishedExam?.result_count || 0) > 0);
        const readinessMessage = getStatisticsReadinessMessage(readiness);
        const accent = getCardAccent(exam.moduleId || exam.publishedExam?.id || exam._id?.length);
        const moduleLabel = exam.module
            ? `${exam.module.name}${exam.module.abbreviation ? ` (${exam.module.abbreviation})` : ''}`
            : 'Module not linked';
        const questionCount = exam.questionCount ?? exam.questions?.length ?? 0;
        const isPublished = Boolean(exam.publishedExam);
        const statusLabel = isPublished ? exam.publishedExam.status : 'DRAFT';

        return (
            <div className="surface-muted relative overflow-hidden p-5">
                <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${accent.stripe}`} />
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white ${accent.icon}`}>
                        <FiBookOpen />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`status-badge ${accent.ring}`}>{formatExamCode(exam)}</span>
                            <span className={`status-badge ${isPublished ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{statusLabel}</span>
                            {exam.publishedExam?.require_seb ? (
                                <span className="status-badge border-slate-200 bg-white text-slate-600">SEB</span>
                            ) : null}
                        </div>
                        <p className="mt-3 text-lg font-extrabold text-slate-900">{exam.title}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1.5 font-semibold"><FiLayers /> {moduleLabel}</span>
                            <span className="inline-flex items-center gap-1.5"><FiFileText /> {questionCount} question(s)</span>
                            <span className="inline-flex items-center gap-1.5"><FiClock /> Created {formatAppDateTime(exam.createdAt)}</span>
                        </div>
                        {exam.publishedExam ? (
                            <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Window</p>
                                    <p className="mt-1 font-semibold">{exam.publishedExam.start_time ? formatAppDateTime(exam.publishedExam.start_time) : 'Opens immediately'}</p>
                                    <p className="text-slate-500">{exam.publishedExam.end_time ? formatAppDateTime(exam.publishedExam.end_time) : 'No closing date'}</p>
                                </div>
                                <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Duration</p>
                                    <p className="mt-1 flex items-center gap-1.5 font-semibold"><FiClock /> {exam.publishedExam.duration_minutes || '-'} min</p>
                                </div>
                                <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Assigned</p>
                                    <p className="mt-1 flex items-center gap-1.5 font-semibold"><FiUsers /> {exam.publishedExam.assigned_students || 0} student(s)</p>
                                    <p className="text-slate-500">{exam.publishedExam.group_count || 0} group(s)</p>
                                </div>
                                <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Results</p>
                                    <p className="mt-1 font-semibold">{exam.publishedExam.result_count || 0} submitted</p>
                                    <p className={statsAvailable ? 'text-emerald-600' : 'text-amber-600'}>{readinessMessage}</p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    <button onClick={() => navigate(`/teacher/ai-exam-review/${exam._id}`)} className="ghost-button !rounded-xl !px-4 !py-2">
                        <FiEdit2 />
                        <span>Edit</span>
                    </button>
                    {exam.publishedExam ? (
                        <>
                            <button
                                onClick={() => navigate(`/teacher/exam-statistics/${exam.publishedExam.id}`)}
                                title={readinessMessage}
                                className="ghost-button !rounded-xl !px-4 !py-2"
                            >
                                <FiBarChart2 />
                                <span>Stats</span>
                            </button>
                            <button
                                onClick={() => statsAvailable && downloadExamCsv(exam.publishedExam.id)}
                                disabled={!statsAvailable}
                                title={readinessMessage}
                                className="ghost-button !rounded-xl !px-4 !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FiDownload />
                                <span>CSV</span>
                            </button>
                        </>
                    ) : null}
                    {exam.status === 'published' ? (
                        <button onClick={() => unpublish(exam._id)} className="danger-button !rounded-xl !px-4 !py-2">
                            <FiEyeOff />
                            <span>Unpublish</span>
                        </button>
                    ) : null}
                </div>
            </div>
            </div>
        );
    };

    const ArchiveCard = ({ exam }) => {
        const readiness = exam.statisticsReadiness;
        const resultsBundle = archiveResults[exam.id];
        const isExpanded = expandedArchiveExamId === exam.id;
        const isLoadingResults = loadingArchiveResultsFor === exam.id;
        const readinessMessage = getStatisticsReadinessMessage(readiness);
        const accent = getCardAccent(exam.module_id || exam.id);

        return (
            <div className="surface-muted relative overflow-hidden">
                <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${accent.stripe}`} />
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white ${accent.icon}`}>
                            <FiFolder />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`status-badge ${accent.ring}`}>Exam {String(exam.id).slice(-6)}</span>
                                <span className={`status-badge ${archiveStatusStyles[exam.status] || 'border-slate-200 bg-slate-100 text-slate-700'}`}>{exam.status}</span>
                                {exam.require_seb ? <span className="status-badge border-slate-200 bg-white text-slate-600">SEB</span> : null}
                            </div>
                            <p className="mt-3 text-lg font-extrabold text-slate-900">{exam.title}</p>
                            <p className="mt-1 text-sm text-slate-500">
                                {exam.module_name} ({exam.module_abbreviation}) | Created by {exam.creator_lastname} {exam.creator_name}
                            </p>
                            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Opened</p>
                                    <p className="mt-1 font-semibold">{exam.start_time ? formatAppDateTime(exam.start_time) : 'Immediately'}</p>
                                </div>
                                <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Closed</p>
                                    <p className="mt-1 font-semibold">{exam.end_time ? formatAppDateTime(exam.end_time) : 'No closing date'}</p>
                                </div>
                                <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Duration</p>
                                    <p className="mt-1 flex items-center gap-1.5 font-semibold"><FiClock /> {exam.duration_minutes || '-'} min</p>
                                </div>
                                <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Results</p>
                                    <p className="mt-1 font-semibold">{exam.result_count} result(s)</p>
                                    <p className={readiness?.ready ? 'text-emerald-600' : 'text-amber-600'}>{readinessMessage}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => navigate(`/teacher/exam-statistics/${exam.id}`)}
                            title={readinessMessage}
                            className="ghost-button !rounded-xl !px-4 !py-2"
                        >
                            <FiBarChart2 />
                            <span>Stats</span>
                        </button>
                        <button
                            onClick={() => readiness?.ready && downloadExamCsv(exam.id)}
                            disabled={!readiness?.ready}
                            title={readinessMessage}
                            className="ghost-button !rounded-xl !px-4 !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FiDownload />
                            <span>CSV</span>
                        </button>
                        <button onClick={() => toggleArchiveExam(exam.id)} className="ghost-button !rounded-xl !px-4 !py-2">
                            <FiUsers />
                            <span>{isExpanded ? 'Hide Corrections' : 'Show Corrections'}</span>
                            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                        </button>
                    </div>
                </div>

                {isExpanded ? (
                    <div className="border-t border-slate-200 bg-white/80 p-5">
                        {isLoadingResults ? (
                            <div className="flex justify-center py-6"><div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" /></div>
                        ) : (
                            <div className="space-y-3">
                                {(resultsBundle?.results || []).map((result) => (
                                    <div key={result.result_id} className="flex flex-col gap-4 rounded-[22px] border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="font-bold text-slate-900">{result.student_name}</p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {result.username} | {result.group_name ? `${result.group_name}${result.group_year ? ` (${result.group_year})` : ''}` : 'No group'}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                Submitted {formatAppDateTime(result.submitted_at)} | {result.score} / {result.max_score} | {result.percentage_score}% | {result.pass_status}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {result.correction_document_url ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openHtmlDocument(result.correction_document_url, `exam-result-${result.result_id}.html`)}
                                                    className="ghost-button !rounded-xl !px-4 !py-2"
                                                >
                                                    <FiFileText />
                                                    <span>Correction</span>
                                                </button>
                                            ) : (
                                                <span className="status-badge border-slate-200 bg-slate-100 text-slate-500">No correction file</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {(!resultsBundle?.results || resultsBundle.results.length === 0) ? (
                                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                        No archived student results are available yet for this exam.
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        );
    };

    const renderTabContent = () => {
        if (activeTab === 'drafts') {
            return (
                <section className="surface-card p-8">
                    <h2 className="flex items-center gap-3 text-lg font-extrabold text-slate-900"><FiGlobe /> Drafts</h2>
                    <div className="mt-5 space-y-3">
                        {drafts.map((exam) => <GeneratedCard key={exam._id} exam={exam} />)}
                        {drafts.length === 0 ? <div className="surface-muted p-4 text-sm text-slate-500">No draft exams available.</div> : null}
                    </div>
                </section>
            );
        }

        if (activeTab === 'published') {
            return (
                <section className="surface-card p-8">
                    <h2 className="flex items-center gap-3 text-lg font-extrabold text-slate-900"><FiLayers /> Active Published Exams</h2>
                    <div className="mt-5 space-y-3">
                        {published.map((exam) => <GeneratedCard key={exam._id} exam={exam} />)}
                        {published.length === 0 ? <div className="surface-muted p-4 text-sm text-slate-500">No active published exams available.</div> : null}
                    </div>
                </section>
            );
        }

        return (
            <section className="surface-card p-8">
                <h2 className="flex items-center gap-3 text-lg font-extrabold text-slate-900"><FiFolder /> Archived Module Exams</h2>
                <p className="mt-2 text-sm text-slate-500">
                    Historical exams stay visible here by module ownership, so a new module teacher can still inspect earlier deliveries, results, and correction documents.
                </p>
                <div className="mt-5 space-y-3">
                    {archiveExams.map((exam) => <ArchiveCard key={exam.id} exam={exam} />)}
                    {archiveExams.length === 0 ? <div className="surface-muted p-4 text-sm text-slate-500">No archived exams available for your modules.</div> : null}
                </div>
            </section>
        );
    };

    return (
        <div className="space-y-8 pb-16">
            <header className="page-hero">
                <p className="eyebrow">Generated Exams</p>
                <h1 className="page-title">Draft, publish, and archive exams from one control space</h1>
                <p className="page-subtitle">{published.length} active published, {drafts.length} draft, and {archiveExams.length} archived exam(s)</p>
            </header>

            {message ? <div className="surface-card border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div> : null}
            {loadError ? <div className="surface-card border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{loadError}</div> : null}

            <div className="flex flex-wrap gap-3">
                <TabButton id="drafts" label="Drafts" count={drafts.length} />
                <TabButton id="published" label="Published" count={published.length} />
                <TabButton id="archive" label="Archive" count={archiveExams.length} />
            </div>

            {renderTabContent()}
        </div>
    );
};

export default PublishedExams;
