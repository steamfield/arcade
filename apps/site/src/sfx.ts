// Square-wave cabinet sounds, synthesized on the fly: no audio files to download.
// Off until the player turns it on, and the AudioContext only starts inside that click or keypress.

type Note = { freq: number; at: number; len: number };

let ctx: AudioContext | null = null;
let on = false;

export function soundOn(): boolean {
  return on;
}

export function setSound(value: boolean): void {
  on = value;
  if (on && !ctx) ctx = new AudioContext();
  if (on) void ctx?.resume();
}

function play(notes: Note[], volume = 0.06, type: OscillatorType = 'square'): void {
  if (!on || !ctx) return;
  const t0 = ctx.currentTime + 0.01;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(n.freq, t0 + n.at);
    gain.gain.setValueAtTime(volume, t0 + n.at);
    gain.gain.setValueAtTime(0, t0 + n.at + n.len);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.len + 0.02);
  }
}

/** Cursor moved. */
export const blip = () => play([{ freq: 880, at: 0, len: 0.035 }], 0.04);

/** Sound switched on: a little rising two-step so you know it works. */
export const chime = () =>
  play([
    { freq: 523.25, at: 0, len: 0.07 },
    { freq: 1046.5, at: 0.07, len: 0.1 },
  ]);

/** Game starting: coin-up arpeggio. */
export const coin = () =>
  play([
    { freq: 987.77, at: 0, len: 0.06 },
    { freq: 1318.51, at: 0.06, len: 0.22 },
  ]);
