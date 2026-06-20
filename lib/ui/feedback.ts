// Action feedback: a short sound + a toast, keyed by outcome. Gives the
// dashboard a tactile, "alive" feel — success chimes, failures buzz, scheduled
// items blip, and things needing the owner's attention get an alert tone.
//
// Sounds are synthesized with the Web Audio API (no audio files). They only play
// after a user gesture (which every action is), satisfying autoplay policies.
// Users can mute via localStorage 'nx_sound' = 'off'.

import { toast } from 'sonner';

export type Outcome = 'success' | 'error' | 'scheduled' | 'approval' | 'info';

let audio: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (localStorage.getItem('nx_sound') === 'off') return null;
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return audio;
  } catch {
    return null;
  }
}

// Play a sequence of [frequency, startOffset] notes.
function notes(seq: [number, number][], type: OscillatorType = 'sine') {
  const ac = ctx();
  if (!ac) return;
  const now = ac.currentTime;
  for (const [freq, at] of seq) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.12, now + at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.16);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.18);
  }
}

const SOUNDS: Record<Outcome, () => void> = {
  success: () => notes([[660, 0], [880, 0.09]]),         // rising two-note
  error: () => notes([[180, 0], [140, 0.1]], 'sawtooth'), // low buzz
  scheduled: () => notes([[520, 0]], 'triangle'),         // soft blip
  approval: () => notes([[740, 0], [740, 0.18]], 'square'), // attention
  info: () => notes([[600, 0]]),
};

export function playSound(outcome: Outcome) {
  try {
    SOUNDS[outcome]?.();
  } catch {
    /* ignore audio errors */
  }
}

// Sound + toast in one call.
export function feedback(outcome: Outcome, message: string, description?: string) {
  playSound(outcome);
  const opts = description ? { description } : undefined;
  switch (outcome) {
    case 'success':
      toast.success(message, opts);
      break;
    case 'error':
      toast.error(message, opts);
      break;
    case 'approval':
      toast.warning(message, opts);
      break;
    case 'scheduled':
    case 'info':
      toast(message, opts);
      break;
  }
}

export function isSoundOn(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('nx_sound') !== 'off';
}

export function setSoundOn(on: boolean) {
  if (typeof window !== 'undefined') localStorage.setItem('nx_sound', on ? 'on' : 'off');
}
