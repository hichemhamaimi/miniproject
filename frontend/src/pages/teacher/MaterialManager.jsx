import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FiUploadCloud, FiFile, FiTrash2, FiCpu, FiCheckCircle, FiAlertCircle, FiClock } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const STATUS_STYLES = {
    ready: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    parsing: 'bg-amber-100 text-amber-700 border-amber-200',
    uploading: 'bg-blue-100 text-blue-700 border-blue-200',
    error: 'bg-red-100 text-red-700 border-red-200',
};
const STATUS_ICONS = {
    ready: <FiCheckCircle className="inline mr-1" />,
    parsing: <FiClock className="inline mr-1 animate-spin" />,
    uploading: <FiClock className="inline mr-1 animate-spin" />,
    error: <FiAlertCircle className="inline mr-1" />,
};

const MaterialManager = () => {
    const navigate = useNavigate();
    const [materials, setMaterials] = useState([]);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [title, setTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);

    const fetchMaterials = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/teacher/materials');
            setMaterials(res.data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchMaterials();
        // Poll for status changes while any material is parsing
        const interval = setInterval(() => { fetchMaterials(); }, 5000);
        return () => clearInterval(interval);
    }, [fetchMaterials]);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) setSelectedFile(e.dataTransfer.files[0]);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) return setStatusMsg({ type: 'error', text: 'Please select a file.' });
        setUploading(true);
        setStatusMsg(null);
        try {
            const fd = new FormData();
            fd.append('file', selectedFile);
            fd.append('title', title || selectedFile.name);
            await axiosInstance.post('/teacher/materials/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setStatusMsg({ type: 'success', text: 'Uploaded! Parsing in progress…' });
            setSelectedFile(null);
            setTitle('');
            fetchMaterials();
        } catch (err) {
            setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Upload failed.' });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this material?')) return;
        try {
            await axiosInstance.delete(`/teacher/materials/${id}`);
            setMaterials(m => m.filter(x => x._id !== id));
        } catch { setStatusMsg({ type: 'error', text: 'Delete failed.' }); }
    };

    const handleMindmap = (id) => {
        navigate(`/teacher/materials/${id}/mindmap`);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-16">
            {/* Header */}
            <header className="bg-gradient-to-r from-violet-700 to-indigo-700 p-8 rounded-3xl shadow-xl text-white">
                <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                    <FiUploadCloud className="text-4xl opacity-80" /> Material Manager
                </h1>
                <p className="mt-2 text-indigo-200">Upload study materials to power AI exam generation.</p>
            </header>

            {/* Upload Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                <h2 className="text-lg font-bold text-slate-800 mb-6">Upload New Material</h2>
                <form onSubmit={handleUpload} className="space-y-5">
                    <div
                        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
                            ${dragging ? 'border-violet-500 bg-violet-50' : 'border-slate-300 bg-slate-50 hover:border-violet-400 hover:bg-violet-50'}`}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('fileInput').click()}
                    >
                        <FiUploadCloud className="text-5xl text-violet-400 mx-auto mb-3" />
                        {selectedFile ? (
                            <p className="font-semibold text-violet-700">{selectedFile.name}</p>
                        ) : (
                            <>
                                <p className="font-semibold text-slate-600">Drag & drop or click to select</p>
                                <p className="text-xs text-slate-400 mt-1">PDF, DOCX, PPTX, TXT, Markdown — max 50 MB</p>
                            </>
                        )}
                        <input
                            id="fileInput"
                            type="file"
                            className="hidden"
                            accept=".pdf,.docx,.pptx,.txt,.md"
                            onChange={(e) => setSelectedFile(e.target.files[0])}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Title (optional)</label>
                        <input
                            type="text"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                            placeholder="e.g. Chapter 3 — Sorting Algorithms"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    {statusMsg && (
                        <div className={`p-3 rounded-xl text-sm font-semibold ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {statusMsg.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={uploading || !selectedFile}
                        className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
                    >
                        {uploading ? 'Uploading…' : 'Upload Material'}
                    </button>
                </form>
            </div>

            {/* Materials List */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                <h2 className="text-lg font-bold text-slate-800 mb-6">My Materials ({materials.length})</h2>
                {materials.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <FiFile className="text-5xl mx-auto mb-3 opacity-40" />
                        <p>No materials yet. Upload your first file above.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {materials.map(mat => (
                            <div key={mat._id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-violet-200 hover:bg-violet-50 transition-all group">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                                        {mat.fileType}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-800 truncate">{mat.title}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{new Date(mat.uploadDate).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                    <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${STATUS_STYLES[mat.status] || ''}`}>
                                        {STATUS_ICONS[mat.status]}{mat.status}
                                    </span>
                                    {mat.status === 'ready' && (
                                        <button
                                            onClick={() => handleMindmap(mat._id)}
                                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition"
                                        >
                                            <FiCpu /> Mindmap
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(mat._id)}
                                        className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition"
                                    >
                                        <FiTrash2 />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaterialManager;
