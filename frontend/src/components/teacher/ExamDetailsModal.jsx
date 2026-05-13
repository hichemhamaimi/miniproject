import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FiCalendar, FiClock, FiFileText, FiLoader, FiUsers, FiX } from 'react-icons/fi';

const ExamDetailsModal = ({ isOpen, examId, onClose }) => {
    const [examData, setExamData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && examId) {
            setLoading(true);
            setError('');
            axiosInstance.get(`/teacher/exams/${examId}`)
                .then((res) => {
                    setExamData(res.data);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error('Error fetching exam details:', err);
                    setError('Failed to load exam details.');
                    setLoading(false);
                });
        } else {
            setExamData(null);
        }
    }, [isOpen, examId]);

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop">
            <div className="modal-panel max-w-3xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-5">
                    <h2 className="text-xl font-extrabold text-slate-900">Exam Details</h2>
                    <button onClick={onClose} className="ghost-button !rounded-xl !px-3 !py-2">
                        <FiX />
                    </button>
                </div>

                <div className="max-h-[90vh] overflow-y-auto p-6">
                    {loading && (
                        <div className="flex h-48 items-center justify-center">
                            <FiLoader className="animate-spin text-3xl text-cyan-600" />
                        </div>
                    )}

                    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center font-medium text-red-600">{error}</div>}

                    {!loading && !error && examData && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">{examData.title}</h3>
                                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                                    <span className="status-badge border-cyan-200 bg-cyan-50 text-cyan-700">
                                        {examData.module_name} ({examData.module_abbreviation})
                                    </span>
                                    <span className="status-badge border-slate-200 bg-slate-100 text-slate-700">{examData.status}</span>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="surface-muted flex items-center gap-4 px-5 py-4">
                                    <FiClock className="text-xl text-cyan-600" />
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Duration</div>
                                        <div className="mt-1 font-bold text-slate-900">{examData.duration_minutes} Minutes</div>
                                    </div>
                                </div>
                                <div className="surface-muted flex items-center gap-4 px-5 py-4">
                                    <FiCalendar className="text-xl text-cyan-600" />
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Created On</div>
                                        <div className="mt-1 font-bold text-slate-900">{new Date(examData.creation_date).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <div className="surface-muted flex items-center gap-4 px-5 py-4">
                                    <FiFileText className="text-xl text-cyan-600" />
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Questions</div>
                                        <div className="mt-1 font-bold text-slate-900">{examData.content?.questions ? examData.content.questions.length : '0'} Questions</div>
                                    </div>
                                </div>
                                <div className="surface-muted flex items-center gap-4 px-5 py-4">
                                    <FiUsers className="text-xl text-cyan-600" />
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Assigned Groups</div>
                                        <div className="mt-1 font-bold text-slate-900">{examData.assignedGroups?.length || 0} Groups</div>
                                    </div>
                                </div>
                                <div className="surface-muted flex items-center gap-4 px-5 py-4">
                                    <FiFileText className="text-xl text-cyan-600" />
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Exam Security</div>
                                        <div className="mt-1 font-bold text-slate-900">{examData.require_seb ? 'SEB required' : 'Standard browser allowed'}</div>
                                    </div>
                                </div>
                            </div>

                            {examData.assignedGroups && examData.assignedGroups.length > 0 ? (
                                <div>
                                    <h4 className="text-lg font-extrabold text-slate-900">Assigned To</h4>
                                    <ul className="mt-4 space-y-3">
                                        {examData.assignedGroups.map((group) => (
                                            <li key={group.id} className="surface-muted flex items-center justify-between px-4 py-3">
                                                <span className="font-semibold text-slate-800">{group.name}</span>
                                                <span className="status-badge border-slate-200 bg-white text-slate-600">{group.year} Year</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <div className="surface-muted p-4 text-center text-sm font-medium text-amber-700">
                                    This exam is not currently assigned to any groups.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end border-t border-slate-200 bg-slate-50/80 px-6 py-5">
                    <button onClick={onClose} className="ghost-button">Close</button>
                </div>
            </div>
        </div>
    );
};

export default ExamDetailsModal;
