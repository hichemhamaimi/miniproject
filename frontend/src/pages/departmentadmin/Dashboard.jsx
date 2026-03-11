import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const Dashboard = () => {
    const { user } = useAuth();

    if (user?.role !== 'department_admin') {
        return <div className="p-8 text-center text-red-500 font-semibold">Access Denied</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <header className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Department Admin Dashboard</h1>
                <p className="text-slate-500 mt-2 text-lg">Manage department modules, groups, and academic structure.</p>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Link to="/departmentadmin/groups" className="group block h-full">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
                        </div>
                        <div className="relative z-10">
                            <h2 className="text-2xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">Manage Groups</h2>
                            <p className="text-slate-500 mt-3 leading-relaxed">Create, edit, and organize student groups within your department.</p>
                        </div>
                        <div className="mt-8 text-indigo-600 font-semibold flex items-center group-hover:translate-x-2 transition-transform">
                            View Groups <span className="ml-2">&rarr;</span>
                        </div>
                    </div>
                </Link>

                <Link to="/departmentadmin/modules" className="group block h-full">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"></path></svg>
                        </div>
                        <div className="relative z-10">
                            <h2 className="text-2xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">Manage Modules</h2>
                            <p className="text-slate-500 mt-3 leading-relaxed">Create modules, assign responsible teachers, and link them to groups.</p>
                        </div>
                        <div className="mt-8 text-indigo-600 font-semibold flex items-center group-hover:translate-x-2 transition-transform">
                            View Modules <span className="ml-2">&rarr;</span>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
};

export default Dashboard;
