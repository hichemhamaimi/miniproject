import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FaTimes, FaUsers } from 'react-icons/fa';

const EditExamGroupsModal = ({ isOpen, exam, availableGroups, onClose, onSuccess }) => {
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && exam) {
            // Pre-fill the currently assigned groups
            // When fetching exam details, they are in exam.assignedGroups. Or if passed from the table, we might need to fetch them.
            // Wait, we need to know the currently assigned groups. Let's fetch the exam details to be sure.
            axiosInstance.get(`/teacher/exams/${exam.id}`)
                .then(res => {
                    const assignedIds = res.data.assignedGroups?.map(g => g.id) || [];
                    setSelectedGroups(assignedIds);
                })
                .catch(err => {
                    setError("Failed to load current groups.");
                    console.error(err);
                });
        }
    }, [isOpen, exam]);

    const handleGroupToggle = (groupId) => {
        setSelectedGroups(prev => 
            prev.includes(groupId) 
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    const handleSave = async () => {
        if (selectedGroups.length === 0) {
            if (!window.confirm("You are about to remove all groups. The exam will remain but no one will be able to take it. Continue?")) {
                return;
            }
        }

        setIsSaving(true);
        setError('');

        try {
            await axiosInstance.put(`/teacher/exams/${exam.id}/groups`, { groupIds: selectedGroups });
            onSuccess();
            onClose();
        } catch (err) {
            console.error("Error updating groups:", err);
            setError(err.response?.data?.message || 'Failed to update groups.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !exam) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-50 backdrop-blur-sm transition-opacity">
             <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Edit Assigned Groups</h2>
                        <p className="text-sm text-gray-500 mt-1 truncate">{exam.title}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 bg-white rounded-full shadow-sm hover:shadow">
                        <FaTimes className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg mb-4 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="mb-4 text-sm text-gray-600 flex items-center space-x-2">
                        <FaUsers className="text-indigo-500" />
                        <span>Select the groups that should have access to this exam:</span>
                    </div>

                    <div className="space-y-2 border border-gray-100 rounded-xl p-2 bg-gray-50">
                        {availableGroups.length > 0 ? (
                            availableGroups.map(group => (
                                <label key={group.id} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                    selectedGroups.includes(group.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent hover:border-gray-200 shadow-sm'
                                }`}>
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                        checked={selectedGroups.includes(group.id)}
                                        onChange={() => handleGroupToggle(group.id)}
                                    />
                                    <span className={`ml-3 font-medium ${selectedGroups.includes(group.id) ? 'text-indigo-900' : 'text-gray-700'}`}>
                                        {group.name}
                                    </span>
                                </label>
                            ))
                        ) : (
                            <div className="p-4 text-center text-sm text-gray-500">No groups available in this module.</div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-medium transition shadow-sm disabled:opacity-70 flex items-center"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
             </div>
        </div>
    );
};

export default EditExamGroupsModal;
