import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FiKey, FiPlus, FiTrash2, FiUserPlus, FiUsers } from 'react-icons/fi';

const roleTone = {
    teacher: 'border-blue-200 bg-blue-50 text-blue-700',
    student: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    department_admin: 'border-violet-200 bg-violet-50 text-violet-700',
    superadmin: 'border-slate-200 bg-slate-100 text-slate-700',
};

const initialForm = { name: '', lastname: '', username: '', date_of_birth: '', role: 'teacher', password: '' };

const Users = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState(initialForm);

    const fetchUsers = async () => {
        try {
            const res = await axiosInstance.get('/superadmin/users');
            setUsers(res.data);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'create') {
                await axiosInstance.post('/superadmin/users', formData);
            } else if (modalMode === 'password') {
                await axiosInstance.patch(`/superadmin/users/${selectedUser.id}/password`, { newPassword: formData.password });
            }
            setShowModal(false);
            fetchUsers();
            setFormData(initialForm);
        } catch (error) {
            alert(error.response?.data?.message || 'Action failed');
        }
    };

    const deleteUser = async (id) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await axiosInstance.delete(`/superadmin/users/${id}`);
            fetchUsers();
        } catch (error) {
            alert('Failed to delete user');
        }
    };

    return (
        <div className="space-y-8">
            <header className="page-hero">
                <p className="eyebrow">User Administration</p>
                <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="page-title">Manage platform identities with clearer actions and cleaner tables</h1>
                        <p className="page-subtitle">Create user accounts, rotate passwords, and remove access without changing any underlying admin flows.</p>
                    </div>
                    <button
                        onClick={() => { setModalMode('create'); setShowModal(true); setFormData({ ...initialForm, password: '' }); }}
                        className="action-button self-start lg:self-auto"
                    >
                        <FiPlus />
                        <span>New User</span>
                    </button>
                </div>
            </header>

            <div className="surface-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                        <h2 className="text-lg font-extrabold text-slate-900">Users</h2>
                        <p className="mt-1 text-sm text-slate-500">{users.length} total account(s)</p>
                    </div>
                    <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white md:flex">
                        <FiUsers className="text-xl" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead className="bg-slate-50/80">
                            <tr>
                                <th className="table-header-cell">Name</th>
                                <th className="table-header-cell">Username</th>
                                <th className="table-header-cell">Role</th>
                                <th className="table-header-cell text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="table-cell py-10 text-center text-slate-500">Loading users...</td>
                                </tr>
                            ) : (
                                users.map((u) => (
                                    <tr key={u.id} className="table-row">
                                        <td className="table-cell">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                                                    {(u.name?.[0] || 'U')}{(u.lastname?.[0] || '')}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{u.name} {u.lastname}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="table-cell font-medium text-slate-600">{u.username}</td>
                                        <td className="table-cell">
                                            <span className={`status-badge ${roleTone[u.role] || 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="table-cell">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => { setSelectedUser(u); setModalMode('password'); setShowModal(true); setFormData({ ...formData, password: '' }); }}
                                                    className="ghost-button !rounded-xl !px-3 !py-2"
                                                    title="Reset Password"
                                                >
                                                    <FiKey />
                                                </button>
                                                <button
                                                    onClick={() => deleteUser(u.id)}
                                                    className="danger-button !rounded-xl !px-3 !py-2"
                                                    title="Delete User"
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal-panel max-w-2xl">
                        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-5">
                            <h2 className="text-xl font-extrabold text-slate-900">
                                {modalMode === 'create' ? 'Create New User' : `Reset Password for ${selectedUser.username}`}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {modalMode === 'create' ? 'Add a new account to the platform.' : 'Set a new password for this user.'}
                            </p>
                        </div>
                        <form onSubmit={handleFormSubmit} className="space-y-5 p-6">
                            {modalMode === 'create' && (
                                <>
                                    <div className="grid gap-5 md:grid-cols-2">
                                        <div>
                                            <label className="label-text">First Name</label>
                                            <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" />
                                        </div>
                                        <div>
                                            <label className="label-text">Last Name</label>
                                            <input required value={formData.lastname} onChange={(e) => setFormData({ ...formData, lastname: e.target.value })} className="input-field" />
                                        </div>
                                    </div>
                                    <div className="grid gap-5 md:grid-cols-2">
                                        <div>
                                            <label className="label-text">Username</label>
                                            <input required value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="input-field" />
                                        </div>
                                        <div>
                                            <label className="label-text">Date of Birth</label>
                                            <input type="date" required value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} className="input-field" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label-text">Role</label>
                                        <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="select-field">
                                            <option value="teacher">Teacher</option>
                                            <option value="student">Student</option>
                                            <option value="department_admin">Department Admin</option>
                                            <option value="superadmin">Super Admin</option>
                                        </select>
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="label-text">{modalMode === 'create' ? 'Password' : 'New Password'}</label>
                                <input required type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="input-field" />
                            </div>
                            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                                <button type="button" onClick={() => setShowModal(false)} className="ghost-button">Cancel</button>
                                <button type="submit" className="action-button">
                                    <FiUserPlus />
                                    <span>{modalMode === 'create' ? 'Create User' : 'Update Password'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
