import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Home = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return; // Do nothing if there's no user, let the component render its standard view.
        
        const role = user.role;
        if (role === 'teacher') {
            navigate('/teacher/dashboard');
        } else if (role === 'superadmin') {
            navigate('/superadmin/dashboard');
        } else if (role === 'department_admin') {
            navigate('/departmentadmin/dashboard');
        } else if (role === 'student') {
            navigate('/student/dashboard');
        }
    }, [user, navigate]);

    if (user) {
        return null; // Return nothing while redirecting
    }

    return (
        <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-16 md:py-24">
            <div className="page-hero w-full text-center">
                <p className="eyebrow">QCM Management Platform</p>
                <h1 className="page-title">Professional exam generation for teachers, students, and administrators</h1>
                <p className="page-subtitle mx-auto">
                    Securely create assessments, manage academic structure, publish exam sessions, and review results in one streamlined workspace.
                </p>
            </div>
        </div>
    );
};

export default Home;
