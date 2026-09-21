import React, { useState, useEffect, useRef } from 'react';
import {
  Ticket,
  Clock,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  LogOut,
  Users,
  Building,
  Sparkles,
  Radio,
  BellRing,
  Bell,
} from 'lucide-react';
import { QueueState, Token, User, ServiceType } from '../types';
import { api } from '../services/api';
import { playNotificationSound, playAlarmSound, stopAlarmSound, speakAnnouncement } from '../utils/audio';

const SERVICES: ServiceType[] = [
  'Certificates',
  'Municipal Services',
  'Electricity Services',
  'Other Services',
  'Aadhaar Services',
  'Licence Services',
  'Application Services',
];

interface ActiveAlarm {
  type: 'plus_two' | 'your_turn';
  title: string;
  message: string;
  calledToken: string;
  myToken: string;
  counter: string;
  secondsRemaining: number;
}

interface UserPanelProps {
  user: User;
  queueState: QueueState | null;
  onLogout: () => void;
  onRefreshQueue: () => Promise<void>;
}

export const UserPanel: React.FC<UserPanelProps> = ({
  user,
  queueState,
  onLogout,
  onRefreshQueue,
}) => {
  const [selectedService, setSelectedService] = useState<ServiceType>('Certificates');
  const [myToken, setMyToken] = useState<Token | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);
  const [alarmBefore, setAlarmBefore] = useState<number>(2);
  const [alarmSettingsOpen, setAlarmSettingsOpen] = useState(false);
  const lastAlertKeyRef = useRef<string>('');

  // Load user's active token from database on mount & sync with queueState
  useEffect(() => {
    let mounted = true;

    async function checkActiveToken() {
      try {
        const token = await api.getUserActiveToken(user.mobile, user.id);
        if (mounted) {
          setMyToken(token);
          setAlarmBefore(token.alarm_before ?? 2);
        }
      } catch (err) {
        console.warn('Error fetching active user token:', err);
      }
    }

    checkActiveToken();
    return () => {
      mounted = false;
    };
  }, [user.mobile, user.id]);

  // Keep myToken synchronized when queueState updates from database
  useEffect(() => {
    if (!queueState) return;

    // Check if user currently has an active serving or waiting token in the queue
    if (
      queueState.currentServing &&
      (queueState.currentServing.user_mobile === user.mobile ||
        (user.id && queueState.currentServing.user_id === user.id) ||
        (myToken && queueState.currentServing.token_number === myToken.token_number))
    ) {
      setMyToken(queueState.currentServing);
      return;
    }

    const waiting = queueState.waitingTokens.find(
      (t) =>
        t.user_mobile === user.mobile ||
        (user.id && t.user_id === user.id) ||
        (myToken && t.token_number === myToken.token_number)
    );

    if (waiting) {
      setMyToken(waiting);
      return;
    }

    // If myToken was waiting or serving but is now marked completed
    if (myToken && (myToken.status === 'waiting' || myToken.status === 'serving')) {
      const completed = queueState.completedTokens.find(
        (t) => t.token_number === myToken.token_number
      );
      if (completed) {
        setMyToken(completed);
      }
    }
  }, [queueState, user.mobile, user.id, myToken?.token_number]);

  // 10-second countdown timer for active alarm
  useEffect(() => {
    if (!activeAlarm) return;

    const timer = setInterval(() => {
      setActiveAlarm((prev) => {
        if (!prev) return null;
        if (prev.secondsRemaining <= 1) {
          stopAlarmSound();
          return null;
        }
        return {
          ...prev,
          secondsRemaining: prev.secondsRemaining - 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeAlarm?.calledToken, activeAlarm?.type]);

  // Clean up audio alarm when component unmounts
  useEffect(() => {
    return () => {
      stopAlarmSound();
    };
  }, []);

  const triggerAlarm = (data: Omit<ActiveAlarm, 'secondsRemaining'>) => {
    setActiveAlarm({
      ...data,
      secondsRemaining: 20,
    });
    if (soundEnabled) {
      playAlarmSound(20, data.type === 'your_turn');
    }
  };

  const handleDismissAlarm = () => {
    stopAlarmSound();
    setActiveAlarm(null);
  };

  // Check turn, +2 alarm, and notification state from database
  useEffect(() => {
    if (!queueState || !myToken) return;

    const { systemState, currentServing, waitingTokens } = queueState;

    // 1. YOUR TURN alert (20 seconds alarm)
    if (
      currentServing &&
      currentServing.token_number === myToken.token_number
    ) {
      const turnAlertKey = `TURN_${currentServing.token_number}_${currentServing.called_at || ''}`;
      if (lastAlertKeyRef.current !== turnAlertKey) {
        lastAlertKeyRef.current = turnAlertKey;
        const msg = `YOUR TURN! Token ${myToken.token_number} - Please proceed immediately to ${currentServing.counter || 'Counter 1'}.`;
        triggerAlarm({
          type: 'your_turn',
          title: `🔔 YOUR TURN NOW: TOKEN ${myToken.token_number}`,
          message: msg,
          calledToken: currentServing.token_number,
          myToken: myToken.token_number,
          counter: currentServing.counter || 'Counter 1',
        });
        if (soundEnabled) {
          speakAnnouncement(`Attention! Token ${myToken.token_number}, your turn has arrived! Please proceed to ${currentServing.counter || 'Counter 1'}.`);
        }
      }
      return;
    }

    // 2. PERSONAL ALARM: default 2 tokens before, or the citizen's selected value.
    // The sound is played only in this citizen's browser. Supabase stores only the preference.
    if (currentServing && myToken.status === 'waiting') {
      const calledNum =
        currentServing.numeric_id ||
        parseInt(currentServing.token_number.replace(/\D/g, ''), 10);
      const myNum =
        myToken.numeric_id ||
        parseInt(myToken.token_number.replace(/\D/g, ''), 10);
      const lead = Math.min(5, Math.max(1, alarmBefore || 2));
      const shouldAlarm = Boolean(calledNum && myNum && myNum === calledNum + lead);

      if (shouldAlarm) {
        const alarmKey = `PERSONAL_ALARM_${currentServing.token_number}_${currentServing.called_at || ''}_${myToken.token_number}_${lead}`;
        if (lastAlertKeyRef.current !== alarmKey) {
          lastAlertKeyRef.current = alarmKey;
          const msg = `Token ${currentServing.token_number} is now called. Your token ${myToken.token_number} will be called in ${lead} token${lead === 1 ? '' : 's'}. Please prepare your documents and get ready!`;
          triggerAlarm({
            type: 'plus_two',
            title: `🚨 QUEUE ALARM: TOKEN ${currentServing.token_number} CALLED`,
            message: msg,
            calledToken: currentServing.token_number,
            myToken: myToken.token_number,
            counter: currentServing.counter || 'Counter 1',
          });
          if (soundEnabled) {
            speakAnnouncement(
              `Attention Token ${myToken.token_number}! Token ${currentServing.token_number} is now called. Your turn will be in ${lead} token${lead === 1 ? '' : 's'}. Please get ready.`
            );
          }
        }
      }
    }

    // 3. GET READY! upcoming alert (from operator completing previous token)
    if (systemState?.lastNotification && myToken.status === 'waiting') {
      const { targetTokenNumber, time } = systemState.lastNotification;
      if (targetTokenNumber === myToken.token_number) {
        const notifKey = `READY_${targetTokenNumber}_${time}`;
        if (lastAlertKeyRef.current !== notifKey) {
          lastAlertKeyRef.current = notifKey;
          const msg = `GET READY! Your token ${myToken.token_number} is coming soon.`;
          triggerAlertToast(msg);
          if (soundEnabled) {
            speakAnnouncement(`Citizen with token ${myToken.token_number}, please get ready.`);
          }
        }
      }
    }
  }, [queueState, myToken, soundEnabled]);

  const triggerAlertToast = (message: string) => {
    setNotification(message);
    if (soundEnabled) {
      playNotificationSound(4);
    }
    setTimeout(() => {
      setNotification((prev) => (prev === message ? null : prev));
    }, 10000);
  };

  const hasActiveToken = Boolean(
    myToken && (myToken.status === 'waiting' || myToken.status === 'serving')
  );

  const handleGenerateToken = async () => {
    if (hasActiveToken) {
      alert(
        `You already have an active token (${myToken?.token_number} - ${myToken?.service}). Each user is limited to only one active token at a time.`
      );
      return;
    }

    if (!queueState?.systemState.sessionActive) {
      alert('The token counter session is currently closed/inactive. Please wait for the operator to start the session.');
      return;
    }

    setIsGenerating(true);
    try {
      const token = await api.generateToken(
        selectedService,
        {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
        },
        alarmBefore
      );
      setMyToken(token);
      await onRefreshQueue();
      if (soundEnabled) {
        playNotificationSound(2);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate token');
    } finally {
      setIsGenerating(false);
    }
  };

  // Expected wait time calculation
  const calculateExpectedTime = (): { text: string; detail: string; isNow: boolean } => {
    if (!myToken || !queueState) {
      return { text: 'Expected Time: -', detail: '', isNow: false };
    }

    if (myToken.status === 'completed') {
      return { text: 'Completed', detail: 'Service has concluded', isNow: false };
    }

    if (myToken.status === 'serving') {
      return {
        text: 'Expected Time: NOW',
        detail: `Proceed to ${myToken.counter || 'Counter 1'}`,
        isNow: true,
      };
    }

    // Count how many waiting tokens are ahead of this user's token
    const waiting = queueState.waitingTokens;
    let tokensAhead = 0;
    for (const t of waiting) {
      if (t.numeric_id < myToken.numeric_id) {
        tokensAhead++;
      }
    }

    const MINUTES_PER_TOKEN = 5;
    let tokensToProcess = tokensAhead;
    if (queueState.currentServing && queueState.currentServing.numeric_id < myToken.numeric_id) {
      tokensToProcess += 1;
    }

    const minutesToWait = tokensToProcess * MINUTES_PER_TOKEN;
    const expectedDate = new Date(Date.now() + minutesToWait * 60000);
    const timeFormatted = expectedDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const positionText =
      tokensAhead === 0 ? 'Next in line!' : `${tokensAhead} person(s) ahead of you`;

    return {
      text: `Expected Time: ${timeFormatted}`,
      detail: `Approx ${minutesToWait} mins (${positionText})`,
      isNow: false,
    };
  };

  const expectedInfo = calculateExpectedTime();
  const sessionActive = queueState?.systemState.sessionActive ?? true;

  const isCurrentlyPlusTwo = Boolean(
    myToken &&
      myToken.status === 'waiting' &&
      queueState?.currentServing &&
      myToken.numeric_id ===
        (queueState.currentServing.numeric_id ||
          parseInt(queueState.currentServing.token_number.replace(/\D/g, ''), 10)) +
          (alarmBefore || 2)
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* High-Visibility 20-Second Active Alarm Banner */}
      {activeAlarm && (
        <div
          role="alert"
          aria-live="assertive"
          className={`mb-6 p-5 sm:p-6 rounded-2xl shadow-2xl border-2 transition-all duration-300 ${
            activeAlarm.type === 'your_turn'
              ? 'bg-gradient-to-r from-rose-700 to-red-900 text-white border-rose-300 shadow-rose-900/40 ring-4 ring-rose-500/30'
              : 'bg-gradient-to-r from-amber-700 via-amber-800 to-orange-950 text-white border-amber-300 shadow-amber-900/40 ring-4 ring-amber-500/30'
          }`}
        >
          {/* Animated 20-Second Countdown Bar */}
          <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden mb-4 border border-white/20">
            <div
              className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                activeAlarm.type === 'your_turn' ? 'bg-rose-300' : 'bg-yellow-300'
              }`}
              style={{ width: `${(activeAlarm.secondsRemaining / 20) * 100}%` }}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`p-3.5 rounded-2xl flex-shrink-0 animate-bounce ${
                  activeAlarm.type === 'your_turn'
                    ? 'bg-rose-500 text-white'
                    : 'bg-yellow-400 text-slate-950'
                }`}
              >
                <BellRing className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-xs px-2.5 py-0.5 rounded-full bg-white/20 tracking-wider uppercase backdrop-blur-sm">
                    {activeAlarm.type === 'your_turn' ? '🔔 YOUR TURN NOW' : '🚨 +2 TOKEN QUEUE ALARM'}
                  </span>
                  <span className="text-xs font-mono font-black bg-black/40 px-2.5 py-0.5 rounded-full border border-white/30 text-yellow-200">
                    ⏱️ Alarm: {activeAlarm.secondsRemaining}s remaining
                  </span>
                </div>

                <h3 className="font-black text-xl sm:text-2xl text-white mt-1.5 tracking-tight">
                  {activeAlarm.type === 'plus_two'
                    ? `Token ${activeAlarm.calledToken} Called → Your Token ${activeAlarm.myToken} is +2 Away!`
                    : `Token ${activeAlarm.myToken} — Proceed to ${activeAlarm.counter}!`}
                </h3>
                <p className="text-sm text-amber-50 font-medium mt-1 leading-relaxed max-w-xl">
                  {activeAlarm.message}
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 w-full sm:w-auto">
              <button
                onClick={handleDismissAlarm}
                className="w-full sm:w-auto px-5 py-3 bg-white text-slate-900 hover:bg-slate-100 font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
              >
                <VolumeX className="w-4 h-4 text-slate-700" />
                <span>Stop Alarm ({activeAlarm.secondsRemaining}s)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toast notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-emerald-600 text-white p-5 rounded-2xl shadow-2xl border border-emerald-400 flex items-start gap-3 animate-bounce">
          <Sparkles className="w-6 h-6 flex-shrink-0 mt-0.5 text-yellow-300" />
          <div className="flex-1">
            <h4 className="font-bold text-base tracking-wide uppercase">Queue Notification</h4>
            <p className="text-sm font-medium mt-0.5">{notification}</p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-white/80 hover:text-white text-xs font-bold px-2 py-1 bg-emerald-700/60 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Status Bar matching MeeSeva user header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm">
            <div>
              <span className="text-slate-400 font-medium">Session Status:</span>{' '}
              <span
                className={`font-semibold px-2 py-0.5 rounded text-xs inline-flex items-center gap-1 ${
                  sessionActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    sessionActive ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                {sessionActive ? 'Active' : 'Inactive / Closed'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-medium">Name:</span>{' '}
              <span className="font-semibold text-slate-800">{user.name}</span>
            </div>

            <div>
              <span className="text-slate-400 font-medium">Mobile:</span>{' '}
              <span className="font-semibold text-slate-800">{user.mobile}</span>
            </div>

            <div>
              <span className="text-slate-400 font-medium">Email:</span>{' '}
              <span className="font-semibold text-slate-800">{user.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setAlarmSettingsOpen(!alarmSettingsOpen)}
                title="Alarm Settings"
                className="p-2 px-2.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Bell className="w-3.5 h-3.5 text-amber-600" />
                <span>Alarm Settings</span>
              </button>

              {alarmSettingsOpen && (
                <div className="absolute right-0 top-full mt-2 z-40 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4">
                  <div className="text-sm font-bold text-slate-800 mb-1">Alarm Settings</div>
                  <div className="text-xs text-slate-500 mb-3">
                    Choose how many tokens before your token the alarm should ring.
                  </div>
                  <select
                    value={alarmBefore}
                    onChange={async (e) => {
                      const value = Number(e.target.value);
                      setAlarmBefore(value);
                      if (myToken) {
                        try {
                          await api.setTokenAlarm(myToken.id, value);
                          setMyToken({ ...myToken, alarm_before: value });
                        } catch (err: any) {
                          alert(err.message || 'Could not save alarm setting.');
                        }
                      }
                      setAlarmSettingsOpen(false);
                    }}
                    disabled={Boolean(myToken && myToken.status === 'completed')}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 token before</option>
                    <option value={2}>2 tokens before (Default)</option>
                    <option value={3}>3 tokens before</option>
                    <option value={4}>4 tokens before</option>
                    <option value={5}>5 tokens before</option>
                  </select>
                  <div className="text-[11px] text-slate-500 mt-2">
                    If you do not change it, the alarm is automatically set to 2 tokens before.
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) {
                  playNotificationSound(1);
                }
              }}
              title={soundEnabled ? 'Mute notification alarm' : 'Enable audio alarm'}
              className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition ${
                soundEnabled
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? 'Alarm Sound ON' : 'Alarm Muted'}</span>
            </button>

            <button
              onClick={onLogout}
              className="p-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Card 1: Select Service & Generate Token */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Building className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-800">Select Service</h2>
            </div>

            {hasActiveToken ? (
              <div className="mt-2 p-4 bg-amber-50 border border-amber-300 rounded-xl text-left">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-amber-950">
                      Token Limit: 1 Token Per Citizen
                    </h3>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      You already hold active token{' '}
                      <span className="font-mono font-black text-amber-950 bg-amber-200/80 px-1.5 py-0.5 rounded">
                        {myToken?.token_number}
                      </span>{' '}
                      for <span className="font-bold">{myToken?.service}</span>.
                    </p>
                    <p className="text-[11px] text-amber-700 mt-2 font-medium">
                      Each citizen is permitted only one token at a time. Please wait until your turn is completed before taking another token.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  Choose the MeeSeva department you require assistance with:
                </p>

                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value as ServiceType)}
                  disabled={!sessionActive}
                  className="w-full p-3 border border-slate-300 rounded-lg text-slate-800 bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SERVICES.map((srv) => (
                    <option key={srv} value={srv}>
                      {srv}
                    </option>
                  ))}
                </select>

                {!sessionActive && (
                  <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>The session is closed. New tokens cannot be issued currently.</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={handleGenerateToken}
              disabled={!sessionActive || isGenerating || hasActiveToken}
              className={`w-full py-3.5 px-4 font-bold rounded-lg shadow-sm transition text-base flex items-center justify-center gap-2 ${
                hasActiveToken
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  : !sessionActive
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow'
              }`}
            >
              <Ticket className="w-5 h-5" />
              <span>
                {hasActiveToken
                  ? `Active Token in Queue (${myToken?.token_number})`
                  : !sessionActive
                  ? 'Session Closed'
                  : isGenerating
                  ? 'Generating in DB...'
                  : 'Generate Token'}
              </span>
            </button>
          </div>
        </div>

        {/* Card 2: Your Token Display */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Ticket className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">Your Token</h2>
              </div>
              {myToken && (
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    myToken.status === 'serving'
                      ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                      : myToken.status === 'completed'
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {myToken.status}
                </span>
              )}
            </div>

            <div className="text-center py-6 px-4 border-2 border-dashed border-blue-500/80 bg-blue-50/30 rounded-xl">
              <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">
                Assigned Token
              </h3>
              <div className="text-5xl font-black text-blue-600 tracking-tight my-2">
                {myToken ? myToken.token_number : '-'}
              </div>
              <div className="text-sm font-semibold text-slate-700">
                {myToken ? myToken.service : 'No token active'}
              </div>

              <div
                className={`mt-3 font-bold text-sm sm:text-base ${
                  expectedInfo.isNow ? 'text-emerald-600 animate-bounce' : 'text-slate-800'
                }`}
              >
                {expectedInfo.text}
              </div>

              {expectedInfo.detail && (
                <div className="text-xs text-slate-500 mt-0.5">{expectedInfo.detail}</div>
              )}

              {isCurrentlyPlusTwo && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-amber-600 flex-shrink-0 animate-bounce" />
                  <div className="text-left">
                    <span className="font-bold text-amber-950 block">⚠️ +2 TOKEN ALARM TRIGGERED</span>
                    <span>
                      Token {queueState?.currentServing?.token_number} is being served. You are exactly 2 tokens away!
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {myToken && myToken.status === 'serving' && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-center font-bold text-sm flex items-center justify-center gap-2">
              <Radio className="w-4 h-4 animate-ping text-emerald-600" />
              <span>NOW SERVING AT {myToken.counter || 'COUNTER 1'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card 3: Waiting Queue */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-800">Live Waiting Queue</h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
            {queueState?.waitingTokens.length ?? 0} Waiting
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
          {(!queueState || queueState.waitingTokens.length === 0) ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No tokens currently waiting in queue.
            </div>
          ) : (
            queueState.waitingTokens.map((t, idx) => {
              const isMine = myToken?.token_number === t.token_number;
              return (
                <div
                  key={t.id}
                  className={`py-3 px-3.5 rounded-lg flex items-center justify-between transition ${
                    isMine
                      ? 'bg-blue-50 border border-blue-200 font-bold'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-base ${
                            isMine ? 'text-blue-700 font-extrabold' : 'text-slate-800'
                          }`}
                        >
                          {t.token_number}
                        </span>
                        {isMine && (
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-blue-600 text-white rounded">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">{t.service}</span>
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(t.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
