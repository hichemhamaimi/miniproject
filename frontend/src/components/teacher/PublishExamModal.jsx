import React, { useState } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FaGlobe, FaTimes, FaSpinner } from 'react-icons/fa';

const PublishExamModal = ({ isOpen, onClose, exam, availableGroups, onPublishSuccess }) => {
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen || !exam) return null;

    const handleGroupToggle = (groupId) => {
        setSelectedGroups(prev => 
            prev.includes(groupId) 
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    const handlePublish = async () => {
        if (selectedGroups.length === 0) {
            setError("You must select at least one group to publish to.");
            return;
        }

        setIsPublishing(true);
        setError('');

        try {
            const payload = {
                groupIds: selectedGroups,
                start_time: startTime ? new Date(startTime).toISOString().slice(0, 19).replace('T', ' ') : null,
                end_time: endTime ? new Date(endTime).toISOString().slice(0, 19).replace('T', ' ') : null,
            };

            await axiosInstance.post(`/teacher/exams/${exam.id}/publish`, payload);
            
            setIsPublishing(false);
            onPublishSuccess();
            onClose();
        } catch (err) {
            setIsPublishing(false);
            console.error("Failed to publish exam", err);
            setError(err.response?.data?.message || "Failed to publish exam.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Publish Exam</h2>
                        <p className="text-sm text-gray-500 mt-1">{exam.title}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        X
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {error && (
                        <div className="p-3 bg-red-100 text-red-700 text-sm rounded-lg">{error}</div>
                    )}

                     {/* Time Window */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-700">Time Window (Optional)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Available From</label>
                                <input 
                                    type="datetime-local" 
                                    className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Available Until</label>
                                <input 
                                    type="datetime-local" 
                                    className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Groups Selection */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-gray-700">Assign to Groups</h3>
                        {availableGroups.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2">
                                {availableGroups.map(group => (
                                    <label key={group.id} className="flex items-center space-x-3 p-3 border border-gray-100 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                            checked={selectedGroups.includes(group.id)}
                                            onChange={() => handleGroupToggle(group.id)}
                                        />
                                        <span className="text-sm font-medium text-gray-700">{group.name}</span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg text-center">
                                No groups available. Students must be enrolled in this module for groups to appear.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                        disabled={isPublishing}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handlePublish}
                        disabled={isPublishing || selectedGroups.length === 0}
                        className="flex items-center space-x-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPublishing ? "Publishing..." : "Publish to LIVE"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PublishExamModal;
