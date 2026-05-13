import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiLayers, FiUsers } from 'react-icons/fi';

const Dashboard = () => {
    const { user } = useAuth();

    if (user?.role !== 'department_admin') {
        return <div className="surface-card p-8 text-center font-semibold text-red-500">Access denied.</div>;
    }

    return (
        <div className="space-y-8">
            <header className="page-hero">
                <p className="eyebrow">Department Administration</p>
                <h1 className="page-title">Manage academic structure with clearer operational views</h1>
                <p className="page-subtitle">
                    Organize groups, assign modules, and keep departmental delivery aligned through a more structured data-first interface.
                </p>
            </header>

            <div className="grid gap-5 md:grid-cols-2">
                <Link
                    to="/departmentadmin/groups"
                    className="surface-card group overflow-hidden p-7 transition duration-200 hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(15,23,42,0.13)]"
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                        <FiUsers className="text-2xl" />
                    </div>
                    <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-900">Manage Groups</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        Create cohorts, review linked modules, and assign students from a calmer, easier-to-scan workspace.
                    </p>
                    <div className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                        <span>Open group manager</span>
                        <FiArrowRight className="transition-transform group-hover:translate-x-1" />
                    </div>
                </Link>

                <Link
                    to="/departmentadmin/modules"
                    className="surface-card group overflow-hidden p-7 transition duration-200 hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(15,23,42,0.13)]"
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                        <FiLayers className="text-2xl" />
                    </div>
                    <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-900">Manage Modules</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        Maintain module ownership, link groups, and keep responsibilities visible without changing existing workflows.
                    </p>
                    <div className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                        <span>Open module manager</span>
                        <FiArrowRight className="transition-transform group-hover:translate-x-1" />
                    </div>
                </Link>
            </div>
        </div>
    );
};

export default Dashboard;
