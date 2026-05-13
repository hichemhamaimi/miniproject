import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCpu, FiLayers, FiShield, FiUsers } from 'react-icons/fi';

const Dashboard = () => {
    const { user } = useAuth();

    if (user?.role !== 'superadmin') {
        return <div className="surface-card p-8 text-center font-semibold text-red-500">Access denied.</div>;
    }

    return (
        <div className="space-y-8">
            <header className="page-hero">
                <p className="eyebrow">System Administration</p>
                <h1 className="page-title">Oversee users, departments, and platform governance from one consistent admin surface</h1>
                <p className="page-subtitle">
                    The updated admin area favors clarity, action density, and operational confidence while preserving all creation, assignment, and account-management logic.
                </p>
            </header>

            <div className="grid gap-5 md:grid-cols-3">
                <Link
                    to="/superadmin/users"
                    className="surface-card group p-7 transition duration-200 hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(15,23,42,0.13)]"
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <FiUsers className="text-2xl" />
                    </div>
                    <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-900">Manage Users</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        Create accounts, reset credentials, and keep role access under control with better table and modal ergonomics.
                    </p>
                    <div className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                        <span>Open user directory</span>
                        <FiArrowRight className="transition-transform group-hover:translate-x-1" />
                    </div>
                </Link>

                <Link
                    to="/superadmin/departments"
                    className="surface-card group p-7 transition duration-200 hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(15,23,42,0.13)]"
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                        <FiLayers className="text-2xl" />
                    </div>
                    <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-900">Manage Departments</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        Structure departments, assign administrators, and maintain the academic hierarchy in a more readable control plane.
                    </p>
                    <div className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                        <span>Open department manager</span>
                        <FiArrowRight className="transition-transform group-hover:translate-x-1" />
                    </div>
                </Link>

                <Link
                    to="/superadmin/ai-providers"
                    className="surface-card group p-7 transition duration-200 hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(15,23,42,0.13)]"
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <FiCpu className="text-2xl" />
                    </div>
                    <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-900">Manage AI Providers</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        Register platform LLMs, update API keys or LAN hosts, and choose the global embedding service used for retrieval.
                    </p>
                    <div className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                        <span>Open AI configuration</span>
                        <FiArrowRight className="transition-transform group-hover:translate-x-1" />
                    </div>
                </Link>
            </div>

            <div className="soft-stat flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <FiShield className="text-xl" />
                </div>
                <div>
                    <p className="text-lg font-extrabold text-slate-900">Administrative actions stay exactly the same underneath</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        This redesign is presentation-only: no backend contracts, auth flow, or business rules were altered.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
