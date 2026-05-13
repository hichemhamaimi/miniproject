import React from 'react';

const Footer = () => {
    return (
        <footer className="mt-10 border-t border-white/70 bg-white/60 py-6 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-center text-sm text-slate-500 md:flex-row md:px-8 md:text-left">
                <p>&copy; {new Date().getFullYear()} ExamQ Platform</p>
                <p className="font-medium text-slate-400">Professional exam generation and management workspace</p>
            </div>
        </footer>
    );
};

export default Footer;
