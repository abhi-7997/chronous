import React from 'react';
import { Shield } from 'lucide-react';
import { Role } from '../types';

interface HeaderProps {
  currentRole: Role;
  onSelectRole: (role: Role) => void;
  isDbConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onSelectRole,
  isDbConnected,
}) => {
  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="text-center md:text-left cursor-pointer" onClick={() => onSelectRole(null)}>
          <div className="flex items-center justify-center md:justify-start gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-black tracking-wider text-xl shadow">
              C
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white leading-none">
                CHRONOUS
              </h1>
              <p className="text-xs text-slate-300 font-medium tracking-wide mt-1">
                MeeSeva Style Token Management System
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Role switcher (if active) & DB Status */}
        <div className="flex items-center gap-3">
          {currentRole !== null && (
            <button
              onClick={() => onSelectRole(null)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition flex items-center gap-1.5 border border-slate-700"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Switch Role</span>
            </button>
          )}

          {/* Database Connected indicator badge */}
          <div className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-800 text-emerald-400 border border-slate-700 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isDbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span>{isDbConnected ? 'Database Connected' : 'Connecting...'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
