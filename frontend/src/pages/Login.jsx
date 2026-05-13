import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { getRoleHome } from '../components/auth/RequireAuth';

const Login = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const { login, user } = useAuth();
    const navigate = useNavigate();
    const [serverError, setServerError] = useState('');

    useEffect(() => {
        if (user?.role) {
            navigate(getRoleHome(user.role), { replace: true });
        }
    }, [navigate, user]);

    const onSubmit = async (data) => {
        try {
            setServerError('');
            const response = await axiosInstance.post('/auth/login', data);
            login(response.data);

            const role = response.data.role;
            navigate(getRoleHome(role), { replace: true });
        } catch (error) {
            setServerError(error.response?.data?.message || 'Login failed. Try again.');
        }
    };

    return (
        <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_34px_100px_rgba(15,23,42,0.16)]">
                <div className="relative bg-[linear-gradient(135deg,#0f172a_0%,#123357_55%,#0f766e_100%)] p-8 text-center text-white">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.22),transparent_30%)]"></div>
                    <div className="relative z-10">
                        <div className="mb-4 inline-block rounded-2xl border border-white/20 bg-white/10 p-3 shadow-inner backdrop-blur-sm">
                            <span className="text-2xl font-black tracking-tighter">EQ</span>
                        </div>
                        <h2 className="text-3xl font-extrabold tracking-tight">Welcome Back</h2>
                        <p className="mt-2 text-sm font-medium text-slate-200">Sign in to your ExamQ portal</p>
                    </div>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-7 bg-white/60 p-8">
                    {serverError && (
                        <div className="animate-fade-in rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm" role="alert">
                            <p className="font-medium">Authentication Failed</p>
                            <p>{serverError}</p>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="ml-1 block text-sm font-semibold text-slate-700">Username</label>
                        <div className="relative rounded-xl shadow-sm">
                            <input
                                type="text"
                                className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                                placeholder="Enter your username"
                                {...register('username', { required: 'Username is required' })}
                            />
                        </div>
                        {errors.username && <span className="mt-1 ml-1 flex items-center text-xs font-medium text-red-500"><span className="mr-1">!</span>{errors.username.message}</span>}
                    </div>

                    <div className="space-y-1">
                        <label className="ml-1 block text-sm font-semibold text-slate-700">Password</label>
                        <div className="relative rounded-xl shadow-sm">
                            <input
                                type="password"
                                className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                                placeholder="••••••••"
                                {...register('password', { required: 'Password is required' })}
                            />
                        </div>
                        {errors.password && <span className="mt-1 ml-1 flex items-center text-xs font-medium text-red-500"><span className="mr-1">!</span>{errors.password.message}</span>}
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            className="flex w-full justify-center rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
                        >
                            Sign In to Portal
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
