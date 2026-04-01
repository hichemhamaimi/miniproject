import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { FaPlayCircle, FaCheckCircle, FaClock, FaDownload } from 'react-icons/fa';

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
                console.error("Error fetching exams", err);
                setError("Failed to load available exams.");
                setLoading(false);
            }
        };

        if (user?.role === 'student') {
            fetchAvailableExams();
        }
    }, [user]);

    if (user?.role !== 'student') {
        return <div className="p-8 text-center text-red-500 font-semibold">Access Denied</div>;
    }

    const handleEnterExam = (exam) => {
        // Warning about Safe Exam Browser
        const confirmed = window.confirm(
            "This exam requires Safe Exam Browser (SEB).\nIf you are not using SEB, your access will be blocked.\n\nContinue?"
        );
        if (confirmed) {
            navigate(`/student/exams/${exam.id}`);
        }
    };

    const handleDownloadSeb = async (exam) => {
        try {
            const response = await axiosInstance.get(`/student/exams/${exam.id}/seb`, {
                responseType: 'blob'
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
            console.error("Error downloading SEB file", err);
            alert("Failed to download SEB file.");
        }
    };

    return (
        <div className="space-y-6">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Student Dashboard</h1>
                    <p className="text-gray-500 mt-1">Welcome, {user.username}. Here are your assigned exams.</p>
                </div>
            </header>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-600"></div>
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl">{error}</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {exams.length === 0 ? (
                        <div className="col-span-full bg-white p-12 rounded-2xl border border-gray-100 text-center text-gray-500 shadow-sm">
                            <span className="text-4xl block mb-4">☕</span>
                            No exams currently available. Relax!
                        </div>
                    ) : (
                        exams.map(exam => {
                            const isSubmitted = exam.attempt_status === 'SUBMITTED' || exam.attempt_status === 'EXPIRED';
                            const isOngoing = exam.attempt_status === 'ONGOING';
                            
                            const now = new Date();
                            const hasStarted = !exam.start_time || new Date(exam.start_time) <= now;
                            const hasEnded = exam.end_time && new Date(exam.end_time) < now;
                            const isAvailable = hasStarted && !hasEnded;

                            return (
                                <div key={exam.id} className={`bg-white rounded-2xl border shadow-sm p-6 transition-all ${
                                    isSubmitted ? 'border-gray-200 opacity-75' : 'border-indigo-100 hover:border-indigo-300 hover:shadow-md'
                                }`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 mb-2">
                                                {exam.module_name} ({exam.module_abbreviation})
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-800">{exam.title}</h3>
                                        </div>
                                        {isSubmitted && (
                                            <span className="text-green-500" title="Completed"><FaCheckCircle className="w-6 h-6" /></span>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center space-x-6 text-sm text-gray-500 mb-6">
                                        <div className="flex items-center space-x-2">
                                            <FaClock className="text-gray-400" />
                                            <span>{exam.duration_minutes} Minutes</span>
                                        </div>
                                        {exam.start_time && (
                                            <div>Valid from: {new Date(exam.start_time).toLocaleDateString()}</div>
                                        )}
                                    </div>

                                    <div className="flex items-center">
                                        {isSubmitted ? (
                                            <span className="px-4 py-2 bg-gray-100 text-gray-600 font-medium rounded-xl text-sm w-full text-center">
                                                Already Submitted
                                            </span>
                                        ) : !hasStarted ? (
                                            <span className="px-4 py-2 bg-gray-100 text-gray-600 font-medium rounded-xl text-sm w-full text-center">
                                                Exam has not started yet
                                            </span>
                                        ) : hasEnded ? (
                                            <span className="px-4 py-2 bg-red-50 text-red-600 font-medium rounded-xl text-sm w-full text-center">
                                                Exam has ended
                                            </span>
                                        ) : (
                                            <div className="flex flex-1 space-x-3">
                                                <button 
                                                    onClick={() => handleDownloadSeb(exam)}
                                                    className="flex justify-center items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-medium transition-colors border border-slate-200"
                                                    title="Download SEB Configuration"
                                                >
                                                    <FaDownload />
                                                    <span className="hidden sm:inline">SEB File</span>
                                                </button>
                                                {isOngoing ? (
                                                    <button 
                                                        onClick={() => navigate(`/student/exams/${exam.id}`)}
                                                        className="flex-1 flex justify-center items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
                                                    >
                                                        <FaPlayCircle />
                                                        <span>Resume Exam</span>
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleEnterExam(exam)}
                                                        className="flex-1 flex justify-center items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-colors"
                                                    >
                                                        <FaPlayCircle />
                                                        <span>Start Exam</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
