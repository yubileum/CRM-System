import React, { useState, useEffect } from 'react';
import { MemberView } from './components/MemberView';
import { AdminView } from './components/AdminView';
import { AuthView } from './components/AuthView';
import { AdminLogin } from './components/AdminLogin';
import { User } from './types';
import { getSessionUser, logoutUser, checkAdminSession } from './services/storage';
import { initializeBranding } from './services/branding';
import { fetchStampConfig } from './services/stampConfig';

const App: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  useEffect(() => {
    // Initialize branding first
    initializeBranding();

    const initApp = async () => {
      // Preload stamp configuration in parallel with other initialization
      // This ensures checkpoint data is ready immediately
      fetchStampConfig().catch(err => {
        console.warn('Failed to preload stamp config:', err);
      });

      // Check if URL has #admin hash
      if (window.location.hash === '#admin') {
        setShowAdminLogin(true);
        setInitializing(false);
        return;
      }

      // 1. Check for Admin persistence first
      if (checkAdminSession()) {
        setIsAdmin(true);
        setInitializing(false);
        return;
      }

      // 2. Check for Member persistence
      const existingUser = await getSessionUser();
      if (existingUser) {
        setCurrentUser(existingUser);
      }

      setInitializing(false);
    };

    initApp();

    // Listen for hash changes
    const handleHashChange = () => {
      if (window.location.hash === '#admin') {
        setShowAdminLogin(true);
      } else {
        setShowAdminLogin(false);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogin = (user: User | null, admin: boolean) => {
    setCurrentUser(user);
    setIsAdmin(admin);
  };

  const handleAdminLogin = () => {
    setIsAdmin(true);
    setShowAdminLogin(false);
    window.location.hash = ''; // Clear the hash
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setIsAdmin(false);
    window.location.hash = ''; // Clear the hash
  };

  if (initializing) return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00em0wIDI0YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00ek0xMiAxNmMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHptMCAyNGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30"></div>
      <div className="relative">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
        <div className="text-white font-bold uppercase tracking-widest text-sm animate-pulse">Loading...</div>
      </div>
    </div>
  );

  // 1. Admin Login Page (hidden, accessible via /#admin)
  if (showAdminLogin && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE2YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00em0wIDI0YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00ek0xMiAxNmMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHptMCAyNGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50"></div>
        <div className="absolute top-20 left-20 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <AdminLogin onLogin={handleAdminLogin} />
      </div>
    );
  }

  // 2. Admin View
  if (isAdmin) {
    return <AdminView onLogout={handleLogout} />;
  }

  // 3. Member View
  if (currentUser) {
    return <MemberView currentUser={currentUser} onLogout={handleLogout} />;
  }

  // 4. Default: Show Auth View (Member Login Only)
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00em0wIDI0YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00ek0xMiAxNmMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHptMCAyNGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30"></div>
      <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <AuthView onLogin={handleLogin} />
    </div>
  );
};

export default App;