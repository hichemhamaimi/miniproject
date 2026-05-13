import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { FiLogOut, FiUser } from 'react-icons/fi';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <nav className="border-b border-white/70 bg-white/75 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
                <Link to="/" className="flex items-center gap-3 text-slate-900 transition-opacity hover:opacity-90">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black tracking-[0.2em] text-white shadow-lg">
                        EQ
                    </span>
                    <div>
                        <span className="block text-lg font-extrabold tracking-tight">ExamQ</span>
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Assessment platform</span>
                    </div>
                </Link>
                <div className="flex items-center gap-3">
                    {user ? (
                        <>
                            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm sm:flex">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                                    <FiUser />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">{user.username || `User ${user.userId}`}</p>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{user.role.replace('_', ' ')}</p>
                                </div>
                            </div>
                            <button onClick={handleLogout} className="ghost-button !px-4 !py-2.5">
                                <FiLogOut />
                                <span>Logout</span>
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className="action-button !rounded-full !px-6 !py-2.5">
                            Sign In
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
