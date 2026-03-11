import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const Dashboard = () => {
    const { user } = useAuth();

    if (user?.role !== 'teacher') {
        return <div className="p-8 text-center text-red-500 text-xl font-semibold">Access Denied. For teachers only.</div>;
    }

    return (
        <div className="space-y-8">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                   <h1 className="text-2xl font-bold text-gray-800">Teacher Dashboard</h1>
                   <p className="text-gray-500 mt-1">Manage your exams and student activity</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl">
                   {user.userId}
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
                    <h3 className="text-lg font-semibold text-gray-800">Create Exam</h3>
                    <p className="text-gray-500 text-sm mt-2 mb-4">Build and configure a new exam with multiple questions.</p>
                    <Link to="/teacher/create-exam" className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Get Started &rarr;</Link>
                </div>
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
                    <h3 className="text-lg font-semibold text-gray-800">My Modules</h3>
                    <p className="text-gray-500 text-sm mt-2 mb-4">View enrolled students and exam history for your modules.</p>
                    <Link to="/teacher/modules" className="inline-block bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition">View Modules &rarr;</Link>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 opacity-70">
                    <h3 className="text-lg font-semibold text-gray-800">Student Results</h3>
                    <p className="text-gray-500 text-sm mt-2 mb-4">Analyze scores and performance. (Coming soon)</p>
                    <button disabled className="bg-gray-200 text-gray-500 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed">Analytics</button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
