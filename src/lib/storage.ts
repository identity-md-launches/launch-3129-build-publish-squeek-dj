/** Everything Squeek DJ keeps lives in this browser's localStorage. Storage can be blocked, so every call is guarded. */
const KEYS = {
  sound: "squeek-dj:sound",
  best: (mode: Mode) => `squeek-dj:best:${mode}`,
};

export type Mode = "live" | "practice";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the setting lasts for this visit only */
  }
}

export function loadSound(): boolean {
  return read(KEYS.sound) === "on";
}

export function saveSound(on: boolean): void {
  write(KEYS.sound, on ? "on" : "off");
}

export function loadBest(mode: Mode): number {
  const n = Number(read(KEYS.best(mode)));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Saves `score` when it beats the stored best. Returns true for a new best. */
export function saveBest(mode: Mode, score: number): boolean {
  if (score <= loadBest(mode)) return false;
  write(KEYS.best(mode), String(score));
  return true;
}
