import React from 'react';
import { FiCheckCircle, FiLock } from 'react-icons/fi';

const SebExit = () => (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center p-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-emerald-50 text-emerald-600 shadow-lg">
            <FiCheckCircle className="text-4xl" />
        </div>
        <h1 className="mt-6 text-3xl font-extrabold text-slate-800">Exam submitted</h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600">
            Safe Exam Browser should unlock automatically now. If this page remains visible, wait a moment for SEB to process the secure exit URL.
        </p>
        <div className="mt-8 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500 shadow-sm">
            <FiLock />
            Secure exam session finished
        </div>
    </div>
);

export default SebExit;
