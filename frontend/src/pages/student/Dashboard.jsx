import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { formatAppDateTime, parseAppDateTime } from '../../utils/dateTime';
import { FiAward, FiCheckCircle, FiClock, FiDownload, FiPlayCircle } from 'react-icons/fi';

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAvailableExams = async () => {
            try {
                const response = await axiosInstance.get('/student/exams');
                setExams(response.data);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching exams', err);
                setError('Failed to load available exams.');
                setLoading(false);
            }
        };

        if (user?.role === 'student') {
            fetchAvailableExams();
        }
    }, [user]);

    if (user?.role !== 'student') {
        return <div className="surface-card p-8 text-center font-semibold text-red-500">Access denied.</div>;
    }

    const handleEnterExam = (exam) => {
        if (exam.require_seb) {
            handleDownloadSeb(exam);
            return;
        }
        navigate(`/student/exams/${exam.id}`);
    };

    const handleDownloadSeb = async (exam) => {
        try {
            const response = await axiosInstance.get(`/student/exams/${exam.id}/seb`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            let filename = `${exam.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.seb`;
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch.length === 2) {
                    filename = filenameMatch[1];
                }
            }

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error downloading SEB file', err);
            alert('Failed to download SEB file.');
        }
    };

    return (
        <div className="space-y-8">
            <header className="page-hero">
                <p className="eyebrow">Student Workspace</p>
                <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="page-title">A cleaner, more focused place to take your assigned exams</h1>
                        <p className="page-subtitle">
                            Your dashboard now emphasizes clarity, timing, and the next action, keeping attention on exam readiness instead of interface clutter.
                        </p>
                    </div>
                    <Link to="/student/results" className="secondary-button self-start lg:self-auto">
                        <FiAward />
                        <span>My Results</span>
                    </Link>
                </div>
            </header>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
                </div>
            ) : error ? (
                <div className="surface-card border-red-200 p-4 text-red-600">{error}</div>
            ) : exams.length === 0 ? (
                <div className="empty-state">
                    <p className="text-lg font-bold text-slate-700">No exams currently available</p>
                    <p className="mt-2 text-sm text-slate-500">When a teacher publishes an exam for your groups, it will appear here.</p>
                </div>
            ) : (
                <div className="grid gap-5 xl:grid-cols-2">
                    {exams.map((exam) => {
                        const isSubmitted = exam.attempt_status === 'SUBMITTED' || exam.attempt_status === 'EXPIRED';
                        const isOngoing = exam.attempt_status === 'ONGOING';

                        const now = new Date();
                        const startAt = parseAppDateTime(exam.start_time);
                        const endAt = parseAppDateTime(exam.end_time);
                        const hasStarted = !startAt || startAt <= now;
                        const hasEnded = endAt && endAt < now;

                        const statusLabel = isSubmitted
                            ? 'Completed'
                            : !hasStarted
                                ? 'Scheduled'
                                : hasEnded
                                    ? 'Closed'
                                    : isOngoing
                                        ? 'In progress'
                                        : 'Available';

                        return (
                            <div
                                key={exam.id}
                                className={`surface-card p-6 transition duration-200 ${
                                    isSubmitted ? 'opacity-80' : 'hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(15,23,42,0.12)]'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <span className="status-badge border-cyan-200 bg-cyan-50 text-cyan-700">
                                            {exam.module_name} ({exam.module_abbreviation})
                                        </span>
                                        <h3 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900">{exam.title}</h3>
                                        <p className="mt-2 text-sm font-semibold text-slate-500">{statusLabel}</p>
                                        <div className="mt-3 space-y-1 text-sm text-slate-500">
                                            <p>{startAt ? `Opens at ${formatAppDateTime(startAt)}` : 'Opens immediately'}</p>
                                            <p>{endAt ? `Closes at ${formatAppDateTime(endAt)}` : 'No closing date configured'}</p>
                                        </div>
                                    </div>
                                    {isSubmitted ? (
                                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                                            <FiCheckCircle className="text-xl" />
                                        </span>
                                    ) : null}
                                </div>

                                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                    <div className="surface-muted flex items-center gap-3 px-4 py-3">
                                        <FiClock className="text-cyan-600" />
                                        <span className="text-sm font-semibold text-slate-700">{exam.duration_minutes} minutes</span>
                                    </div>
                                    <div className="surface-muted px-4 py-3 text-sm font-semibold text-slate-700">
                                        {startAt ? `Starts ${formatAppDateTime(startAt)}` : 'Available immediately'}
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                                    {!isSubmitted && hasStarted && !hasEnded ? (
                                        <>
                                            {exam.require_seb ? (
                                                <div className="w-full space-y-3">
                                                    <button
                                                        onClick={() => handleDownloadSeb(exam)}
                                                        className="action-button w-full"
                                                        title="Download SEB Configuration"
                                                    >
                                                        <FiDownload />
                                                        <span>Download SEB File</span>
                                                    </button>
                                                    <div className="surface-muted w-full px-4 py-3 text-center text-sm font-semibold text-slate-600">
                                                        Download the file in your normal browser, open it with Safe Exam Browser, then click Start inside SEB.
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {isOngoing ? (
                                                        <button
                                                            onClick={() => navigate(`/student/exams/${exam.id}`)}
                                                            className="secondary-button flex-1"
                                                        >
                                                            <FiPlayCircle />
                                                            <span>Resume Exam</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleEnterExam(exam)}
                                                            className="action-button flex-1"
                                                        >
                                                            <FiPlayCircle />
                                                            <span>Start Exam</span>
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <div className="surface-muted w-full px-4 py-3 text-center text-sm font-semibold text-slate-600">
                                            {isSubmitted
                                                ? 'Already submitted'
                                                : !hasStarted
                                                    ? `Upcoming exam. Opens at ${formatAppDateTime(startAt)}`
                                                    : `Exam closed at ${formatAppDateTime(endAt)}`}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
