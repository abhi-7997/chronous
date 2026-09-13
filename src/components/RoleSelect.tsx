import React, { useState } from 'react';
import { User, ShieldCheck, ArrowRight, Lock, KeyRound } from 'lucide-react';
import { api } from '../services/api';

interface RoleSelectProps {
  onSelectUser: () => void;
  onSelectOperator: () => void;
}

export const RoleSelect: React.FC<RoleSelectProps> = ({
  onSelectUser,
  onSelectOperator,
}) => {
  const [showOperatorCode, setShowOperatorCode] = useState(false);
  const [operatorCode, setOperatorCode] = useState('');
  const [operatorError, setOperatorError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleOperatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperatorError('');
    setIsVerifying(true);

    try {
      await api.verifyOperator(operatorCode.trim());
      onSelectOperator();
    } catch (err: any) {
      setOperatorError(err.message || 'Invalid operator code. Access denied.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8">
        {!showOperatorCode ? (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                Select Account
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Choose your role to access the MeeSeva Token System
              </p>
            </div>

            <div className="space-y-4">
              {/* User Button */}
              <button
                onClick={onSelectUser}
                className="w-full group text-left p-5 rounded-xl border-2 border-blue-500 bg-blue-50/50 hover:bg-blue-600 hover:text-white transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-blue-600 group-hover:bg-white text-white group-hover:text-blue-600 flex items-center justify-center text-2xl shadow-sm transition">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-white transition">
                      👤 CITIZEN / USER
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 group-hover:text-blue-100 transition mt-0.5">
                      Generate service tokens, track wait time, get turn alerts
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-blue-600 group-hover:text-white group-hover:translate-x-1 transition" />
              </button>

              {/* Operator Button */}
              <button
                onClick={() => {
                  setShowOperatorCode(true);
                  setOperatorError('');
                  setOperatorCode('');
                }}
                className="w-full group text-left p-5 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-emerald-600 group-hover:bg-white text-white group-hover:text-emerald-600 flex items-center justify-center text-2xl shadow-sm transition">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-white transition">
                      👨‍💼 OPERATOR / MANAGER
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 group-hover:text-emerald-100 transition mt-0.5">
                      Call tokens, complete services, manage counters & sessions
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-emerald-600 group-hover:text-white group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Operator Login</h2>
              <p className="text-sm text-slate-500 mt-1">
                Enter your operator security access code to open the counter panel
              </p>
            </div>

            {operatorError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm font-medium text-center">
                {operatorError}
              </div>
            )}

            <form onSubmit={handleOperatorSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Operator Access Code
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={operatorCode}
                    onChange={(e) => setOperatorCode(e.target.value)}
                    placeholder="Enter operator code"
                    required
                    autoFocus
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {isVerifying ? 'Verifying...' : 'Continue as Operator'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowOperatorCode(false)}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
                >
                  ← Back to Role Selection
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <footer className="text-center text-xs text-slate-400 mt-8">
        CHRONOUS © 2026 • MeeSeva Queue & Token Management
      </footer>
    </div>
  );
};
