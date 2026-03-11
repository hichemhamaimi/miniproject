import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';

const Login = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const { login } = useAuth();
    const navigate = useNavigate();
    const [serverError, setServerError] = useState('');

    const onSubmit = async (data) => {
        try {
            setServerError('');
            const response = await axiosInstance.post('/auth/login', data);
            login(response.data);
            
            // Redirect based on role
            const role = response.data.role;
            if (role === 'teacher') {
                navigate('/teacher/dashboard');
            } else if (role === 'superadmin') {
                navigate('/superadmin/dashboard');
            } else if (role === 'department_admin') {
                navigate('/departmentadmin/dashboard');
            } else if (role === 'student') {
                navigate('/student/dashboard');
            } else {
                navigate('/');
            }
        } catch (error) {
            setServerError(error.response?.data?.message || 'Login failed. Try again.');
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full bg-white/80 backdrop-blur-md shadow-2xl rounded-3xl overflow-hidden border border-white/40 transform transition-all hover:shadow-indigo-500/10">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 text-center text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-white opacity-5 pattern-diagonal-lines"></div>
                    <div className="relative z-10">
                        <div className="inline-block bg-white/20 p-3 rounded-2xl backdrop-blur-sm mb-4 border border-white/30 shadow-inner">
                            <span className="text-2xl font-black tracking-tighter">EQ</span>
                        </div>
                        <h2 className="text-3xl font-extrabold tracking-tight">Welcome Back</h2>
                        <p className="text-indigo-100 mt-2 text-sm font-medium">Sign in to your ExamQ portal</p>
                    </div>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-7 bg-white/50">
                    {serverError && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg text-sm shadow-sm animate-fade-in" role="alert">
                            <p className="font-medium">Authentication Failed</p>
                            <p>{serverError}</p>
                        </div>
                    )}
                    
                    <div className="space-y-1">
                        <label className="block text-sm font-semibold text-slate-700 ml-1">Username</label>
                        <div className="relative rounded-xl shadow-sm">
                            <input 
                                type="text" 
                                className="block w-full bg-white border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm placeholder:text-slate-400"
                                placeholder="Enter your username"
                                {...register('username', { required: 'Username is required' })}
                            />
                        </div>
                        {errors.username && <span className="text-red-500 text-xs font-medium ml-1 flex items-center mt-1"><span className="mr-1">⚠</span>{errors.username.message}</span>}
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-semibold text-slate-700 ml-1">Password</label>
                        <div className="relative rounded-xl shadow-sm">
                            <input 
                                type="password" 
                                className="block w-full bg-white border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm placeholder:text-slate-400"
                                placeholder="••••••••"
                                {...register('password', { required: 'Password is required' })}
                            />
                        </div>
                        {errors.password && <span className="text-red-500 text-xs font-medium ml-1 flex items-center mt-1"><span className="mr-1">⚠</span>{errors.password.message}</span>}
                    </div>

                    <div className="pt-2">
                        <button 
                            type="submit" 
                            className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition-all hover:-translate-y-0.5"
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
