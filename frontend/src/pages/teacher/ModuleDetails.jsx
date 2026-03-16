import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import PublishExamModal from '../../components/teacher/PublishExamModal';
import ExamDetailsModal from '../../components/teacher/ExamDetailsModal';
import EditExamGroupsModal from '../../components/teacher/EditExamGroupsModal';

const ModuleDetails = () => {
    const { moduleId } = useParams();
    const [activeTab, setActiveTab] = useState('students'); // 'students' | 'exams'
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
                // Fetch both students and exams for this module concurrently
                const [studentsRes, examsRes] = await Promise.all([
                    axiosInstance.get(`/teacher/modules/${moduleId}/students`),
                    axiosInstance.get(`/teacher/modules/${moduleId}/exams`)
                ]);
                
                setStudents(studentsRes.data);
                setExams(examsRes.data);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching module details:", err);
                setError('Failed to load module data. ' + (err.response?.data?.message || ''));
                setLoading(false);
            }
        };

    useEffect(() => {
        fetchModuleData();
    }, [moduleId]);

    // Extract unique groups from the students list
    const moduleGroups = [...new Map(students.map(s => [s.group_id, { id: s.group_id, name: s.group_name }])).values()];

    const openPublishModal = (exam) => {
        setSelectedExamToPublish(exam);
        setIsPublishModalOpen(true);
    };

    const openDetailsModal = (exam) => {
        setSelectedExamForDetails(exam);
        setIsDetailsModalOpen(true);
    };

    const openEditGroupsModal = (exam) => {
        setSelectedExamForEditGroups(exam);
        setIsEditGroupsModalOpen(true);
    };

    const handleUnpublish = async (examId) => {
        if (!window.confirm("Are you sure you want to unpublish this exam? It will become unavailable to students immediately.")) {
            return;
        }
        try {
            await axiosInstance.post(`/teacher/exams/${examId}/unpublish`);
            fetchModuleData();
        } catch (err) {
            console.error("Error unpublishing exam:", err);
            alert("Failed to unpublish exam. " + (err.response?.data?.message || ''));
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <Link to="/teacher/modules" className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm font-medium">
                    &larr; Back to Modules
                </Link>
                <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                     <Link to="/teacher/modules" className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm font-medium mb-2">
                        &larr; Back to Modules
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-800">Module Details</h1>
                </div>
                <Link 
                    to="/teacher/create-exam" 
                    state={{ preselectedModuleId: moduleId }}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all"
                >
                    + Create Exam
                </Link>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex border-b border-gray-100">
                    <button 
                        className={`flex-1 py-4 text-center font-medium text-sm transition-colors ${activeTab === 'students' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        onClick={() => setActiveTab('students')}
                    >
                        Enrolled Students ({students.length})
                    </button>
                    <button 
                        className={`flex-1 py-4 text-center font-medium text-sm transition-colors ${activeTab === 'exams' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        onClick={() => setActiveTab('exams')}
                    >
                        Exam History ({exams.length})
                    </button>
                </div>

                <div className="p-0">
                    {/* STUDENTS TAB */}
                    {activeTab === 'students' && (
                        <div className="overflow-x-auto">
                            {students.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                            <th className="p-4 rounded-tl-xl font-semibold">Student Name</th>
                                            <th className="p-4 font-semibold">Username</th>
                                            <th className="p-4 font-semibold">Group</th>
                                            <th className="p-4 rounded-tr-xl font-semibold">Year</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {students.map((student) => (
                                            <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 flex items-center">
                                                    <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs mr-3">
                                                        {student.name.charAt(0)}{student.lastname.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-800">{student.lastname} {student.name}</div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-gray-600 text-sm">{student.username}</td>
                                                <td className="p-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {student.group_name}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-600 text-sm">{student.year} Year</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center text-gray-500">No students found matching this module.</div>
                            )}
                        </div>
                    )}

                    {/* EXAMS TAB */}
                    {activeTab === 'exams' && (
                        <div className="overflow-x-auto">
                            {exams.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                            <th className="p-4 rounded-tl-xl font-semibold">Exam Title</th>
                                            <th className="p-4 font-semibold">Created By</th>
                                            <th className="p-4 font-semibold">Date Created</th>
                                            <th className="p-4 font-semibold">Status</th>
                                            <th className="p-4 rounded-tr-xl font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {exams.map((exam) => (
                                            <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-medium text-gray-800">{exam.title}</td>
                                                <td className="p-4 text-gray-600 text-sm">{exam.creator_lastname} {exam.creator_name}</td>
                                                <td className="p-4 text-gray-600 text-sm">
                                                    {new Date(exam.creation_date).toLocaleDateString()}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        exam.status === 'LIVE' ? 'bg-green-100 text-green-800' : 
                                                        exam.status === 'READY' ? 'bg-blue-100 text-blue-800' :
                                                        exam.status === 'CLOSED' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {exam.status || 'DRAFT'}
                                                    </span>
                                                </td>
                                                <td className="p-4 space-x-2">
                                                    {exam.status !== 'LIVE' && exam.status !== 'CLOSED' && (
                                                        <button 
                                                            onClick={() => openPublishModal(exam)}
                                                            className="text-white text-sm font-medium px-3 py-1 bg-green-500 rounded-lg hover:bg-green-600 transition shadow-sm"
                                                        >
                                                            Publish
                                                        </button>
                                                    )}
                                                    {exam.status === 'LIVE' && (
                                                        <>
                                                            <button 
                                                                onClick={() => openEditGroupsModal(exam)}
                                                                className="text-white text-sm font-medium px-3 py-1 bg-blue-500 rounded-lg hover:bg-blue-600 transition shadow-sm"
                                                            >
                                                                Edit Groups
                                                            </button>
                                                            <button 
                                                                onClick={() => handleUnpublish(exam.id)}
                                                                className="text-white text-sm font-medium px-3 py-1 bg-amber-500 rounded-lg hover:bg-amber-600 transition shadow-sm"
                                                            >
                                                                Unpublish
                                                            </button>
                                                        </>
                                                    )}
                                                    <button 
                                                        onClick={() => openDetailsModal(exam)}
                                                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium px-3 py-1 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
                                                    >
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-12 text-center text-gray-500">
                                    <div className="mb-4">
                                        <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    No exams have been created for this module yet.
                                </div>
                            )}
                        </div>
                    )}
                </div>
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
