import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import AppSidebar from './components/layout/AppSidebar';
import { useAuth } from './context/AuthContext';

function App() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const isLoginPage = location.pathname === '/login';
  const isAuthenticated = Boolean(user) && !isLoginPage;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
        <div>
          <p className="text-base font-bold text-slate-800">Restoring your session</p>
          <p className="mt-1 text-sm text-slate-500">Please wait while the application verifies your access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {isAuthenticated ? (
        <div className="flex min-h-screen">
          <AppSidebar />
          <div className="shell-main">
            <div className="shell-topbar">
              <div className="content-frame">
                <Navbar />
              </div>
            </div>
            <main className="shell-content">
              <div className="content-frame animate-fade-in">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      ) : (
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className={`flex-1 ${isLoginPage ? '' : 'shell-content'}`}>
            <div className={isLoginPage ? '' : 'content-frame animate-fade-in'}>
              <Outlet />
            </div>
          </main>
          <Footer />
        </div>
      )}
    </div>
  );
}

export default App;
