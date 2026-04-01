import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { FiRefreshCw, FiMapPin, FiArrowRight, FiChevronDown, FiChevronRight } from 'react-icons/fi';

// ─── Recursive tree node component ───────────────────────────────────────────
const ConceptNode = ({ node, depth = 0, selected, onToggle }) => {
    const [open, setOpen] = useState(depth < 2);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selected.has(node.name);

    return (
        <div className={`ml-${depth > 0 ? 5 : 0}`} style={{ marginLeft: depth > 0 ? `${depth * 20}px` : 0 }}>
            <div
                className={`flex items-center gap-2 py-1.5 px-3 rounded-xl cursor-pointer transition-all group
                    ${isSelected ? 'bg-violet-100 border border-violet-300' : 'hover:bg-slate-100'}`}
            >
                {hasChildren ? (
                    <button onClick={() => setOpen(o => !o)} className="text-slate-400 hover:text-violet-600 transition w-5 flex-shrink-0">
                        {open ? <FiChevronDown /> : <FiChevronRight />}
                    </button>
                ) : (
                    <span className="w-5 flex-shrink-0 text-center text-slate-300">•</span>
                )}
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onToggle(node, e.target.checked)}
                    className="w-4 h-4 rounded accent-violet-600 cursor-pointer flex-shrink-0"
                />
                <span className={`text-sm font-medium select-none ${isSelected ? 'text-violet-800 font-semibold' : 'text-slate-700'}`}>
                    {node.name}
                </span>
            </div>
            {hasChildren && open && (
                <div>
                    {node.children.map((child, i) => (
                        <ConceptNode key={i} node={child} depth={depth + 1} selected={selected} onToggle={onToggle} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Main Page ─────────────────────────────────────────────────────────────
const MindmapViewer = () => {
    const { materialId } = useParams();
    const navigate = useNavigate();
    const [mindmap, setMindmap] = useState(null);
    const [material, setMaterial] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const [matRes, mmRes] = await Promise.allSettled([
                axiosInstance.get(`/teacher/materials/${materialId}`),
                axiosInstance.get(`/teacher/materials/${materialId}/mindmap`)
            ]);
            if (matRes.status === 'fulfilled') setMaterial(matRes.value.data);
            if (mmRes.status === 'fulfilled') setMindmap(mmRes.value.data);
        } finally {
            setLoading(false);
        }
    }, [materialId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleToggle = (node, isSelected) => {
        setSelected(prev => {
            const next = new Set(prev);
            const collect = (n) => {
                if (isSelected) next.add(n.name);
                else next.delete(n.name);
                if (n.children) n.children.forEach(collect);
            };
            collect(node);
            return next;
        });
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setError('');
        try {
            const res = await axiosInstance.post(`/teacher/materials/${materialId}/mindmap`);
            setMindmap(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate mindmap.');
        } finally {
            setGenerating(false);
        }
    };

    const handleBuildBlueprint = () => {
        navigate('/teacher/blueprint-builder', {
            state: {
                materialId,
                materialTitle: material?.title,
                selectedConcepts: [...selected]
            }
        });
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full"></div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-16">
            <header className="bg-gradient-to-r from-indigo-700 to-violet-700 p-8 rounded-3xl shadow-xl text-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold flex items-center gap-3">
                            <FiMapPin className="opacity-80" /> Concept Mindmap
                        </h1>
                        <p className="text-indigo-200 mt-1">{material?.title || 'Loading…'}</p>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-xl font-bold transition disabled:opacity-50"
                    >
                        <FiRefreshCw className={generating ? 'animate-spin' : ''} />
                        {generating ? 'Generating…' : mindmap ? 'Regenerate' : 'Generate Mindmap'}
                    </button>
                </div>
            </header>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm font-semibold">{error}</div>
            )}

            {!mindmap ? (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-16 text-center text-slate-400">
                    <FiMapPin className="text-6xl mx-auto mb-4 opacity-30" />
                    <p className="font-semibold">No mindmap yet.</p>
                    <p className="text-sm mt-1">Click "Generate Mindmap" to extract concepts from this material using AI.</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{mindmap.title}</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                {selected.size} concept{selected.size !== 1 ? 's' : ''} selected
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    const all = new Set();
                                    const collect = (nodes) => nodes.forEach(n => { all.add(n.name); if (n.children) collect(n.children); });
                                    collect(mindmap.concepts);
                                    setSelected(all);
                                }}
                                className="text-xs bg-slate-100 hover:bg-violet-100 text-slate-700 hover:text-violet-700 px-3 py-2 rounded-lg font-bold transition"
                            >
                                Select All
                            </button>
                            <button
                                onClick={() => setSelected(new Set())}
                                className="text-xs bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 px-3 py-2 rounded-lg font-bold transition"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-2">
                        {mindmap.concepts.map((node, i) => (
                            <ConceptNode key={i} node={node} depth={0} selected={selected} onToggle={handleToggle} />
                        ))}
                    </div>

                    {selected.size > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={handleBuildBlueprint}
                                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                Build Blueprint with {selected.size} Concepts <FiArrowRight />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MindmapViewer;
