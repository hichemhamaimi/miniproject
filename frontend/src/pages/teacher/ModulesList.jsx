import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';

const ModulesList = () => {
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchModules = async () => {
            try {
                const response = await axiosInstance.get('/teacher/modules');
                setModules(response.data);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching modules:", err);
                setError('Failed to fetch modules');
                setLoading(false);
            }
        };

        fetchModules();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (error) {
        return <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">My Modules</h1>
                    <p className="text-gray-500 mt-2">Manage your assigned modules, students, and exams.</p>
                </div>
            </header>

            {modules.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <div className="text-gray-400 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No Modules Assigned</h3>
                    <p className="mt-1 text-gray-500">You haven't been assigned to any modules yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modules.map((mod) => (
                        <Link 
                            key={mod.id} 
                            to={`/teacher/modules/${mod.id}`}
                            className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    {mod.abbreviation}
                                </div>
                                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">
                                    {mod.groups.length} Group(s)
                                </span>
                            </div>
                            
                            <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2">{mod.name}</h3>
                            
                            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center text-indigo-600 text-sm font-medium group-hover:text-indigo-700">
                                View Details 
                                <svg className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ModulesList;
