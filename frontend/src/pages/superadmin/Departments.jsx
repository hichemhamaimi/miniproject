import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';

const Departments = () => {
    const [departments, setDepartments] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState(''); // 'create' or 'edit'
    const [selectedDept, setSelectedDept] = useState(null);
    const [formData, setFormData] = useState({ name: '', abbreviation: '', department_admin_id: '' });

    const fetchData = async () => {
        try {
            const depRes = await axiosInstance.get('/superadmin/departments');
            const usersRes = await axiosInstance.get('/superadmin/users');
            setDepartments(depRes.data);
            setAdmins(usersRes.data.filter(u => u.role === 'department_admin'));
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
        <div className="space-y-6">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Manage Departments</h1>
                    <p className="text-gray-500 mt-1">Create departments and assign administrators.</p>
                </div>
                <button 
                    onClick={() => { setModalMode('create'); setShowModal(true); setFormData({ name: '', abbreviation: '', department_admin_id: admins.length > 0 ? admins[0].id : '' }); }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
                >
                    <FaPlus /> New Department
                </button>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Abbreviation</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Admin</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? <tr><td colSpan="4" className="text-center py-4">Loading...</td></tr> : 
                          departments.map(d => {
                            const adminName = admins.find(a => a.id === d.department_admin_id)?.username || `ID: ${d.department_admin_id}`;
                            return (
                                <tr key={d.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{d.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{d.abbreviation}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">{adminName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => openEditModal(d)} className="text-blue-600 hover:text-blue-900 mr-4" title="Edit Department"><FaEdit className="inline" /></button>
                                        <button onClick={() => deleteDept(d.id)} className="text-red-600 hover:text-red-900" title="Delete Department"><FaTrash className="inline" /></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{modalMode === 'create' ? 'Create New Department' : 'Edit Department'}</h2>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <div><label className="block text-sm font-medium">Department Name</label><input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="mt-1 w-full border rounded-md p-2" /></div>
                            <div><label className="block text-sm font-medium">Abbreviation</label><input required value={formData.abbreviation} onChange={e=>setFormData({...formData, abbreviation: e.target.value})} className="mt-1 w-full border rounded-md p-2" /></div>
                            <div>
                                <label className="block text-sm font-medium text-indigo-600">Assign Department Admin</label>
                                <select required value={formData.department_admin_id} onChange={e=>setFormData({...formData, department_admin_id: e.target.value})} className="mt-1 w-full border border-indigo-300 rounded-md p-2 focus:ring focus:ring-indigo-200">
                                    <option value="" disabled>Select an Admin</option>
                                    {admins.map(a => (
                                        <option key={a.id} value={a.id}>{a.name} {a.lastname} ({a.username})</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex gap-4 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium">Cancel</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium">{modalMode === 'create' ? 'Create' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Departments;
