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
        <div className="text-center py-20 text-gray-500 text-xl">
            Welcome to ExamQ. Please login.
        </div>
    );
};

export default Home;
