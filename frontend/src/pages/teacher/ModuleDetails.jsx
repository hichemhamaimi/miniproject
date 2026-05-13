import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import PublishExamModal from '../../components/teacher/PublishExamModal';
import ExamDetailsModal from '../../components/teacher/ExamDetailsModal';
import EditExamGroupsModal from '../../components/teacher/EditExamGroupsModal';
import { FiArrowLeft, FiArrowRight, FiBarChart2, FiEye, FiGlobe, FiUsers } from 'react-icons/fi';
import { formatAppDateTime } from '../../utils/dateTime';

const statusStyles = {
    LIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    ENDED: 'border-sky-200 bg-sky-50 text-sky-700',
    READY: 'border-blue-200 bg-blue-50 text-blue-700',
    CLOSED: 'border-rose-200 bg-rose-50 text-rose-700',
};

const getStatisticsReadinessMessage = (readiness) => {
    if (!readiness) return 'Statistics will be calculated after the exam closes.';
    if ((readiness.submittedStudents || 0) > 0) {
        return readiness.ready
            ? 'Statistics snapshot is ready.'
            : 'Partial statistics are available from submitted results.';
    }
    if (!readiness.examEnded) return 'Statistics unlock after the exam end time.';
    if (!readiness.allSubmitted) return `Waiting for ${readiness.pendingStudents?.length || 0} remaining student submission(s).`;
    return 'Statistics snapshot is ready.';
};

