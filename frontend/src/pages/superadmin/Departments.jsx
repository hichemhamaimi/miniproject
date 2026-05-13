import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FiEdit2, FiLayers, FiPlus, FiTrash2 } from 'react-icons/fi';

const Departments = () => {
    const [departments, setDepartments] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('');
    const [selectedDept, setSelectedDept] = useState(null);
    const [formData, setFormData] = useState({ name: '', abbreviation: '', department_admin_id: '' });

    const fetchData = async () => {
        try {
            const depRes = await axiosInstance.get('/superadmin/departments');
            const usersRes = await axiosInstance.get('/superadmin/users');
            setDepartments(depRes.data);
            setAdmins(usersRes.data.filter((u) => u.role === 'department_admin'));
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
                await axiosInstance.post('/superadmin/departments', formData);
            } else if (modalMode === 'edit') {
                await axiosInstance.put(`/superadmin/departments/${selectedDept.id}`, formData);
            }
            setShowModal(false);
            fetchData();
            setFormData({ name: '', abbreviation: '', department_admin_id: '' });
        } catch (error) {
            alert(error.response?.data?.message || 'Action failed');
        }
    };

    const deleteDept = async (id) => {
        if (!window.confirm('Are you sure you want to delete this department?')) return;
        try {
            await axiosInstance.delete(`/superadmin/departments/${id}`);
            fetchData();
        } catch (error) {
            alert('Failed to delete department');
        }
    };

    const openEditModal = (dept) => {
        setSelectedDept(dept);
        setFormData({ name: dept.name, abbreviation: dept.abbreviation, department_admin_id: dept.department_admin_id });
        setModalMode('edit');
        setShowModal(true);
    };

    return (
        <div className="space-y-8">
            <header className="page-hero">
                <p className="eyebrow">Department Administration</p>
                <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="page-title">Structure departments and assign responsible administrators with more confidence</h1>
                        <p className="page-subtitle">The interface is cleaner, but all department creation, update, deletion, and assignment behavior remains unchanged.</p>
                    </div>
                    <button
                        onClick={() => { setModalMode('create'); setShowModal(true); setFormData({ name: '', abbreviation: '', department_admin_id: admins.length > 0 ? admins[0].id : '' }); }}
                        className="action-button self-start lg:self-auto"
                    >
                        <FiPlus />
                        <span>New Department</span>
                    </button>
                </div>
            </header>

            <div className="surface-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                        <h2 className="text-lg font-extrabold text-slate-900">Departments</h2>
                        <p className="mt-1 text-sm text-slate-500">{departments.length} configured department(s)</p>
                    </div>
                    <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 md:flex">
                        <FiLayers className="text-xl" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead className="bg-slate-50/80">
                            <tr>
                                <th className="table-header-cell">Name</th>
                                <th className="table-header-cell">Abbreviation</th>
                                <th className="table-header-cell">Assigned Admin</th>
                                <th className="table-header-cell text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="table-cell py-10 text-center text-slate-500">Loading departments...</td>
                                </tr>
                            ) : (
                                departments.map((d) => {
                                    const adminName = admins.find((a) => a.id === d.department_admin_id)?.username || `ID: ${d.department_admin_id}`;

                                    return (
                                        <tr key={d.id} className="table-row">
                                            <td className="table-cell font-bold text-slate-900">{d.name}</td>
                                            <td className="table-cell"><span className="status-badge border-slate-200 bg-slate-100 text-slate-700">{d.abbreviation}</span></td>
                                            <td className="table-cell font-medium text-cyan-700">{adminName}</td>
                                            <td className="table-cell">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => openEditModal(d)} className="ghost-button !rounded-xl !px-3 !py-2" title="Edit Department"><FiEdit2 /></button>
                                                    <button onClick={() => deleteDept(d.id)} className="danger-button !rounded-xl !px-3 !py-2" title="Delete Department"><FiTrash2 /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal-panel max-w-xl">
                        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-5">
                            <h2 className="text-xl font-extrabold text-slate-900">{modalMode === 'create' ? 'Create New Department' : 'Edit Department'}</h2>
                        </div>
                        <form onSubmit={handleFormSubmit} className="space-y-5 p-6">
                            <div>
                                <label className="label-text">Department Name</label>
                                <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" />
                            </div>
                            <div>
                                <label className="label-text">Abbreviation</label>
                                <input required value={formData.abbreviation} onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })} className="input-field" />
                            </div>
                            <div>
                                <label className="label-text">Assign Department Admin</label>
                                <select required value={formData.department_admin_id} onChange={(e) => setFormData({ ...formData, department_admin_id: e.target.value })} className="select-field">
                                    <option value="" disabled>Select an Admin</option>
                                    {admins.map((a) => (
                                        <option key={a.id} value={a.id}>{a.name} {a.lastname} ({a.username})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                                <button type="button" onClick={() => setShowModal(false)} className="ghost-button">Cancel</button>
                                <button type="submit" className="action-button">{modalMode === 'create' ? 'Create Department' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Departments;
