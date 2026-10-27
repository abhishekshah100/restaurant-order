'use client';

/*
 * The kitchen's chimes, made in the browser (no sound file to download). Browsers only let a
 * page play sound after someone has touched it, so the context starts suspended and is resumed
 * on the first tap anywhere (useSoundUnlock).
 */

type Chime = 'arrival' | 'reminder';

let context: AudioContext | null | undefined;

/** The page's audio context, made once; null where the browser has none. */
export function audioContext(): AudioContext | null {
  if (context !== undefined) return context;
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  context = Ctor ? new Ctor() : null;
  return context;
}

/** Notes (Hz) and how long each plays (s): a bright two-note "ding-dong", or one soft note. */
const NOTES: Record<Chime, { freq: number; at: number; length: number; volume: number }[]> = {
  arrival: [
    { freq: 784, at: 0, length: 0.22, volume: 0.32 },
    { freq: 1175, at: 0.18, length: 0.38, volume: 0.32 },
  ],
  reminder: [{ freq: 659, at: 0, length: 0.35, volume: 0.18 }],
};

/** Plays a chime; false when sound isn't allowed yet (no tap on the page so far). */
export function playChime(chime: Chime): boolean {
  const ctx = audioContext();
  if (!ctx || ctx.state !== 'running') return false;
  const start = ctx.currentTime + 0.02;
  for (const note of NOTES[chime]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = note.freq;
    gain.gain.setValueAtTime(0, start + note.at);
    gain.gain.linearRampToValueAtTime(note.volume, start + note.at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + note.at + note.length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start + note.at);
    osc.stop(start + note.at + note.length + 0.05);
  }
  return true;
}
