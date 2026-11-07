/** Web Audio blips. Nothing plays until the player turns sound on, and the context starts on a user gesture. */
const LANE_HZ = [523.25, 659.25, 783.99, 1046.5];

let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function blip(freq: number, durationS: number, gain: number, type: OscillatorType = "square"): void {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + durationS);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + durationS + 0.02);
}

export const sound = {
  beat: (downbeat: boolean) => blip(downbeat ? 1760 : 1320, 0.03, 0.04, "sine"),
  hit: (lane: number, perfect: boolean) => blip(LANE_HZ[lane] * (perfect ? 1 : 0.5), 0.09, 0.06),
  miss: () => blip(110, 0.14, 0.07, "triangle"),
};

export function audioOn(): boolean {
  return ctx !== null;
}
