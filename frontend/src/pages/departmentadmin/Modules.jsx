import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FaPlus, FaEdit, FaTrash, FaLink } from 'react-icons/fa';

const Modules = () => {
    const [modules, setModules] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState(''); // 'create' or 'edit'
    const [selectedModule, setSelectedModule] = useState(null);
    const [formData, setFormData] = useState({ name: '', abbreviation: '', responsable_teacher_id: '' });

    // Assign Group Modal states
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState('');

    const fetchData = async () => {
        try {
            const modRes = await axiosInstance.get('/departmentadmin/modules');
            const teachRes = await axiosInstance.get('/departmentadmin/teachers');
            const groupRes = await axiosInstance.get('/departmentadmin/groups');
            
            setModules(modRes.data);
            setTeachers(teachRes.data);
            setGroups(groupRes.data);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'create') {
                await axiosInstance.post('/departmentadmin/modules', formData);
            } else if (modalMode === 'edit') {
                await axiosInstance.put(`/departmentadmin/modules/${selectedModule.id}`, formData);
            }
            setShowModal(false);
            fetchData();
            setFormData({ name: '', abbreviation: '', responsable_teacher_id: teachers.length > 0 ? teachers[0].id : '' });
        } catch (error) {
            alert(error.response?.data?.message || 'Action failed');
        }
    };

    const deleteModule = async (id) => {
        if (!window.confirm('Are you sure you want to delete this module?')) return;
        try {
            await axiosInstance.delete(`/departmentadmin/modules/${id}`);
            fetchData();
        } catch (error) {
            alert('Failed to delete module');
        }
    };

    const openEditModal = (mod) => {
        setSelectedModule(mod);
        setFormData({ name: mod.name, abbreviation: mod.abbreviation, responsable_teacher_id: mod.responsable_teacher_id });
        setModalMode('edit');
        setShowModal(true);
    };

    const openAssignModal = (mod) => {
        setSelectedModule(mod);
        setSelectedGroupId(groups.length > 0 ? groups[0].id : '');
        setShowAssignModal(true);
    };

    const handleAssignGroupSubmit = async (e) => {
        e.preventDefault();
        try {
            await axiosInstance.post(`/departmentadmin/modules/${selectedModule.id}/groups/${selectedGroupId}`);
            alert('Module assigned to group successfully!');
            setShowAssignModal(false);
        } catch (error) {
            alert(error.response?.data?.message || 'Assignment failed');
        }
    };


    return (
        <div className="space-y-8 animate-fade-in">
            <header className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Manage Modules</h1>
                    <p className="text-slate-500 mt-2 text-lg">Create modules and assign responsible teachers.</p>
                </div>
                <button 
                    onClick={() => { setModalMode('create'); setShowModal(true); setFormData({ name: '', abbreviation: '', responsable_teacher_id: '' }); }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                    <FaPlus /> New Module
                </button>
            </header>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-8 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                            <th className="px-8 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Abbreviation</th>
                            <th className="px-8 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Responsible Teacher</th>
                            <th className="px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {loading ? <tr><td colSpan="4" className="text-center py-8 text-slate-500 font-medium animate-pulse">Loading modules...</td></tr> : 
                          modules.map(m => (
                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 py-5 whitespace-nowrap text-sm font-semibold text-slate-800">{m.name}</td>
                                <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-500"><span className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">{m.abbreviation}</span></td>
                                <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-700 font-medium">
                                    {m.teacher_first_name ? `${m.teacher_first_name} ${m.teacher_last_name}` : <span className="text-slate-400 italic">Unassigned</span>}
                                </td>
                                <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                     <button onClick={() => openAssignModal(m)} className="inline-flex items-center justify-center w-10 h-10 rounded-full text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:scale-110 transition-transform" title="Link to Group"><FaLink /></button>
                                    <button onClick={() => openEditModal(m)} className="inline-flex items-center justify-center w-10 h-10 rounded-full text-blue-600 bg-blue-50 hover:bg-blue-100 hover:scale-110 transition-transform" title="Edit Module"><FaEdit /></button>
                                    <button onClick={() => deleteModule(m.id)} className="inline-flex items-center justify-center w-10 h-10 rounded-full text-red-600 bg-red-50 hover:bg-red-100 hover:scale-110 transition-transform" title="Delete Module"><FaTrash /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal for Create/Edit Module */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-md transform transition-all">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6 text-white line-clamp-1">
                            <h2 className="text-2xl font-bold">{modalMode === 'create' ? 'Create New Module' : 'Edit Module'}</h2>
                        </div>
                        <form onSubmit={handleFormSubmit} className="p-8 space-y-6">
                            <div className="space-y-1">
                                <label className="block text-sm font-semibold text-slate-700 ml-1">Module Name</label>
                                <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder:text-slate-400" placeholder="e.g. Advanced Databases" />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-semibold text-slate-700 ml-1">Abbreviation</label>
                                <input required value={formData.abbreviation} onChange={e=>setFormData({...formData, abbreviation: e.target.value})} className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder:text-slate-400" placeholder="e.g. BDA" />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-semibold text-slate-700 ml-1">Responsible Teacher</label>
                                <select required value={formData.responsable_teacher_id} onChange={e=>setFormData({...formData, responsable_teacher_id: e.target.value})} className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                                    <option value="">-- Select a Teacher --</option>
                                    {teachers.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} {t.lastname} ({t.username})</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">{modalMode === 'create' ? 'Create' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Linking Module to Group */}
            {showAssignModal && (
                 <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-md transform transition-all">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">Link <span className="text-emerald-100">{selectedModule?.abbreviation}</span> to Group</h2>
                            <button onClick={() => setShowAssignModal(false)} className="text-white hover:text-emerald-200 bg-emerald-600/50 hover:bg-emerald-600 rounded-full w-8 h-8 flex items-center justify-center transition-colors">&times;</button>
                        </div>
                        <div className="p-8">
                            <div className="space-y-4">
                                <label className="block text-sm font-bold text-slate-700">Select a Group</label>
                                {groups.length === 0 ? (
                                    <p className="text-sm text-amber-600 p-4 bg-amber-50 rounded-xl border border-amber-200">No groups available in your department.</p>
                                ) : (
                                    <select 
                                        value={selectedGroupId} 
                                        onChange={e => setSelectedGroupId(e.target.value)}
                                        className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                                    >
                                        <option value="">-- Choose a Group --</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name} ({g.year})</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            
                            <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowAssignModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                                <button 
                                    onClick={handleAssignGroupSubmit} 
                                    disabled={!selectedGroupId}
                                    className={`flex-1 py-3 rounded-xl font-bold shadow-md transition-all ${
                                        selectedGroupId 
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:-translate-y-0.5' 
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }`}
                                >
                                    Confirm Link
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Modules;
