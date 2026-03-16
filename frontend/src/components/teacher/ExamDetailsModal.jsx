import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FaTimes, FaUsers, FaClock, FaCalendarAlt, FaListUl, FaSpinner } from 'react-icons/fa';

const ExamDetailsModal = ({ isOpen, examId, onClose }) => {
    const [examData, setExamData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && examId) {
            setLoading(true);
            setError('');
            axiosInstance.get(`/teacher/exams/${examId}`)
                .then(res => {
                    setExamData(res.data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching exam details:", err);
                    setError('Failed to load exam details.');
                    setLoading(false);
                });
        } else {
            setExamData(null);
        }
    }, [isOpen, examId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-50 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-800">Exam Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 bg-white rounded-full shadow-sm hover:shadow">
                        <FaTimes className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {loading && (
                        <div className="flex justify-center items-center h-48">
                            <FaSpinner className="animate-spin w-8 h-8 text-indigo-500" />
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-4 text-center font-medium">
                            {error}
                        </div>
                    )}

                    {!loading && !error && examData && (
                        <div className="space-y-6">
                            {/* Header Info */}
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800 mb-2">{examData.title}</h3>
                                <div className="flex flex-wrap gap-2 text-sm">
                                    <span className={`px-2.5 py-1 rounded-full font-medium ${
                                        examData.status === 'LIVE' ? 'bg-green-100 text-green-800' :
                                        examData.status === 'READY' ? 'bg-blue-100 text-blue-800' :
                                        examData.status === 'CLOSED' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {examData.status}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 font-medium">
                                        {examData.module_name} ({examData.module_abbreviation})
                                    </span>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-xl p-4 flex items-center">
                                    <FaClock className="text-indigo-500 w-6 h-6 mr-3" />
                                    <div>
                                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Duration</div>
                                        <div className="text-gray-800 font-semibold">{examData.duration_minutes} Minutes</div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 flex items-center">
                                    <FaCalendarAlt className="text-indigo-500 w-6 h-6 mr-3" />
                                    <div>
                                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Created On</div>
                                        <div className="text-gray-800 font-semibold">{new Date(examData.creation_date).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 flex items-center">
                                    <FaListUl className="text-indigo-500 w-6 h-6 mr-3" />
                                    <div>
                                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Questions</div>
                                        <div className="text-gray-800 font-semibold">
                                            {examData.content?.questions ? examData.content.questions.length : '0'} Questions
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 flex items-center">
                                    <FaUsers className="text-indigo-500 w-6 h-6 mr-3" />
                                    <div>
                                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Assigned Groups</div>
                                        <div className="text-gray-800 font-semibold">
                                            {examData.assignedGroups?.length || 0} Groups
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Assigned Groups List */}
                            {examData.assignedGroups && examData.assignedGroups.length > 0 && (
                                <div>
                                    <h4 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Assigned To</h4>
                                    <ul className="space-y-2">
                                        {examData.assignedGroups.map(group => (
                                            <li key={group.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-white hover:bg-slate-50 transition">
                                                <span className="font-semibold text-gray-700">{group.name}</span>
                                                <span className="text-sm px-2 py-1 bg-gray-100 text-gray-500 rounded-lg">{group.year} Year</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                             {(!examData.assignedGroups || examData.assignedGroups.length === 0) && (
                                <div className="p-4 bg-yellow-50 text-yellow-700 rounded-xl mb-4 text-center font-medium border border-yellow-100">
                                    This exam is not currently assigned to any groups.
                                </div>
                            )}

                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-xl font-medium transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExamDetailsModal;
