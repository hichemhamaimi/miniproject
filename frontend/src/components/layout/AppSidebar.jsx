import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    FiActivity,
    FiBookOpen,
    FiBriefcase,
    FiCpu,
    FiGrid,
    FiLayers,
    FiSettings,
    FiShield,
    FiUsers,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const roleConfig = {
    teacher: {
        label: 'Teacher workspace',
        subtitle: 'Exam design and delivery',
        icon: FiBriefcase,
        accent: 'from-cyan-500 to-blue-500',
        links: [
            { to: '/teacher/dashboard', label: 'Overview', icon: FiGrid },
            { to: '/teacher/exam-workflow', label: 'Exam workflow', icon: FiActivity },
            { to: '/teacher/materials', label: 'Materials', icon: FiCpu },
            { to: '/teacher/modules', label: 'Modules', icon: FiBookOpen },
            { to: '/teacher/published-exams', label: 'Generated exams', icon: FiLayers },
        ],
    },
    student: {
        label: 'Student workspace',
        subtitle: 'Focused exam experience',
        icon: FiBookOpen,
        accent: 'from-emerald-500 to-cyan-500',
        links: [
            { to: '/student/dashboard', label: 'Assigned exams', icon: FiGrid },
            { to: '/student/results', label: 'Results', icon: FiActivity },
        ],
    },
    department_admin: {
        label: 'Department admin',
        subtitle: 'Structure and assignments',
        icon: FiUsers,
        accent: 'from-sky-500 to-indigo-500',
        links: [
            { to: '/departmentadmin/dashboard', label: 'Overview', icon: FiGrid },
            { to: '/departmentadmin/groups', label: 'Groups', icon: FiUsers },
            { to: '/departmentadmin/modules', label: 'Modules', icon: FiLayers },
        ],
    },
    superadmin: {
        label: 'System admin',
        subtitle: 'Global governance',
        icon: FiShield,
        accent: 'from-slate-700 to-slate-900',
        links: [
            { to: '/superadmin/dashboard', label: 'Overview', icon: FiGrid },
            { to: '/superadmin/users', label: 'Users', icon: FiUsers },
            { to: '/superadmin/departments', label: 'Departments', icon: FiLayers },
            { to: '/superadmin/ai-providers', label: 'AI providers', icon: FiSettings },
        ],
    },
};

const AppSidebar = () => {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return null;
    }

    const config = roleConfig[user.role];
    if (!config) {
        return null;
    }

    const RoleIcon = config.icon;

    return (
        <aside className="shell-sidebar">
            <div className={`rounded-[28px] bg-gradient-to-br ${config.accent} p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]`}>
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                        <RoleIcon className="text-xl" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/70">ExamQ</p>
                        <h2 className="mt-1 text-lg font-extrabold">{config.label}</h2>
                    </div>
                </div>
                <p className="mt-4 text-sm text-white/80">{config.subtitle}</p>
            </div>

            <nav className="mt-8 space-y-2">
                {config.links.map((link) => {
                    const Icon = link.icon;
                    const active = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);

                    return (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={`nav-link ${active ? 'nav-link-active' : ''}`}
                        >
                            <Icon className="text-lg" />
                            <span>{link.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Signed in as</p>
                <p className="mt-3 text-sm font-bold text-slate-800">{user.username || `User ${user.userId}`}</p>
                <p className="mt-1 text-sm text-slate-500">{user.role.replace('_', ' ')}</p>
            </div>
        </aside>
    );
};

export default AppSidebar;
