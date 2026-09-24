import React, { useState } from 'react';
import {
  Radio,
  CheckCircle,
  Play,
  RotateCcw,
  Power,
  Users,
  Clock,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  BellRing,
} from 'lucide-react';
import { QueueState } from '../types';
import { api } from '../services/api';
import { playNotificationSound, speakAnnouncement } from '../utils/audio';

interface OperatorPanelProps {
  queueState: QueueState | null;
  onLogout: () => void;
  onRefreshQueue: () => Promise<void>;
}

export const OperatorPanel: React.FC<OperatorPanelProps> = ({
  queueState,
  onLogout,
  onRefreshQueue,
}) => {
  const [selectedCounter, setSelectedCounter] = useState('Counter 1');
  const [isCalling, setIsCalling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isTogglingSession, setIsTogglingSession] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);

  const showStatus = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const currentToken = queueState?.currentServing;
  const sessionActive = queueState?.systemState.sessionActive ?? true;
  const waitingCount = queueState?.waitingTokens.length ?? 0;
  const completedCount = queueState?.completedTokens.length ?? 0;

  const handleCallNext = async () => {
    if (waitingCount === 0) {
      showStatus('No tokens waiting in the database queue.', 'info');
      return;
    }

    setIsCalling(true);
    try {
      const nextToken = await api.callNextToken(selectedCounter);
      await onRefreshQueue();
      playNotificationSound(3);
      speakAnnouncement(`Now calling Token ${nextToken.token_number} at ${selectedCounter}`);
      const plusTwoSeq = (nextToken.numeric_id || 1) + 2;
      const plusTwoTokenNumber = 'T' + String(plusTwoSeq).padStart(3, '0');
      showStatus(
        `Called ${nextToken.token_number} to ${selectedCounter}. 20-second alarm dispatched to +2 citizen (${plusTwoTokenNumber})!`,
        'success'
      );
    } catch (err: any) {
      showStatus(err.message || 'Error calling next token', 'error');
    } finally {
      setIsCalling(false);
    }
  };

  const handleComplete = async () => {
    if (!currentToken) {
      showStatus('No active token currently being served.', 'info');
      return;
    }

    setIsCompleting(true);
    try {
      const completed = await api.completeCurrentToken();
      await onRefreshQueue();
      playNotificationSound(1);
      showStatus(`Token ${completed.token_number} marked completed in database!`, 'success');
    } catch (err: any) {
      showStatus(err.message || 'Error completing token', 'error');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleToggleSession = async () => {
    setIsTogglingSession(true);
    try {
      await api.setSessionActive(!sessionActive);
      await onRefreshQueue();
      showStatus(
        !sessionActive
          ? 'Session started successfully. Citizens can now generate new tokens.'
          : 'Session ended. Existing waiting and serving tokens can still be completed. New tokens are blocked.',
        'success'
      );
    } catch (err: any) {
      showStatus(err.message || 'Failed to toggle session', 'error');
    } finally {
      setIsTogglingSession(false);
    }
  };

  const handleClearAll = async () => {
    setShowClearConfirm(false);
    try {
      await api.clearAllTokens();
      await onRefreshQueue();
      showStatus('Completed tokens cleared. Waiting and serving tokens were kept.', 'info');
    } catch (err: any) {
      showStatus(err.message || 'Failed to clear completed tokens', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {statusMessage && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border max-w-sm flex items-center gap-3 transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-blue-50 border-blue-300 text-blue-800'
          }`}
        >
          <div className="text-sm font-semibold">{statusMessage.text}</div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-center text-slate-800">Clear Completed Tokens?</h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              This will remove only completed tokens. Waiting and currently serving tokens will remain in the queue.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-sm"
              >
                Yes, Clear Completed
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm">
            <div>
              <span className="text-slate-400 font-medium">Session Status:</span>{' '}
              <span
                className={`font-semibold px-2.5 py-0.5 rounded text-xs inline-flex items-center gap-1.5 ${
                  sessionActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    sessionActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                {sessionActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Counter Desk:</span>
              <select
                value={selectedCounter}
                onChange={(e) => setSelectedCounter(e.target.value)}
                className="font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded px-2 py-0.5 text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="Counter 1">Counter 1 (Certificates & Rev)</option>
                <option value="Counter 2">Counter 2 (Municipal & Utilities)</option>
                <option value="Counter 3">Counter 3 (General & Aadhaar)</option>
                <option value="Counter 4">Counter 4 (Express Counter)</option>
              </select>
            </div>

            <div>
              <span className="text-slate-400 font-medium">In Queue:</span>{' '}
              <span className="font-bold text-blue-600">{waitingCount} waiting</span>
            </div>

            <div>
              <span className="text-slate-400 font-medium">Served Today:</span>{' '}
              <span className="font-bold text-emerald-600">{completedCount}</span>
            </div>
          </div>

          <div>
            <button
              onClick={onLogout}
              className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Exit Panel
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
                <h2 className="text-lg font-bold text-slate-800">Now Serving</h2>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                {selectedCounter}
              </span>
            </div>

            <div className="text-center py-7 px-4 border-2 border-dashed border-emerald-500/80 bg-emerald-50/40 rounded-xl my-2">
              <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">
                Current Token
              </h3>
              <div className="text-6xl font-black text-emerald-600 tracking-tight my-2">
                {currentToken ? currentToken.token_number : '-'}
              </div>
              <div className="text-sm font-bold text-slate-700">
                {currentToken ? currentToken.service : 'No citizen active'}
              </div>

              {currentToken && (
                <div className="mt-3 text-xs text-slate-500 space-y-0.5">
                  <p className="font-medium text-slate-700">
                    Citizen: {currentToken.user_name} ({currentToken.user_mobile})
                  </p>
                  <p>
                    Called at:{' '}
                    {currentToken.called_at
                      ? new Date(currentToken.called_at).toLocaleTimeString()
                      : '-'}
                  </p>
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-semibold text-[11px] flex items-center justify-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span>
                      +2 Alarm Sent to:{' '}
                      <strong>
                        {queueState?.systemState?.lastAlarm?.plusTwoTokenNumber ||
                          `T${String((currentToken.numeric_id || 1) + 2).padStart(3, '0')}`}
                      </strong>{' '}
                      (20s duration)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-2 text-center text-xs text-slate-400">
            {currentToken
              ? 'Click "COMPLETE TOKEN" when service is finished'
              : 'Click "CALL NEXT TOKEN" to process next citizen'}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Desk Controls</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                onClick={handleCallNext}
                disabled={isCalling || waitingCount === 0}
                className="w-full py-4 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 text-base tracking-wide"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{isCalling ? 'Calling Next...' : 'CALL NEXT TOKEN'}</span>
              </button>

              <button
                onClick={handleComplete}
                disabled={isCompleting || !currentToken}
                className="w-full py-4 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 text-base tracking-wide"
              >
                <CheckCircle className="w-5 h-5" />
                <span>{isCompleting ? 'Completing...' : 'COMPLETE TOKEN'}</span>
              </button>

              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 text-sm tracking-wide"
              >
                <RotateCcw className="w-4 h-4" />
                <span>CLEAR ALL TOKENS</span>
              </button>

              {sessionActive ? (
                <button
                  onClick={handleToggleSession}
                  disabled={isTogglingSession}
                  className="w-full py-3.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 text-sm tracking-wide"
                >
                  <Power className="w-4 h-4" />
                  <span>END SESSION</span>
                </button>
              ) : (
                <button
                  onClick={handleToggleSession}
                  disabled={isTogglingSession}
                  className="w-full py-3.5 px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 text-sm tracking-wide"
                >
                  <Power className="w-4 h-4" />
                  <span>START SESSION</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
            <span>
              ℹ️ Calling next token notifies the citizen's device in real-time with chime alert.
            </span>
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
              Auto-sync enabled (SSE + SQLite)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-800">Waiting Queue</h2>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              {waitingCount} citizens
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
            {waitingCount === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                No tokens waiting in queue.
              </div>
            ) : (
              queueState?.waitingTokens.map((t, idx) => (
                <div
                  key={t.id}
                  className="py-3 px-3 rounded-lg flex items-center justify-between hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-mono font-bold text-slate-900 text-base">
                        {t.token_number}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t.service} • {t.user_name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(t.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-800">Completed Tokens</h2>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              {completedCount} finished
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
            {completedCount === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                No completed tokens yet today.
              </div>
            ) : (
              queueState?.completedTokens.map((t) => (
                <div
                  key={t.id}
                  className="py-3 px-3 rounded-lg flex items-center justify-between hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      ✓
                    </div>
                    <div>
                      <div className="font-mono font-bold text-slate-800 line-through text-slate-400">
                        {t.token_number}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t.service} • {t.user_name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-xs text-emerald-700 font-medium">
                    {t.completed_at
                      ? new Date(t.completed_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Completed'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
