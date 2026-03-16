import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const Card = ({ title, desc, to, label, variant = 'primary' }) => {
    const styles = {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
        secondary: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100',
        violet: 'bg-violet-600 text-white hover:bg-violet-700',
        amber: 'bg-amber-500 text-white hover:bg-amber-600',
        emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
        disabled: 'bg-gray-200 text-gray-500 cursor-not-allowed'
    };
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition flex flex-col justify-between gap-4">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
                <p className="text-gray-500 text-sm mt-2">{desc}</p>
            </div>
            {to ? (
                <Link to={to} className={`inline-block px-4 py-2 rounded-lg text-sm font-medium transition ${styles[variant]}`}>
                    {label} &rarr;
                </Link>
            ) : (
                <button disabled className={`px-4 py-2 rounded-lg text-sm font-medium ${styles['disabled']}`}>{label}</button>
            )}
        </div>
    );
};

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
                    <p className="text-gray-500 mt-1">Manage your exams, materials, and student activity</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl">
                    {user.userId}
                </div>
            </header>

            {/* Classic Exam Tools */}
            <section>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">Classic Exam Tools</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card title="Create Exam" desc="Build a new exam manually with full control over question types and scoring." to="/teacher/create-exam" label="Get Started" variant="primary" />
                    <Card title="My Modules" desc="View enrolled students and exam history for your modules." to="/teacher/modules" label="View Modules" variant="secondary" />
                    <Card title="Student Results" desc="Analyze scores and performance. (Coming soon)" label="Analytics" variant="disabled" />
                </div>
            </section>

            {/* AI Exam Workflow */}
            <section>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">✨ AI-Powered Exam Generation</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card
                        title="Material Manager"
                        desc="Upload PDFs, DOCX, PPTX, or text files. The AI will parse and extract concepts."
                        to="/teacher/materials"
                        label="Upload Materials"
                        variant="violet"
                    />
                    <Card
                        title="Blueprint Builder"
                        desc="Configure exam structure, question types, difficulty distribution, and scoring."
                        to="/teacher/blueprint-builder"
                        label="Build Blueprint"
                        variant="amber"
                    />
                    <Card
                        title="AI-Generated Exams"
                        desc="Review, edit, and publish all your AI-generated exam drafts."
                        to="/teacher/published-exams"
                        label="View Exams"
                        variant="emerald"
                    />
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