const ModuleDetails = () => {
    const { moduleId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('students');
    const [students, setStudents] = useState([]);
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [selectedExamToPublish, setSelectedExamToPublish] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedExamForDetails, setSelectedExamForDetails] = useState(null);
    const [isEditGroupsModalOpen, setIsEditGroupsModalOpen] = useState(false);
    const [selectedExamForEditGroups, setSelectedExamForEditGroups] = useState(null);

    const fetchModuleData = async () => {
        try {
            const [studentsRes, examsRes] = await Promise.all([
                axiosInstance.get(`/teacher/modules/${moduleId}/students`),
                axiosInstance.get(`/teacher/modules/${moduleId}/exams`),
            ]);

            setStudents(studentsRes.data);
            setExams(examsRes.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching module details:', err);
            setError(`Failed to load module data. ${err.response?.data?.message || ''}`);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchModuleData();
    }, [moduleId]);

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
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to download the results CSV.');
        }
    };

    const moduleGroups = [...new Map(students.map((s) => [s.group_id, { id: s.group_id, name: s.group_name }])).values()];

    const handleUnpublish = async (examId) => {
        if (!window.confirm('Are you sure you want to unpublish this exam? It will become unavailable to students immediately.')) {
            return;
        }
        try {
            await axiosInstance.post(`/teacher/exams/${examId}/unpublish`);
            fetchModuleData();
        } catch (err) {
            console.error('Error unpublishing exam:', err);
            alert(`Failed to unpublish exam. ${err.response?.data?.message || ''}`);
        }
    };

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div></div>;
    }

    if (error) {
        return (
            <div className="space-y-4">
                <Link to="/teacher/modules" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900">
                    <FiArrowLeft />
                    <span>Back to Modules</span>
                </Link>
                <div className="surface-card border-red-200 p-4 text-red-700">{error}</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="page-hero">
                <Link to="/teacher/modules" className="inline-flex items-center gap-2 text-sm font-bold text-white/80 transition hover:text-white">
                    <FiArrowLeft />
                    <span>Back to Modules</span>
                </Link>
                <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="eyebrow">Module Management</p>
                        <h1 className="page-title">Module Details</h1>
                        <p className="page-subtitle">Review enrolled students, inspect exam history, and launch the AI workflow for this module.</p>
                    </div>
                    <Link to={`/teacher/exam-workflow/${moduleId}`} className="secondary-button self-start lg:self-auto">
                        <FiArrowRight />
                        <span>AI Exam Workflow</span>
                    </Link>
                </div>
            </header>

            <div className="surface-card overflow-hidden">
                <div className="flex border-b border-slate-200 bg-slate-50/70">
                    <button
                        className={`flex-1 px-6 py-4 text-sm font-bold transition ${activeTab === 'students' ? 'border-b-2 border-slate-900 bg-white text-slate-900' : 'text-slate-500 hover:bg-white/60'}`}
                        onClick={() => setActiveTab('students')}
                    >
                        Enrolled Students ({students.length})
                    </button>
                    <button
                        className={`flex-1 px-6 py-4 text-sm font-bold transition ${activeTab === 'exams' ? 'border-b-2 border-slate-900 bg-white text-slate-900' : 'text-slate-500 hover:bg-white/60'}`}
                        onClick={() => setActiveTab('exams')}
                    >
                        Exam History ({exams.length})
                    </button>
                </div>

                {activeTab === 'students' && (
                    <div className="overflow-x-auto">
                        {students.length > 0 ? (
                            <table className="data-table">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        <th className="table-header-cell">Student Name</th>
                                        <th className="table-header-cell">Username</th>
                                        <th className="table-header-cell">Group</th>
                                        <th className="table-header-cell">Year</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {students.map((student) => (
                                        <tr key={student.id} className="table-row">
                                            <td className="table-cell">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold text-white">
                                                        {student.name.charAt(0)}{student.lastname.charAt(0)}
                                                    </div>
                                                    <div className="font-bold text-slate-900">{student.lastname} {student.name}</div>
                                                </div>
                                            </td>
                                            <td className="table-cell">{student.username}</td>
                                            <td className="table-cell">
                                                <span className="status-badge border-cyan-200 bg-cyan-50 text-cyan-700">{student.group_name}</span>
                                            </td>
                                            <td className="table-cell">{student.year} Year</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-10 text-center text-slate-500">No students found matching this module.</div>
                        )}
                    </div>
                )}

                {activeTab === 'exams' && (
                    <div className="overflow-x-auto">
                        {exams.length > 0 ? (
                            <table className="data-table">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        <th className="table-header-cell">Exam Title</th>
                                        <th className="table-header-cell">Created By</th>
                                        <th className="table-header-cell">Date Created</th>
                                        <th className="table-header-cell">Status</th>
                                        <th className="table-header-cell text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {exams.map((exam) => (
                                        <tr key={exam.id} className="table-row">
                                            <td className="table-cell">
                                                <div className="font-bold text-slate-900">{exam.title}</div>
                                                <div className="mt-1 space-y-1 text-xs font-medium text-slate-500">
                                                    <p>{exam.start_time ? `Opens: ${formatAppDateTime(exam.start_time)}` : 'Opens immediately'}</p>
                                                    <p>{exam.end_time ? `Closes: ${formatAppDateTime(exam.end_time)}` : 'No closing date configured'}</p>
                                                    {(exam.status === 'LIVE' || exam.status === 'ENDED' || exam.status === 'CLOSED') ? (
                                                        <p className={`${exam.statisticsReadiness?.ready ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                            {getStatisticsReadinessMessage(exam.statisticsReadiness)}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="table-cell">{exam.creator_lastname} {exam.creator_name}</td>
                                            <td className="table-cell">{new Date(exam.creation_date).toLocaleDateString()}</td>
                                            <td className="table-cell">
                                                <span className={`status-badge ${statusStyles[exam.status] || 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                                                    {exam.status || 'DRAFT'}
                                                </span>
                                            </td>
                                            <td className="table-cell">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    {exam.status !== 'LIVE' && exam.status !== 'CLOSED' && (
                                                        <button onClick={() => { setSelectedExamToPublish(exam); setIsPublishModalOpen(true); }} className="secondary-button !rounded-xl !px-4 !py-2">
                                                            <FiGlobe />
                                                            <span>Publish</span>
                                                        </button>
                                                    )}
                                                    {(exam.status === 'LIVE' || exam.status === 'ENDED' || exam.status === 'CLOSED') && (
                                                        <>
                                                            <button
                                                                onClick={() => navigate(`/teacher/exam-statistics/${exam.id}`)}
                                                                title={getStatisticsReadinessMessage(exam.statisticsReadiness)}
                                                                className="ghost-button !rounded-xl !px-4 !py-2"
                                                            >
                                                                <FiBarChart2 />
                                                                <span>Statistics</span>
                                                            </button>
                                                            <button
                                                                onClick={() => exam.statisticsReadiness?.ready && downloadExamCsv(exam.id)}
                                                                disabled={!exam.statisticsReadiness?.ready}
                                                                title={getStatisticsReadinessMessage(exam.statisticsReadiness)}
                                                                className="ghost-button !rounded-xl !px-4 !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                <span>Export CSV</span>
                                                            </button>
                                                            {exam.status === 'LIVE' ? (
                                                                <>
                                                                    <button onClick={() => { setSelectedExamForEditGroups(exam); setIsEditGroupsModalOpen(true); }} className="ghost-button !rounded-xl !px-4 !py-2">
                                                                        <FiUsers />
                                                                        <span>Edit Groups</span>
                                                                    </button>
                                                                    <button onClick={() => handleUnpublish(exam.id)} className="danger-button !rounded-xl !px-4 !py-2">
                                                                        <span>Unpublish</span>
                                                                    </button>
                                                                </>
                                                            ) : null}
                                                        </>
                                                    )}
                                                    <button onClick={() => { setSelectedExamForDetails(exam); setIsDetailsModalOpen(true); }} className="ghost-button !rounded-xl !px-4 !py-2">
                                                        <FiEye />
                                                        <span>Details</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-12 text-center text-slate-500">No exams have been created for this module yet.</div>
                        )}
                    </div>
                )}
            </div>

            <PublishExamModal
                isOpen={isPublishModalOpen}
                exam={selectedExamToPublish}
                availableGroups={moduleGroups}
                onClose={() => setIsPublishModalOpen(false)}
                onPublishSuccess={fetchModuleData}
            />

            <ExamDetailsModal
                isOpen={isDetailsModalOpen}
                examId={selectedExamForDetails?.id}
                onClose={() => setIsDetailsModalOpen(false)}
            />

            <EditExamGroupsModal
                isOpen={isEditGroupsModalOpen}
                exam={selectedExamForEditGroups}
                availableGroups={moduleGroups}
                onClose={() => setIsEditGroupsModalOpen(false)}
                onSuccess={fetchModuleData}
            />
        </div>
    );
};

export default ModuleDetails;
