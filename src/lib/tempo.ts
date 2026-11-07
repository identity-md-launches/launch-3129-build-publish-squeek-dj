export const MIN_BPM = 48;
export const MAX_BPM = 176;
export const PRACTICE_BPM = 100;

/** One wheel turn is one beat: the live RPM becomes the song tempo, clamped to 48–176 BPM. */
export function rpmToBpm(rpm: number): number {
  if (!Number.isFinite(rpm)) return MIN_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(rpm)));
}

/** rpmMilli from the feed is thousandths of a revolution per minute. */
export function rpmFromMilli(rpmMilli: number): number {
  return rpmMilli / 1000;
}

/** Move the playing tempo toward the wheel's tempo by at most `step` BPM per beat, so a jump stays musical. */
export function glide(current: number, target: number, step = 6): number {
  const diff = target - current;
  if (Math.abs(diff) <= step) return target;
  return current + Math.sign(diff) * step;
}
