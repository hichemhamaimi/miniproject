import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { FaUsers, FaBuilding } from 'react-icons/fa';

const Dashboard = () => {
    const { user } = useAuth();

    if (user?.role !== 'superadmin') {
        return <div className="p-8 text-center text-red-500 font-semibold">Access Denied</div>;
    }

    return (
        <div className="space-y-6">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                   <h1 className="text-2xl font-bold text-gray-800">Super Admin Dashboard</h1>
                   <p className="text-gray-500 mt-1">Manage global system settings, departments, and users.</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl uppercase">
                   {user.userId}
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
                    <div className="text-indigo-600 mb-4 text-3xl"><FaUsers /></div>
                    <h3 className="text-lg font-semibold text-gray-800">Manage Users</h3>
                    <p className="text-gray-500 text-sm mt-2 mb-4">Create accounts across all roles, change passwords, and manage platform access.</p>
                    <Link to="/superadmin/users" className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Go to Users &rarr;</Link>
                </div>
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
                    <div className="text-pink-600 mb-4 text-3xl"><FaBuilding /></div>
                    <h3 className="text-lg font-semibold text-gray-800">Manage Departments</h3>
                    <p className="text-gray-500 text-sm mt-2 mb-4">Create departments and assign department administrators.</p>
                    <Link to="/superadmin/departments" className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Go to Departments &rarr;</Link>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
