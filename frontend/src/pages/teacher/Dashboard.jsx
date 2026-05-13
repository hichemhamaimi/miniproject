import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { FiActivity, FiArrowRight, FiBookOpen, FiCpu, FiLayers } from 'react-icons/fi';

const cards = [
    {
        title: 'AI Exam Workflow',
        desc: 'Process material, select concepts, configure question balance, and launch generation with a clear guided flow.',
        to: '/teacher/exam-workflow',
        label: 'Start workflow',
        icon: FiActivity,
        accent: 'from-cyan-500/20 to-blue-500/10',
    },
    {
        title: 'Generated Exams',
        desc: 'Review drafts, publish sessions, revisit live deliveries, and export results from one control space.',
        to: '/teacher/published-exams',
        label: 'Open exams',
        icon: FiLayers,
        accent: 'from-emerald-500/20 to-teal-500/10',
    },
    {
        title: 'My Modules',
        desc: 'Track rosters, inspect exam history, adjust publishing targets, and move quickly into module-level actions.',
        to: '/teacher/modules',
        label: 'View modules',
        icon: FiBookOpen,
        accent: 'from-violet-500/20 to-indigo-500/10',
    },
    {
        title: 'Material Library',
        desc: 'Upload, inspect, retry, and clean up source materials while the system keeps parsing and mindmap generation visible.',
        to: '/teacher/materials',
        label: 'Open materials',
        icon: FiCpu,
        accent: 'from-amber-500/20 to-orange-500/10',
    },
];

const Dashboard = () => {
    const { user } = useAuth();

    if (user?.role !== 'teacher') {
        return <div className="surface-card p-8 text-center text-xl font-semibold text-red-500">Access denied. For teachers only.</div>;
    }

    return (
        <div className="space-y-8">
            <header className="page-hero">
                <p className="eyebrow">Teacher Workspace</p>
                <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="page-title">Design, publish, and analyze assessments with less friction</h1>
                        <p className="page-subtitle">
                            Move from course material to a production-ready exam workflow with cleaner structure, better decision points, and faster access to publishing and reporting.
                        </p>
                    </div>
                    <div className="grid min-w-[15rem] gap-3 sm:grid-cols-2 lg:w-[20rem] lg:grid-cols-1">
                        <div className="rounded-[24px] border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Profile</p>
                            <p className="mt-2 text-2xl font-extrabold">{user.username || `Teacher ${user.userId}`}</p>
                        </div>
                    </div>
                </div>
            </header>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => {
                    const Icon = card.icon;

                    return (
                        <Link
                            key={card.to}
                            to={card.to}
                            className="surface-card group relative overflow-hidden p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.14)]"
                        >
                            <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${card.accent}`} />
                            <div className="relative">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                                    <Icon className="text-lg" />
                                </div>
                                <h2 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">{card.title}</h2>
                                <p className="mt-3 text-sm leading-6 text-slate-500">{card.desc}</p>
                                <div className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                                    <span>{card.label}</span>
                                    <FiArrowRight className="transition-transform group-hover:translate-x-1" />
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
                <div className="soft-stat">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Workflow design</p>
                    <p className="mt-3 text-lg font-extrabold text-slate-900">Create from module context</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">The redesigned flow keeps materials, concept selection, and generation settings in one coordinated experience.</p>
                </div>
                <div className="soft-stat">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Publishing control</p>
                    <p className="mt-3 text-lg font-extrabold text-slate-900">Safer release management</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Drafts, live sessions, assigned groups, and exports are easier to scan without changing exam logic or status rules.</p>
                </div>
                <div className="soft-stat">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Analytics readiness</p>
                    <p className="mt-3 text-lg font-extrabold text-slate-900">Faster route to review</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Module and exam surfaces now prioritize status, readability, and the next available action.</p>
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
