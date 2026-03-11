import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FaPlus, FaKey, FaTrash } from 'react-icons/fa';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState(''); // 'create' or 'password'
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState({ name: '', lastname: '', username: '', date_of_birth: '', role: 'teacher', password: '' });

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
            setFormData({ name: '', lastname: '', username: '', date_of_birth: '', role: 'teacher', password: '' });
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
        <div className="space-y-6">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Manage Users</h1>
                    <p className="text-gray-500 mt-1">Add users, change passwords, and manage access.</p>
                </div>
                <button 
                    onClick={() => { setModalMode('create'); setShowModal(true); setFormData({...formData, password: ''}); }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
                >
                    <FaPlus /> New User
                </button>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? <tr><td colSpan="4" className="text-center py-4">Loading...</td></tr> : 
                          users.map(u => (
                            <tr key={u.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.name} {u.lastname}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.username}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{u.role}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button 
                                        onClick={() => { setSelectedUser(u); setModalMode('password'); setShowModal(true); setFormData({...formData, password: ''}); }} 
                                        className="text-yellow-600 hover:text-yellow-900 mr-4" title="Reset Password"
                                    ><FaKey className="inline" /></button>
                                    <button 
                                        onClick={() => deleteUser(u.id)} 
                                        className="text-red-600 hover:text-red-900" title="Delete User"
                                    ><FaTrash className="inline" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{modalMode === 'create' ? 'Create New User' : `Reset Password for ${selectedUser.username}`}</h2>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            {modalMode === 'create' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium">First Name</label><input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="mt-1 w-full border rounded-md p-2" /></div>
                                        <div><label className="block text-sm font-medium">Last Name</label><input required value={formData.lastname} onChange={e=>setFormData({...formData, lastname: e.target.value})} className="mt-1 w-full border rounded-md p-2" /></div>
                                    </div>
                                    <div><label className="block text-sm font-medium">Username</label><input required value={formData.username} onChange={e=>setFormData({...formData, username: e.target.value})} className="mt-1 w-full border rounded-md p-2" /></div>
                                    <div><label className="block text-sm font-medium">Date of Birth</label><input type="date" required value={formData.date_of_birth} onChange={e=>setFormData({...formData, date_of_birth: e.target.value})} className="mt-1 w-full border rounded-md p-2" /></div>
                                    <div>
                                        <label className="block text-sm font-medium">Role</label>
                                        <select value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} className="mt-1 w-full border rounded-md p-2">
                                            <option value="teacher">Teacher</option>
                                            <option value="student">Student</option>
                                            <option value="department_admin">Department Admin</option>
                                            <option value="superadmin">Super Admin</option>
                                        </select>
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="block text-sm font-medium">{modalMode === 'create' ? 'Password' : 'New Password'}</label>
                                <input required type="password" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="mt-1 w-full border rounded-md p-2" />
                            </div>
                            <div className="flex gap-4 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium">Cancel</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium">{modalMode === 'create' ? 'Create' : 'Update Password'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
