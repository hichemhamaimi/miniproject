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
// AI Exam Generation Workflow
import MaterialManager from './pages/teacher/MaterialManager.jsx'
import MindmapViewer from './pages/teacher/MindmapViewer.jsx'
import BlueprintBuilder from './pages/teacher/BlueprintBuilder.jsx'
import AIExamGenerator from './pages/teacher/AIExamGenerator.jsx'
import AIExamReview from './pages/teacher/AIExamReview.jsx'
import PublishedExams from './pages/teacher/PublishedExams.jsx'
import LLMSettings from './pages/teacher/LLMSettings.jsx'
import TeacherExamWorkflow from './pages/teacher/TeacherExamWorkflow.jsx'
import SuperAdminDashboard from './pages/superadmin/Dashboard.jsx'
import SuperAdminUsers from './pages/superadmin/Users.jsx'
import SuperAdminDepartments from './pages/superadmin/Departments.jsx'
import SuperAdminAIProviders from './pages/superadmin/AIProviders.jsx'
import DeptAdminDashboard from './pages/departmentadmin/Dashboard.jsx'
import DeptAdminGroups from './pages/departmentadmin/Groups.jsx'
import DeptAdminModules from './pages/departmentadmin/Modules.jsx'
import StudentDashboard from './pages/student/Dashboard.jsx'
import TakeExam from './pages/student/TakeExam.jsx'
import StudentResults from './pages/student/StudentResults.jsx'
import SebExit from './pages/student/SebExit.jsx'
import ExamStatistics from './pages/teacher/ExamStatistics.jsx'
import { RequireRole } from './components/auth/RequireAuth.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />}>
             <Route index element={<Home />} />
             <Route path="login" element={<Login />} />
             <Route element={<RequireRole allowedRoles={['teacher', 'superadmin']} />}>
               <Route path="teacher/dashboard" element={<Dashboard />} />
               <Route path="teacher/modules" element={<ModulesList />} />
               <Route path="teacher/modules/:moduleId" element={<ModuleDetails />} />
               <Route path="teacher/create-exam" element={<CreateExam />} />
               <Route path="teacher/exam-workflow" element={<TeacherExamWorkflow />} />
               <Route path="teacher/exam-workflow/:moduleId" element={<TeacherExamWorkflow />} />
               {/* AI Exam Generation Workflow */}
               <Route path="teacher/materials" element={<MaterialManager />} />
               <Route path="teacher/materials/:materialId/mindmap" element={<MindmapViewer />} />
               <Route path="teacher/blueprint-builder" element={<BlueprintBuilder />} />
               <Route path="teacher/ai-exam-generator" element={<AIExamGenerator />} />
               <Route path="teacher/ai-exam-review/:examId" element={<AIExamReview />} />
               <Route path="teacher/published-exams" element={<PublishedExams />} />
               <Route path="teacher/llm-settings" element={<LLMSettings />} />
               <Route path="teacher/exam-statistics/:examId" element={<ExamStatistics />} />
             </Route>
             <Route element={<RequireRole allowedRoles={['superadmin']} />}>
               <Route path="superadmin/dashboard" element={<SuperAdminDashboard />} />
               <Route path="superadmin/users" element={<SuperAdminUsers />} />
               <Route path="superadmin/departments" element={<SuperAdminDepartments />} />
               <Route path="superadmin/ai-providers" element={<SuperAdminAIProviders />} />
             </Route>
             <Route element={<RequireRole allowedRoles={['department_admin']} />}>
               <Route path="departmentadmin/dashboard" element={<DeptAdminDashboard />} />
               <Route path="departmentadmin/groups" element={<DeptAdminGroups />} />
               <Route path="departmentadmin/modules" element={<DeptAdminModules />} />
             </Route>
             <Route element={<RequireRole allowedRoles={['student']} allowSebBootstrap />}>
               <Route path="student/dashboard" element={<StudentDashboard />} />
               <Route path="student/exams/:examId" element={<TakeExam />} />
               <Route path="student/exams/:examId/seb-exit" element={<SebExit />} />
               <Route path="student/results" element={<StudentResults />} />
             </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
