import React, { useState } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { toSqlLocalDateTime } from '../../utils/dateTime';
import { FiClock, FiGlobe, FiX } from 'react-icons/fi';

const PublishExamModal = ({ isOpen, onClose, exam, availableGroups, onPublishSuccess, publishPath }) => {
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [requireSeb, setRequireSeb] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (isOpen && exam) {
            setRequireSeb(Boolean(exam.require_seb));
            setDurationMinutes(Number(exam.duration_minutes) > 0 ? Number(exam.duration_minutes) : 60);
        }
    }, [exam, isOpen]);

    if (!isOpen || !exam) return null;

    const handleGroupToggle = (groupId) => {
        setSelectedGroups((prev) =>
            prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
        );
    };

    const handlePublish = async () => {
        if (selectedGroups.length === 0) {
            setError('You must select at least one group to publish to.');
            return;
        }
        const parsedDuration = Number.parseInt(durationMinutes, 10);
        if (!Number.isFinite(parsedDuration) || parsedDuration < 1) {
            setError('Duration must be at least 1 minute.');
            return;
        }

        setIsPublishing(true);
        setError('');

        try {
            const payload = {
                title: exam.title,
                groupIds: selectedGroups,
                start_time: toSqlLocalDateTime(startTime),
                end_time: toSqlLocalDateTime(endTime),
                duration_minutes: parsedDuration,
                require_seb: requireSeb,
            };

            await axiosInstance.post(publishPath || `/teacher/exams/${exam.id}/publish`, payload);

            setIsPublishing(false);
            onPublishSuccess();
            onClose();
        } catch (err) {
            setIsPublishing(false);
            console.error('Failed to publish exam', err);
            setError(err.response?.data?.message || 'Failed to publish exam.');
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-panel max-w-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-5">
                    <div>
                        <p className="eyebrow !text-slate-400">Publishing</p>
                        <h2 className="mt-2 text-xl font-extrabold text-slate-900">Publish Exam</h2>
                        <p className="mt-1 text-sm text-slate-500">{exam.title}</p>
                    </div>
                    <button onClick={onClose} className="ghost-button !rounded-xl !px-3 !py-2">
                        <FiX />
                    </button>
                </div>

                <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6">
                    {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
                    )}

                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="label-text">Exam Duration</label>
                            <div className="relative">
                                <FiClock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="number"
                                    min="1"
                                    className="input-field pl-11"
                                    value={durationMinutes}
                                    onChange={(e) => setDurationMinutes(e.target.value)}
                                />
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-500">Students will get this many minutes after they start their attempt.</p>
                        </div>
                        <div>
                            <label className="label-text">Available From</label>
                            <input type="datetime-local" className="input-field" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                        <div>
                            <label className="label-text">Available Until</label>
                            <input type="datetime-local" className="input-field" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                        </div>
                    </div>

                    <label className="surface-muted flex cursor-pointer items-start gap-3 px-4 py-4">
                        <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                            checked={requireSeb}
                            onChange={(event) => setRequireSeb(event.target.checked)}
                        />
                        <span>
                            <span className="block text-sm font-bold text-slate-800">Require Safe Exam Browser</span>
                            <span className="mt-1 block text-sm text-slate-500">Students will need a signed `.seb` launch file and verified SEB session to start this exam.</span>
                        </span>
                    </label>

                    <div>
                        <label className="label-text">Assign to Groups</label>
                        {availableGroups.length > 0 ? (
                            <div className="grid gap-3">
                                {availableGroups.map((group) => (
                                    <label key={group.id} className="surface-muted flex cursor-pointer items-center gap-3 px-4 py-3">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                            checked={selectedGroups.includes(group.id)}
                                            onChange={() => handleGroupToggle(group.id)}
                                        />
                                        <span className="text-sm font-semibold text-slate-700">{group.name}</span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="surface-muted p-4 text-center text-sm text-slate-500">
                                No groups available. Students must be enrolled in this module for groups to appear.
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-5 sm:flex-row sm:justify-end">
                    <button onClick={onClose} className="ghost-button" disabled={isPublishing}>Cancel</button>
                    <button onClick={handlePublish} disabled={isPublishing || selectedGroups.length === 0} className="secondary-button">
                        <FiGlobe />
                        <span>{isPublishing ? 'Publishing...' : 'Publish to LIVE'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PublishExamModal;
