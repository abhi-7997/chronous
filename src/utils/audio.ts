let audioContext: AudioContext | null = null;
let activeGainNode: GainNode | null = null;
let activeAlarmOscillators: OscillatorNode[] = [];
let alarmTimeoutTimer: any = null;

export function stopAlarmSound() {
  if (alarmTimeoutTimer) {
    clearTimeout(alarmTimeoutTimer);
    alarmTimeoutTimer = null;
  }

  if (activeGainNode && audioContext) {
    try {
      activeGainNode.gain.cancelScheduledValues(audioContext.currentTime);
      activeGainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    } catch {
      // ignore
    }
    activeGainNode = null;
  }

  activeAlarmOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {
      // ignore
    }
  });
  activeAlarmOscillators = [];

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      // ignore
    }
  }
}

/**
 * Plays an alert alarm for the specified duration (default 20 seconds).
 * Emits a high-visibility repeating chime/beep pattern.
 */
export function playAlarmSound(durationSeconds = 20, isUrgent = false) {
  try {
    stopAlarmSound();

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContext) {
      audioContext = new AudioCtx();
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    masterGain.connect(audioContext.destination);
    activeGainNode = masterGain;

    const startTime = audioContext.currentTime;
    const pulseCycle = 0.6; // A cycle every 600ms (beep-beep pause)
    const cycles = Math.ceil(durationSeconds / pulseCycle);

    for (let c = 0; c < cycles; c++) {
      const cycleStart = startTime + c * pulseCycle;
      if (cycleStart >= startTime + durationSeconds) break;

      // Pulse 1
      createBeep(cycleStart, isUrgent ? 880 : 740, masterGain);

      // Pulse 2 (0.18s later)
      const pulse2Start = cycleStart + 0.18;
      if (pulse2Start < startTime + durationSeconds) {
        createBeep(pulse2Start, isUrgent ? 1174.66 : 987.77, masterGain);
      }
    }

    // Trigger haptic vibration on supporting mobile devices (extended for 20s)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([
          300, 150, 300, 150, 300, 150, 400,
          200, 300, 150, 300, 150, 400,
          200, 300, 150, 300, 150, 400,
          200, 300, 150, 300, 150, 400,
        ]);
      } catch {
        // ignore
      }
    }

    // Schedule auto-silence exactly at durationSeconds (20s)
    alarmTimeoutTimer = setTimeout(() => {
      stopAlarmSound();
    }, durationSeconds * 1000);
  } catch (err) {
    console.warn('Audio alarm playback error:', err);
  }
}

function createBeep(time: number, freq: number, destination: AudioNode) {
  if (!audioContext) return;
  try {
    const osc = audioContext.createOscillator();
    const beepGain = audioContext.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    beepGain.gain.setValueAtTime(0.0001, time);
    beepGain.gain.exponentialRampToValueAtTime(0.4, time + 0.02);
    beepGain.gain.setValueAtTime(0.35, time + 0.12);
    beepGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);

    osc.connect(beepGain);
    beepGain.connect(destination);

    osc.start(time);
    osc.stop(time + 0.16);

    activeAlarmOscillators.push(osc);
  } catch {
    // ignore
  }
}

export function playNotificationSound(durationSeconds = 4) {
  playAlarmSound(durationSeconds, false);
}

export function speakAnnouncement(text: string) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.lang = 'en-IN';
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
}
