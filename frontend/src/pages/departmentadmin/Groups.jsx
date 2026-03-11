import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FaPlus, FaEdit, FaTrash, FaEye, FaUnlink, FaUserPlus } from 'react-icons/fa';

const Groups = () => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState(''); // 'create' or 'edit'
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [formData, setFormData] = useState({ name: '', abbreviation: '', year: '1st' });

    // Inspect Modal states
    const [showInspectModal, setShowInspectModal] = useState(false);
    const [groupModules, setGroupModules] = useState([]);
    const [loadingModules, setLoadingModules] = useState(false);

    // Assign Student states
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [allStudents, setAllStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState('');

    const fetchData = async () => {
        try {
            const res = await axiosInstance.get('/departmentadmin/groups');
            setGroups(res.data);
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
                await axiosInstance.post('/departmentadmin/groups', formData);
            } else if (modalMode === 'edit') {
                await axiosInstance.put(`/departmentadmin/groups/${selectedGroup.id}`, formData);
            }
            setShowModal(false);
            fetchData();
            setFormData({ name: '', abbreviation: '', year: '1st' });
        } catch (error) {
            alert(error.response?.data?.message || 'Action failed');
        }
    };

    const deleteGroup = async (id) => {
        if (!window.confirm('Are you sure you want to delete this group?')) return;
        try {
            await axiosInstance.delete(`/departmentadmin/groups/${id}`);
            fetchData();
        } catch (error) {
            alert('Failed to delete group');
        }
    };

    const openEditModal = (group) => {
        setSelectedGroup(group);
        setFormData({ name: group.name, abbreviation: group.abbreviation, year: group.year });
        setModalMode('edit');
        setShowModal(true);
    };

    const openInspectModal = async (group) => {
        setSelectedGroup(group);
        setShowInspectModal(true);
        setLoadingModules(true);
        try {
            const res = await axiosInstance.get(`/departmentadmin/groups/${group.id}/modules`);
            setGroupModules(res.data);
        } catch (error) {
            alert('Failed to fetch modules for this group');
        } finally {
            setLoadingModules(false);
        }
    };

    const removeModule = async (moduleId) => {
        if (!window.confirm('Are you sure you want to remove this module from the group?')) return;
        try {
            await axiosInstance.delete(`/departmentadmin/groups/${selectedGroup.id}/modules/${moduleId}`);
            setGroupModules(prev => prev.filter(m => m.id !== moduleId));
        } catch (error) {
            alert('Failed to remove module from group');
        }
    };

    const openAssignModal = async (group) => {
        setSelectedGroup(group);
        setShowAssignModal(true);
        if (allStudents.length === 0) {
            setLoadingStudents(true);
            try {
                const res = await axiosInstance.get('/departmentadmin/groups/all-students');
                setAllStudents(res.data);
            } catch (error) {
                alert('Failed to fetch students');
            } finally {
                setLoadingStudents(false);
            }
        }
    };

    const handleAssignStudent = async (e) => {
        e.preventDefault();
        if (!selectedStudentId) return alert('Please select a student');
        try {
            await axiosInstance.post(`/departmentadmin/groups/${selectedGroup.id}/students/${selectedStudentId}`);
            alert('Student assigned successfully');
            setShowAssignModal(false);
            setSelectedStudentId('');
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to assign student');
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <header className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Manage Groups</h1>
                    <p className="text-slate-500 mt-2 text-lg">Create and manage student groups for your department.</p>
                </div>
                <button 
                    onClick={() => { setModalMode('create'); setShowModal(true); setFormData({ name: '', abbreviation: '', year: '1st' }); }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                    <FaPlus /> New Group
                </button>
            </header>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-8 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                            <th className="px-8 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Abbreviation</th>
                            <th className="px-8 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Year</th>
                            <th className="px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {loading ? <tr><td colSpan="4" className="text-center py-8 text-slate-500 font-medium animate-pulse">Loading groups...</td></tr> : 
                          groups.map(g => (
                            <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 py-5 whitespace-nowrap text-sm font-semibold text-slate-800">{g.name}</td>
                                <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-500"><span className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">{g.abbreviation}</span></td>
                                <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-indigo-600">{g.year}</td>
                                <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button onClick={() => openInspectModal(g)} className="inline-flex items-center justify-center w-10 h-10 rounded-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:scale-110 transition-transform" title="Inspect Modules"><FaEye /></button>
                                    <button onClick={() => openAssignModal(g)} className="inline-flex items-center justify-center w-10 h-10 rounded-full text-green-600 bg-green-50 hover:bg-green-100 hover:scale-110 transition-transform" title="Assign Student"><FaUserPlus /></button>
                                    <button onClick={() => openEditModal(g)} className="inline-flex items-center justify-center w-10 h-10 rounded-full text-blue-600 bg-blue-50 hover:bg-blue-100 hover:scale-110 transition-transform" title="Edit Group"><FaEdit /></button>
                                    <button onClick={() => deleteGroup(g.id)} className="inline-flex items-center justify-center w-10 h-10 rounded-full text-red-600 bg-red-50 hover:bg-red-100 hover:scale-110 transition-transform" title="Delete Group"><FaTrash /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-md transform transition-all">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6 text-white line-clamp-1">
                            <h2 className="text-2xl font-bold">{modalMode === 'create' ? 'Create New Group' : 'Edit Group'}</h2>
                        </div>
                        <form onSubmit={handleFormSubmit} className="p-8 space-y-6">
                            <div className="space-y-1">
                                <label className="block text-sm font-semibold text-slate-700 ml-1">Group Name</label>
                                <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder:text-slate-400" placeholder="e.g. Software Engineering 1" />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-semibold text-slate-700 ml-1">Abbreviation</label>
                                <input required value={formData.abbreviation} onChange={e=>setFormData({...formData, abbreviation: e.target.value})} className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder:text-slate-400" placeholder="e.g. GL1" />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-semibold text-slate-700 ml-1">Year</label>
                                <select required value={formData.year} onChange={e=>setFormData({...formData, year: e.target.value})} className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                                    <option value="1st">1st Year</option>
                                    <option value="2nd">2nd Year</option>
                                    <option value="3rd">3rd Year</option>
                                </select>
                            </div>
                            
                            <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">{modalMode === 'create' ? 'Create Group' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Inspect Modules Modal */}
            {showInspectModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-2xl transform transition-all">
                        <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Modules for <span className="text-indigo-600">{selectedGroup?.name}</span></h2>
                            <button onClick={() => setShowInspectModal(false)} className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors">&times;</button>
                        </div>
                        
                        <div className="p-8 max-h-[60vh] overflow-y-auto bg-slate-50/50">
                            {loadingModules ? (
                                <div className="flex justify-center items-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : groupModules.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                                    <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                    <h3 className="mt-2 text-sm font-semibold text-slate-900">No modules</h3>
                                    <p className="mt-1 text-sm text-slate-500">This group has no modules assigned yet.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {groupModules.map(mod => (
                                        <li key={mod.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                                                    {mod.abbreviation.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{mod.name}</p>
                                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{mod.abbreviation}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => removeModule(mod.id)}
                                                className="text-red-500 hover:text-rose-600 flex items-center gap-2 text-sm font-bold bg-white border border-red-200 px-4 py-2 rounded-xl group-hover:bg-red-50 transition-colors shadow-sm"
                                                title="Remove module from group"
                                            >
                                                <FaUnlink className="text-red-400" /> Unassign
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="bg-white px-8 py-5 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setShowInspectModal(false)} className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-colors">Close Viewer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Student Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-md transform transition-all">
                        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white line-clamp-1">
                            <h2 className="text-2xl font-bold">Assign Student to {selectedGroup?.name}</h2>
                        </div>
                        <form onSubmit={handleAssignStudent} className="p-8 space-y-6">
                            <div className="space-y-1">
                                <label className="block text-sm font-semibold text-slate-700 ml-1">Select Student</label>
                                {loadingStudents ? (
                                    <div className="py-2 text-sm text-slate-500">Loading students...</div>
                                ) : (
                                    <select 
                                        required 
                                        value={selectedStudentId} 
                                        onChange={e => setSelectedStudentId(e.target.value)} 
                                        className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                                    >
                                        <option value="" disabled>Select a student</option>
                                        {allStudents.map(student => (
                                            <option key={student.id} value={student.id}>
                                                {student.lastname} {student.name} (@{student.username})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            
                            <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowAssignModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                                <button type="submit" disabled={loadingStudents} className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">Assign</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Groups;
