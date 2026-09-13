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
    // Clean up any old localStorage sessions to ensure re-login is required after closing browser
    try {
      localStorage.removeItem(USER_SESSION_KEY);
      localStorage.removeItem(ROLE_SESSION_KEY);
    } catch {
      // ignore
    }

    const saved = sessionStorage.getItem(USER_SESSION_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
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

  // Fetch full queue state from database
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

  // Initial load and Server-Sent Events (SSE) for real-time live synchronization
  useEffect(() => {
    refreshQueue();

    // Setup SSE connection
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          // Any database token event triggers immediate refresh
          refreshQueue();
        } catch (e) {
          console.error('Error parsing SSE event:', e);
        }
      };

      eventSource.onerror = () => {
        // SSE may drop, will automatically retry
        setIsDbConnected(false);
      };

      eventSource.onopen = () => {
        setIsDbConnected(true);
      };
    } catch (err) {
      console.warn('SSE not supported or failed to initialize:', err);
    }

    // Polling safety net fallback every 3 seconds
    const interval = setInterval(refreshQueue, 3000);

    return () => {
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [refreshQueue]);

  const handleUserLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setRole('user');
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(loggedInUser));
    sessionStorage.setItem(ROLE_SESSION_KEY, 'user');
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
      {/* Header */}
      <Header
        currentRole={role}
        onSelectRole={handleSelectRole}
        isDbConnected={isDbConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* VIEW 1: Role Selection Screen (matching role.html) */}
        {role === null && (
          <RoleSelect
            onSelectUser={() => handleSelectRole('user')}
            onSelectOperator={() => handleSelectRole('operator')}
          />
        )}

        {/* VIEW 2: Citizen / User Flow (matching login.html and index.html) */}
        {role === 'user' && (
          <>
            {!user ? (
              <UserAuth
                onLoginSuccess={handleUserLogin}
                onBackToRoles={() => setRole(null)}
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

        {/* VIEW 3: Operator Panel (matching operator.html) */}
        {role === 'operator' && (
          <OperatorPanel
            queueState={queueState}
            onLogout={handleOperatorLogout}
            onRefreshQueue={refreshQueue}
          />
        )}
      </main>

      {/* Global Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            CHRONOUS • MeeSeva Style Queue & Token Management System
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>SQLite Database Connected</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
