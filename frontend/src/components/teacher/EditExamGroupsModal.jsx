import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FiUsers, FiX } from 'react-icons/fi';

const EditExamGroupsModal = ({ isOpen, exam, availableGroups, onClose, onSuccess }) => {
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && exam) {
            axiosInstance.get(`/teacher/exams/${exam.id}`)
                .then((res) => {
                    const assignedIds = res.data.assignedGroups?.map((g) => g.id) || [];
                    setSelectedGroups(assignedIds);
                })
                .catch((err) => {
                    setError('Failed to load current groups.');
                    console.error(err);
                });
        }
    }, [isOpen, exam]);

    const handleGroupToggle = (groupId) => {
        setSelectedGroups((prev) =>
            prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
        );
    };

    const handleSave = async () => {
        if (selectedGroups.length === 0) {
            if (!window.confirm('You are about to remove all groups. The exam will remain but no one will be able to take it. Continue?')) {
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
            console.error('Error updating groups:', err);
            setError(err.response?.data?.message || 'Failed to update groups.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !exam) return null;

    return (
        <div className="modal-backdrop">
            <div className="modal-panel max-w-xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-5">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900">Edit Assigned Groups</h2>
                        <p className="mt-1 truncate text-sm text-slate-500">{exam.title}</p>
                    </div>
                    <button onClick={onClose} className="ghost-button !rounded-xl !px-3 !py-2">
                        <FiX />
                    </button>
                </div>

                <div className="space-y-4 p-6">
                    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600">{error}</div>}

                    <div className="flex items-center gap-3 text-sm text-slate-600">
                        <FiUsers className="text-cyan-600" />
                        <span>Select the groups that should have access to this exam.</span>
                    </div>

                    <div className="space-y-2 rounded-[24px] border border-slate-200 bg-slate-50/80 p-3">
                        {availableGroups.length > 0 ? (
                            availableGroups.map((group) => (
                                <label key={group.id} className={`flex items-center rounded-2xl border px-4 py-3 transition ${
                                    selectedGroups.includes(group.id) ? 'border-cyan-200 bg-cyan-50' : 'border-transparent bg-white hover:border-slate-200'
                                }`}>
                                    <input
                                        type="checkbox"
                                        className="h-5 w-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                        checked={selectedGroups.includes(group.id)}
                                        onChange={() => handleGroupToggle(group.id)}
                                    />
                                    <span className={`ml-3 font-semibold ${selectedGroups.includes(group.id) ? 'text-cyan-900' : 'text-slate-700'}`}>
                                        {group.name}
                                    </span>
                                </label>
                            ))
                        ) : (
                            <div className="p-4 text-center text-sm text-slate-500">No groups available in this module.</div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-5 sm:flex-row sm:justify-end">
                    <button onClick={onClose} disabled={isSaving} className="ghost-button">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="action-button">
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditExamGroupsModal;
