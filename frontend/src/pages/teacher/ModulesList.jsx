import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { FiArrowRight, FiBookOpen } from 'react-icons/fi';

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
                console.error('Error fetching modules:', err);
                setError('Failed to fetch modules');
                setLoading(false);
            }
        };

        fetchModules();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
            </div>
        );
    }

    if (error) {
        return <div className="surface-card border-red-200 p-4 text-red-700">{error}</div>;
    }

    return (
        <div className="space-y-8">
            <header className="page-hero">
                <p className="eyebrow">Teacher Modules</p>
                <h1 className="page-title">Your teaching modules, organized for faster action</h1>
                <p className="page-subtitle">Open rosters, inspect exam history, and launch the exam workflow from a cleaner module overview.</p>
            </header>

            {modules.length === 0 ? (
                <div className="empty-state">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                        <FiBookOpen className="text-3xl" />
                    </div>
                    <h3 className="mt-5 text-lg font-bold text-slate-800">No modules assigned</h3>
                    <p className="mt-2 text-sm text-slate-500">You have not been assigned to any modules yet.</p>
                </div>
            ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {modules.map((mod) => (
                        <Link
                            key={mod.id}
                            to={`/teacher/modules/${mod.id}`}
                            className="surface-card group p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.14)]"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-sm font-extrabold tracking-[0.12em] text-white">
                                    {mod.abbreviation}
                                </div>
                                <span className="status-badge border-slate-200 bg-slate-100 text-slate-600">
                                    {mod.groups.length} group(s)
                                </span>
                            </div>

                            <h3 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">{mod.name}</h3>
                            <p className="mt-3 text-sm leading-6 text-slate-500">Open this module to inspect students, review exam history, and publish or edit assessments.</p>

                            <div className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                                <span>View details</span>
                                <FiArrowRight className="transition-transform group-hover:translate-x-1" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ModulesList;
