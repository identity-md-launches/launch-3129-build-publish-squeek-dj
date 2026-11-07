import { glide } from "./tempo";

export const PERFECT_MS = 60;
export const GOOD_MS = 130;
export const LANES = 4;
export const ENERGY_START = 60;
export const ENERGY_MAX = 100;

export type Judgement = "perfect" | "good" | "miss";

export interface Note {
  id: number;
  lane: number;
  /** Time the note reaches the hit line, in ms on the performance.now() clock. */
  time: number;
  judged: Judgement | null;
  judgedAt: number;
}

export interface JudgeEvent {
  lane: number;
  judgement: Judgement;
  /** Hit time minus note time; negative is early. */
  deltaMs: number;
}

export interface Stats {
  score: number;
  streak: number;
  bestStreak: number;
  energy: number;
  perfect: number;
  good: number;
  miss: number;
}

export interface EngineOptions {
  startTime: number;
  bpm: number;
  /** How long a note takes to fall from the top of the lane to the hit line. */
  travelMs?: number;
  seed?: number;
}

const POINTS: Record<Exclude<Judgement, "miss">, number> = { perfect: 300, good: 100 };
const ENERGY: Record<Judgement, number> = { perfect: 2, good: 1, miss: -6 };
/** A press with no note in reach costs a little energy, so mashing every lane does not pay. */
const STRAY_ENERGY = -2;

/** Small deterministic generator so a pattern is reproducible in tests. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function multiplier(streak: number): number {
  return 1 + Math.min(3, Math.floor(streak / 10));
}

export function judge(deltaMs: number): Judgement | null {
  const d = Math.abs(deltaMs);
  if (d <= PERFECT_MS) return "perfect";
  if (d <= GOOD_MS) return "good";
  return null;
}

/**
 * The rhythm engine. It knows nothing about the screen: it schedules notes on the beat at the current tempo,
 * judges lane presses against them and keeps the score. Time is always passed in, so it can be tested.
 */
export class Engine {
  readonly travelMs: number;
  notes: Note[] = [];
  /** Beat times already scheduled, for the metronome and the beat pulse. */
  beats: number[] = [];
  bpm: number;
  targetBpm: number;
  stats: Stats = { score: 0, streak: 0, bestStreak: 0, energy: ENERGY_START, perfect: 0, good: 0, miss: 0 };

  private nextBeat: number;
  private beatIndex = 0;
  private nextId = 1;
  private lastLane = -1;
  private rand: () => number;

  constructor(opts: EngineOptions) {
    this.travelMs = opts.travelMs ?? 1600;
    this.bpm = opts.bpm;
    this.targetBpm = opts.bpm;
    this.rand = mulberry32(opts.seed ?? 7);
    // Two beats of count-in after the first note appears at the top.
    this.nextBeat = opts.startTime + this.travelMs + (2 * 60000) / opts.bpm;
  }

  /** Point the tempo at a new value. The playing tempo glides there one beat at a time. */
  setTargetBpm(bpm: number): void {
    this.targetBpm = bpm;
  }

  get beatMs(): number {
    return 60000 / this.bpm;
  }

  get energyEmpty(): boolean {
    return this.stats.energy <= 0;
  }

  private pickLane(): number {
    let lane = Math.floor(this.rand() * LANES);
    if (lane === this.lastLane && this.rand() < 0.6) lane = (lane + 1 + Math.floor(this.rand() * 3)) % LANES;
    this.lastLane = lane;
    return lane;
  }

  private addNote(lane: number, time: number): void {
    this.notes.push({ id: this.nextId++, lane, time, judged: null, judgedAt: 0 });
  }

  /** Schedule notes up to one fall-time ahead and mark notes that passed the window as misses. */
  update(now: number): JudgeEvent[] {
    while (this.nextBeat <= now + this.travelMs) {
      const t = this.nextBeat;
      this.beats.push(t);
      const lane = this.pickLane();
      this.addNote(lane, t);
      // Every 16th beat is a two-lane chord.
      if (this.beatIndex % 16 === 15) this.addNote((lane + 2) % LANES, t);
      this.bpm = glide(this.bpm, this.targetBpm);
      const beat = 60000 / this.bpm;
      // Slow tempos get some off-beat notes so the lane never feels empty.
      if (this.bpm < 90 && this.beatIndex % 2 === 1 && this.rand() < 0.5) this.addNote(this.pickLane(), t + beat / 2);
      this.beatIndex++;
      this.nextBeat = t + beat;
    }

    const events: JudgeEvent[] = [];
    for (const n of this.notes) {
      if (n.judged === null && now - n.time > GOOD_MS) {
        this.apply(n, "miss", now);
        events.push({ lane: n.lane, judgement: "miss", deltaMs: now - n.time });
      }
    }
    // Drop notes that finished their exit, and beats long past.
    this.notes = this.notes.filter((n) => n.judged === null || now - n.judgedAt < 400);
    this.beats = this.beats.filter((b) => now - b < 2000);
    return events;
  }

  /** Move every scheduled time later by `ms`, used to resume after a pause. */
  shift(ms: number): void {
    for (const n of this.notes) {
      n.time += ms;
      if (n.judged !== null) n.judgedAt += ms;
    }
    this.beats = this.beats.map((b) => b + ms);
    this.nextBeat += ms;
  }

  /** A press on `lane` at time `t`. Returns null, and costs a little energy, when no note is inside the Good window. */
  hit(lane: number, t: number): JudgeEvent | null {
    let best: Note | null = null;
    for (const n of this.notes) {
      if (n.lane !== lane || n.judged !== null) continue;
      if (Math.abs(t - n.time) > GOOD_MS) continue;
      if (!best || Math.abs(t - n.time) < Math.abs(t - best.time)) best = n;
    }
    if (!best) {
      this.stats.energy = Math.max(0, this.stats.energy + STRAY_ENERGY);
      return null;
    }
    const deltaMs = t - best.time;
    const j = judge(deltaMs) as Judgement;
    this.apply(best, j, t);
    return { lane, judgement: j, deltaMs };
  }

  private apply(n: Note, j: Judgement, t: number): void {
    n.judged = j;
    n.judgedAt = t;
    const s = this.stats;
    s[j]++;
    if (j === "miss") {
      s.streak = 0;
    } else {
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      s.score += POINTS[j] * multiplier(s.streak);
    }
    s.energy = Math.max(0, Math.min(ENERGY_MAX, s.energy + ENERGY[j]));
  }
}

export function accuracy(s: Stats): number {
  const total = s.perfect + s.good + s.miss;
  if (total === 0) return 0;
  return Math.round(((s.perfect + s.good * 0.5) / total) * 100);
}
