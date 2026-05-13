import React from 'react';

const Tooltip = ({ text, children }) => (
    <span className="group relative inline-flex">
        {children}
        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-2xl bg-slate-900 px-3 py-2 text-left text-xs font-medium text-white shadow-xl group-hover:block">
            {text}
        </span>
    </span>
);

export default Tooltip;
