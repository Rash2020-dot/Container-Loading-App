import type { AlertTone } from '../types/loading';

export function playScanBeep(tone: AlertTone): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (tone === 'red') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      gain.gain.setValueAtTime(0.35, now);
      osc.start(now);
      osc.stop(now + 0.55);
    } else if (tone === 'yellow') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.28, now);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.15, now);
      osc.start(now);
      osc.stop(now + 0.14);
    }

    osc.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    // Ignore audio context restrictions if blocked by browser policy
  }
}
