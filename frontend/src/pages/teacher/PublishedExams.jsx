import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { useNavigate } from 'react-router-dom';
import { FiBookOpen, FiEdit2, FiGlobe, FiEyeOff, FiBarChart2 } from 'react-icons/fi';

const STATUS_BADGE = {
    draft: 'bg-amber-100 text-amber-700 border border-amber-200',
    published: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

const PublishedExams = () => {
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState(null);

    const fetchExams = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/teacher/ai-exams');
            setExams(res.data);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchExams(); }, [fetchExams]);

    const handleUnpublish = async (id) => {
        if (!window.confirm('Unpublish this exam? It will return to draft.')) return;
        try {
            await axiosInstance.post(`/teacher/ai-exams/${id}/unpublish`);
            setActionMsg({ type: 'success', text: 'Exam unpublished.' });
            fetchExams();
        } catch {
            setActionMsg({ type: 'error', text: 'Failed to unpublish.' });
        }
    };

    const handlePublish = async (id) => {
        try {
            await axiosInstance.post(`/teacher/ai-exams/${id}/publish`);
            setActionMsg({ type: 'success', text: 'Exam published!' });
            fetchExams();
        } catch (err) {
            setActionMsg({ type: 'error', text: err.response?.data?.message || 'Publish failed.' });
        }
    };

    const published = exams.filter(e => e.status === 'published');
    const drafts = exams.filter(e => e.status === 'draft');

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full"></div>
        </div>
    );

    const ExamCard = ({ exam }) => (
        <div className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:border-violet-200 hover:bg-violet-50 transition-all group">
            <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0">
                    <FiBookOpen />
                </div>
                <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{exam.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[exam.status]}`}>{exam.status}</span>
                        <span className="text-xs text-slate-400">{new Date(exam.createdAt).toLocaleDateString()}</span>
                        {exam.publishedAt && (
                            <span className="text-xs text-emerald-600 font-medium">
                                Published {new Date(exam.publishedAt).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                    onClick={() => navigate(`/teacher/ai-exam-review/${exam._id}`)}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition"
                >
                    <FiEdit2 /> Edit
                </button>
                {exam.status === 'published' && (
                    <button
                        onClick={() => navigate(`/teacher/exam-statistics/${exam._id}`)}
                        className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition"
                    >
                        <FiBarChart2 /> Stats
                    </button>
                )}
                {exam.status === 'draft' ? (
                    <button
                        onClick={() => handlePublish(exam._id)}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition"
                    >
                        <FiGlobe /> Publish
                    </button>
                ) : (
                    <button
                        onClick={() => handleUnpublish(exam._id)}
                        className="flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition"
                    >
                        <FiEyeOff /> Unpublish
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-16">
            <header className="bg-gradient-to-r from-emerald-700 to-teal-700 p-8 rounded-3xl shadow-xl text-white">
                <h1 className="text-3xl font-extrabold flex items-center gap-3">
                    <FiGlobe className="opacity-80" /> AI-Generated Exams
                </h1>
                <p className="text-emerald-200 mt-1">{published.length} published · {drafts.length} draft{drafts.length !== 1 ? 's' : ''}</p>
            </header>

            {actionMsg && (
                <div className={`p-4 rounded-2xl font-semibold text-sm ${actionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {actionMsg.text}
                </div>
            )}

            {exams.length === 0 ? (
                <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <FiBookOpen className="text-6xl mx-auto mb-4 opacity-30" />
                    <p className="font-semibold">No AI-generated exams yet.</p>
                    <button onClick={() => navigate('/teacher/materials')}
                        className="mt-4 bg-violet-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-violet-700 transition">
                        Start with Material →
                    </button>
                </div>
            ) : (
                <>
                    {published.length > 0 && (
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                            <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                                <FiGlobe className="text-emerald-600" /> Published ({published.length})
                            </h2>
                            <div className="space-y-3">
                                {published.map(exam => <ExamCard key={exam._id} exam={exam} />)}
                            </div>
                        </div>
                    )}

                    {drafts.length > 0 && (
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                            <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                                <FiEdit2 className="text-amber-600" /> Drafts ({drafts.length})
                            </h2>
                            <div className="space-y-3">
                                {drafts.map(exam => <ExamCard key={exam._id} exam={exam} />)}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PublishedExams;
