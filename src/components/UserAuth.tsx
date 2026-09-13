import React, { useState } from 'react';
import { LogIn, UserPlus, Phone, Lock, Mail, User, ArrowLeft, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { User as UserType } from '../types';

interface UserAuthProps {
  onLoginSuccess: (user: UserType) => void;
  onBackToRoles: () => void;
}

export const UserAuth: React.FC<UserAuthProps> = ({ onLoginSuccess, onBackToRoles }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Unregistered state tracking
  const [notRegistered, setNotRegistered] = useState(false);
  const [unregisteredMobile, setUnregisteredMobile] = useState('');

  const clearMessages = () => {
    setError('');
    setSuccess('');
    setNotRegistered(false);
    setUnregisteredMobile('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const cleanMobile = loginMobile.trim().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setError('Mobile number must be exactly 10 digits.');
      return;
    }

    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(cleanMobile, loginPassword);
      // Valid credentials in database -> Open index page
      onLoginSuccess(res.user);
    } catch (err: any) {
      const msg = err.message || '';
      const isUnregistered =
        err.notRegistered ||
        msg.toLowerCase().includes('not registered') ||
        msg.toLowerCase().includes('no account found');

      if (isUnregistered) {
        setNotRegistered(true);
        setUnregisteredMobile(cleanMobile);
        setError('');
      } else {
        setNotRegistered(false);
        setError(msg || 'Login failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!regName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const cleanRegMobile = regMobile.trim().replace(/\D/g, '');
    if (cleanRegMobile.length !== 10) {
      setError('Mobile number must be exactly 10 digits.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(regEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.register({
        name: regName.trim(),
        mobile: cleanRegMobile,
        email: regEmail.trim(),
        password: regPassword,
      });

      // Clear registration inputs
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      setRegConfirmPassword('');

      // Redirect user back to login view to enter number and password
      setLoginMobile(cleanRegMobile);
      setLoginPassword('');
      setMode('login');
      setSuccess('Account created successfully! Please enter your password to log in.');
    } catch (err: any) {
      setError(err.message || 'Unable to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToRegisterFromUnregistered = () => {
    const mobileToTransfer = unregisteredMobile || loginMobile;
    clearMessages();
    setRegMobile(mobileToTransfer);
    setMode('register');
  };

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
        {/* Top Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-blue-50 text-blue-600 mb-3 shadow-inner">
            {mode === 'login' ? <LogIn className="w-7 h-7" /> : <UserPlus className="w-7 h-7" />}
          </div>
          <h2 className="text-2xl font-bold text-slate-800">
            {mode === 'login' ? 'Citizen Login' : 'Create Citizen Account'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {mode === 'login'
              ? 'Access your queue tokens and track live wait status'
              : 'Register to generate and track MeeSeva services tokens'}
          </p>
        </div>

        {/* Error / Success / Unregistered Notifications */}
        {notRegistered && (
          <div className="mb-5 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl text-left shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-900">
                  Mobile Number Not Registered
                </h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Mobile number <span className="font-mono font-bold text-amber-950">{unregisteredMobile}</span> was not found in the database. Please complete registration to continue.
                </p>
                <button
                  type="button"
                  onClick={handleSwitchToRegisterFromUnregistered}
                  className="mt-3 w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Complete Sign Up / Registration</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {error && !notRegistered && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm rounded-xl font-medium flex items-start gap-2 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900">Registration Successful!</p>
              <p className="text-xs text-emerald-700 mt-0.5">{success}</p>
            </div>
          </div>
        )}

        {mode === 'login' ? (
          /* LOGIN FORM */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Mobile Number (10 digits)
                </label>
                <span className={`text-xs ${loginMobile.length === 10 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                  {loginMobile.length}/10
                </span>
              </div>
              <div className="relative">
                <Phone className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  value={loginMobile}
                  onChange={(e) => setLoginMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-sm hover:shadow disabled:opacity-50 text-base"
            >
              {loading ? 'Signing In...' : 'Login to Token System'}
            </button>

            <div className="text-center pt-2 text-sm text-slate-600">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setMode('register');
                }}
                className="text-blue-600 font-semibold hover:underline"
              >
                Create Account
              </button>
            </div>
          </form>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Mobile Number (10 digits)
                </label>
                <span className={`text-xs ${regMobile.length === 10 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                  {regMobile.length}/10
                </span>
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="e.g. 9876543210"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="citizen@example.com"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-sm hover:shadow disabled:opacity-50 text-base mt-2"
            >
              {loading ? 'Creating in Database...' : 'Register Account'}
            </button>

            <div className="text-center pt-2 text-sm text-slate-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setMode('login');
                }}
                className="text-blue-600 font-semibold hover:underline"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}

        <div className="border-t border-slate-200 mt-6 pt-4 text-center">
          <button
            onClick={onBackToRoles}
            className="text-sm text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 mx-auto font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Role Selection
          </button>
        </div>
      </div>
    </div>
  );
};
