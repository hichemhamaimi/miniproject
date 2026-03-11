import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 shadow-lg border-b border-indigo-500/30 sticky top-0 z-40 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center text-white">
                <Link to="/" className="text-2xl font-extrabold tracking-tight flex items-center gap-2 hover:opacity-90 transition-opacity">
                    <span className="bg-white text-indigo-700 px-2 py-1 rounded-lg text-sm shadow-sm">EQ</span>
                    ExamQ
                </Link>
                <div className="flex gap-4 items-center">
                    {user ? (
                        <div className="flex items-center gap-4 bg-white/10 px-4 py-1.5 rounded-full border border-white/20 shadow-inner">
                           <span className="text-xs font-bold tracking-wider text-indigo-100 uppercase">{user.role.replace('_', ' ')}</span>
                           <div className="w-px h-4 bg-white/30"></div>
                           <button onClick={handleLogout} className="text-sm font-medium hover:text-red-300 transition-colors">Logout</button>
                        </div>
                    ) : (
                        <Link to="/login" className="text-sm font-semibold bg-white text-indigo-700 px-5 py-2 rounded-full shadow hover:bg-indigo-50 hover:shadow-md transition-all transform hover:-translate-y-0.5">
                            Sign In
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
