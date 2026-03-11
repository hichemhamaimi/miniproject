import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

function App() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-gray-800 selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar />
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-8 animate-fade-in">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default App;
