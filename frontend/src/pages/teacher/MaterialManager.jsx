import React, { useCallback, useEffect, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiClock, FiCpu, FiFile, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';

const STATUS_STYLES = {
    ready: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    parsing: 'bg-amber-100 text-amber-700 border-amber-200',
    uploading: 'bg-blue-100 text-blue-700 border-blue-200',
    embedding: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    generating_mindmap: 'bg-violet-100 text-violet-700 border-violet-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
    error: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_ICONS = {
    ready: <FiCheckCircle className="inline mr-1" />,
    parsing: <FiClock className="inline mr-1 animate-spin" />,
    uploading: <FiClock className="inline mr-1 animate-spin" />,
    embedding: <FiCpu className="inline mr-1 animate-pulse" />,
    generating_mindmap: <FiCpu className="inline mr-1 animate-pulse" />,
    failed: <FiAlertCircle className="inline mr-1" />,
    error: <FiAlertCircle className="inline mr-1" />,
};

const NON_DELETABLE_STATUSES = new Set(['uploading', 'parsing', 'embedding', 'generating_mindmap']);

const formatStatus = (status) => {
    if (status === 'generating_mindmap') return 'mind map generation';
    return String(status || 'unknown').replace(/_/g, ' ');
};

const MaterialManager = () => {
    const navigate = useNavigate();
    const [materials, setMaterials] = useState([]);
    const [modules, setModules] = useState([]);
    const [selectedModuleId, setSelectedModuleId] = useState('');
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState('');
    const [title, setTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);

    const fetchMaterials = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/teacher/materials', {
                params: selectedModuleId ? { moduleId: selectedModuleId } : {},
            });
            setMaterials(response.data);
        } catch {
            setStatusMsg({ type: 'error', text: 'Failed to load materials.' });
        }
    }, [selectedModuleId]);

    useEffect(() => {
        axiosInstance.get('/teacher/modules')
            .then((response) => {
                setModules(response.data);
                if (response.data.length > 0 && !selectedModuleId) {
                    setSelectedModuleId(String(response.data[0].id));
                }
            })
            .catch(() => setStatusMsg({ type: 'error', text: 'Failed to load modules.' }));
    }, [selectedModuleId]);

    useEffect(() => {
        fetchMaterials();
        const interval = window.setInterval(fetchMaterials, 5000);
        return () => window.clearInterval(interval);
    }, [fetchMaterials]);

    const handleDrop = (event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files[0]) {
            setSelectedFile(event.dataTransfer.files[0]);
        }
    };

    const handleUpload = async (event) => {
        event.preventDefault();
        if (!selectedFile) {
            setStatusMsg({ type: 'error', text: 'Please select a file.' });
            return;
        }

        setUploading(true);
        setStatusMsg(null);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('title', title || selectedFile.name);
            formData.append('module_id', selectedModuleId);

            await axiosInstance.post('/teacher/materials/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setStatusMsg({ type: 'success', text: 'Uploaded successfully. Parsing is now in progress.' });
            setSelectedFile(null);
            setTitle('');
            fetchMaterials();
        } catch (error) {
            setStatusMsg({ type: 'error', text: error.response?.data?.message || 'Upload failed.' });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (material) => {
        const confirmed = window.confirm(
            `Delete "${material.title}"?\n\nThis removes the uploaded file, its parsed content, mind map, and stored embeddings.`
        );
        if (!confirmed) return;

        setDeletingId(material._id);
        setStatusMsg(null);

        try {
            await axiosInstance.delete(`/teacher/materials/${material._id}`);
            setMaterials((current) => current.filter((entry) => entry._id !== material._id));
            setStatusMsg({ type: 'success', text: 'Material deleted successfully.' });
        } catch (error) {
            setStatusMsg({ type: 'error', text: error.response?.data?.message || 'Delete failed.' });
        } finally {
            setDeletingId('');
        }
    };

    const handleMindmap = (materialId) => {
        navigate(`/teacher/materials/${materialId}/mindmap`);
    };

    return (
        <div className="mx-auto max-w-5xl space-y-8 pb-16">
            <header className="page-hero">
                <h1 className="page-title flex items-center gap-3">
                    <FiUploadCloud className="text-4xl opacity-80" />
                    Material Manager
                </h1>
                <p className="page-subtitle">Upload study materials, monitor parsing progress, open generated mind maps, and safely remove materials you no longer need.</p>
            </header>

            <div className="surface-card p-8">
                <h2 className="text-lg font-bold text-slate-800">Upload New Material</h2>
                <form onSubmit={handleUpload} className="mt-6 space-y-5">
                    <div>
                        <label className="label-text">Module</label>
                        <select
                            className="select-field"
                            value={selectedModuleId}
                            onChange={(event) => setSelectedModuleId(event.target.value)}
                        >
                            <option value="">Select a module</option>
                            {modules.map((module) => (
                                <option key={module.id} value={module.id}>{module.abbreviation} - {module.name}</option>
                            ))}
                        </select>
                    </div>

                    <div
                        className={`rounded-[24px] border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
                            dragging ? 'border-cyan-500 bg-cyan-50' : 'border-slate-300 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50'
                        }`}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('material-file-input').click()}
                    >
                        <FiUploadCloud className="mx-auto mb-3 text-5xl text-cyan-400" />
                        {selectedFile ? (
                            <p className="font-semibold text-cyan-700">{selectedFile.name}</p>
                        ) : (
                            <>
                                <p className="font-semibold text-slate-600">Drag and drop or click to select</p>
                                <p className="mt-1 text-xs text-slate-400">PDF, DOCX, PPTX, TXT, Markdown - max 50 MB</p>
                            </>
                        )}
                        <input
                            id="material-file-input"
                            type="file"
                            className="hidden"
                            accept=".pdf,.docx,.pptx,.txt,.md"
                            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        />
                    </div>

                    <div>
                        <label className="label-text">Title (optional)</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Chapter 3 - Sorting Algorithms"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </div>

                    {statusMsg ? (
                        <div className={`rounded-2xl p-3 text-sm font-semibold ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {statusMsg.text}
                        </div>
                    ) : null}

                    <button
                        type="submit"
                        disabled={uploading || !selectedFile || !selectedModuleId}
                        className="action-button w-full"
                    >
                        {uploading ? 'Uploading...' : 'Upload material'}
                    </button>
                </form>
            </div>

            <div className="surface-card p-8">
                <h2 className="text-lg font-bold text-slate-800">My Materials ({materials.length})</h2>
                {materials.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <FiFile className="mx-auto mb-3 text-5xl opacity-40" />
                        <p>No materials yet. Upload your first file above.</p>
                    </div>
                ) : (
                    <div className="mt-6 space-y-3">
                        {materials.map((material) => {
                            const deletionBlocked = NON_DELETABLE_STATUSES.has(material.status);
                            return (
                            <div key={material._id} className="flex items-center justify-between rounded-[24px] border border-slate-100 bg-slate-50 p-4 transition-all hover:border-cyan-200 hover:bg-cyan-50">
                                <div className="flex min-w-0 items-center gap-4">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-xs font-bold uppercase text-cyan-700">
                                        {material.fileType}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-slate-800">{material.title}</p>
                                        <p className="mt-0.5 text-xs text-slate-400">
                                            {new Date(material.uploadDate).toLocaleDateString()} | {material.statusMessage || formatStatus(material.status)}
                                        </p>
                                    </div>
                                </div>

                                <div className="ml-4 flex flex-shrink-0 items-center gap-3">
                                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[material.status] || ''}`}>
                                        {STATUS_ICONS[material.status]}
                                        {formatStatus(material.status)}
                                    </span>
                                    {material.status === 'ready' ? (
                                        <button
                                            type="button"
                                            onClick={() => handleMindmap(material._id)}
                                            className="secondary-button !rounded-xl !px-3 !py-2 !text-xs"
                                        >
                                            <FiCpu />
                                            <span>Mindmap</span>
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(material)}
                                        disabled={deletingId === material._id || deletionBlocked}
                                        className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        title={deletionBlocked ? 'Material cannot be deleted while processing.' : 'Delete material'}
                                    >
                                        <FiTrash2 />
                                    </button>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaterialManager;
