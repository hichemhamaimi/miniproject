import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import CreateExam from './pages/teacher/CreateExam.jsx'
import Dashboard from './pages/teacher/Dashboard.jsx'
import ModulesList from './pages/teacher/ModulesList.jsx'
import ModuleDetails from './pages/teacher/ModuleDetails.jsx'
import SuperAdminDashboard from './pages/superadmin/Dashboard.jsx'
import SuperAdminUsers from './pages/superadmin/Users.jsx'
import SuperAdminDepartments from './pages/superadmin/Departments.jsx'
import DeptAdminDashboard from './pages/departmentadmin/Dashboard.jsx'
import DeptAdminGroups from './pages/departmentadmin/Groups.jsx'
import DeptAdminModules from './pages/departmentadmin/Modules.jsx'
import StudentDashboard from './pages/student/Dashboard.jsx'
import TakeExam from './pages/student/TakeExam.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />}>
             <Route index element={<Home />} />
             <Route path="login" element={<Login />} />
             <Route path="teacher/dashboard" element={<Dashboard />} />
             <Route path="teacher/modules" element={<ModulesList />} />
             <Route path="teacher/modules/:moduleId" element={<ModuleDetails />} />
             <Route path="teacher/create-exam" element={<CreateExam />} />
             <Route path="superadmin/dashboard" element={<SuperAdminDashboard />} />
             <Route path="superadmin/users" element={<SuperAdminUsers />} />
             <Route path="superadmin/departments" element={<SuperAdminDepartments />} />
             <Route path="departmentadmin/dashboard" element={<DeptAdminDashboard />} />
             <Route path="departmentadmin/groups" element={<DeptAdminGroups />} />
             <Route path="departmentadmin/modules" element={<DeptAdminModules />} />
             <Route path="student/dashboard" element={<StudentDashboard />} />
             <Route path="student/exams/:examId" element={<TakeExam />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
