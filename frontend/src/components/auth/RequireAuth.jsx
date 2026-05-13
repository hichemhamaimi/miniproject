import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ROLE_HOME = {
    teacher: '/teacher/dashboard',
    superadmin: '/superadmin/dashboard',
    department_admin: '/departmentadmin/dashboard',
    student: '/student/dashboard',
};

export const getRoleHome = (role) => ROLE_HOME[role] || '/';

const isSebExamBootstrap = (location) => {
    const searchParams = new URLSearchParams(location.search);
    return location.pathname.startsWith('/student/exams/')
        && searchParams.has('authTransfer')
        && searchParams.has('sebToken');
};

const LoadingAccess = () => (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
        <p className="text-sm font-bold text-slate-600">Checking access...</p>
    </div>
);

export const RequireAuth = ({ allowSebBootstrap = false }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <LoadingAccess />;
    if (allowSebBootstrap && isSebExamBootstrap(location)) return <Outlet />;

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return <Outlet />;
};

export const RequireRole = ({ allowedRoles, allowSebBootstrap = false }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <LoadingAccess />;
    if (allowSebBootstrap && isSebExamBootstrap(location)) return <Outlet />;

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (!allowedRoles.includes(user.role)) {
        return <Navigate to={getRoleHome(user.role)} replace />;
    }

    return <Outlet />;
};
