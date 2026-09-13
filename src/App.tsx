import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RoleSelect } from './components/RoleSelect';
import { UserAuth } from './components/UserAuth';
import { UserPanel } from './components/UserPanel';
import { OperatorPanel } from './components/OperatorPanel';
import { QueueState, Role, User } from './types';
import { api } from './services/api';

const USER_SESSION_KEY = 'CHRONOUS_USER_SESSION';
const ROLE_SESSION_KEY = 'CHRONOUS_USER_ROLE';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem(USER_SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore invalid session data.
    }
    return null;
  });

  const [role, setRole] = useState<Role>(() => {
    const savedRole = sessionStorage.getItem(ROLE_SESSION_KEY) as Role;
    if (savedRole === 'operator') return 'operator';
    if (savedRole === 'user') return 'user';
    return null;
  });

  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [isDbConnected, setIsDbConnected] = useState(true);

  const refreshQueue = useCallback(async () => {
    try {
      const state = await api.getQueueState();
      setQueueState(state);
      setIsDbConnected(true);
    } catch (err) {
      console.warn('Database sync error:', err);
      setIsDbConnected(false);
    }
  }, []);

  // GitHub Pages is static hosting. Use polling instead of /api/events SSE.
  useEffect(() => {
    refreshQueue();
    const interval = setInterval(refreshQueue, 3000);
    return () => clearInterval(interval);
  }, [refreshQueue]);

  const handleUserLogin = (loggedInUser: User) => {
    // Save the successful login BEFORE navigating to index.html.
    // App will restore this session when index.html loads.
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(loggedInUser));
    sessionStorage.setItem(ROLE_SESSION_KEY, 'user');

    setUser(loggedInUser);
    setRole('user');

    // Explicitly open the main/index page after successful login.
    // This works with the GitHub Pages /chronous/ project path.
    const basePath = window.location.pathname.includes('/chronous/')
      ? '/chronous/'
      : './';
    window.location.assign(`${basePath}index.html`);
  };

  const handleUserLogout = () => {
    setUser(null);
    sessionStorage.removeItem(USER_SESSION_KEY);
    sessionStorage.removeItem(ROLE_SESSION_KEY);
    setRole(null);
  };

  const handleOperatorLogout = () => {
    sessionStorage.removeItem(ROLE_SESSION_KEY);
    setRole(null);
  };

  const handleSelectRole = (newRole: Role) => {
    setRole(newRole);
    if (newRole) {
      sessionStorage.setItem(ROLE_SESSION_KEY, newRole);
    } else {
      sessionStorage.removeItem(ROLE_SESSION_KEY);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      <Header
        currentRole={role}
        onSelectRole={handleSelectRole}
        isDbConnected={isDbConnected}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {role === null && (
          <RoleSelect
            onSelectUser={() => handleSelectRole('user')}
            onSelectOperator={() => handleSelectRole('operator')}
          />
        )}

        {role === 'user' && (
          <>
            {!user ? (
              <UserAuth
                onLoginSuccess={handleUserLogin}
                onBackToRoles={() => handleSelectRole(null)}
              />
            ) : (
              <UserPanel
                user={user}
                queueState={queueState}
                onLogout={handleUserLogout}
                onRefreshQueue={refreshQueue}
              />
            )}
          </>
        )}

        {role === 'operator' && (
          <OperatorPanel
            queueState={queueState}
            onLogout={handleOperatorLogout}
            onRefreshQueue={refreshQueue}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>CHRONOUS • MeeSeva Style Queue & Token Management System</div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>SQLite Database Connected</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
