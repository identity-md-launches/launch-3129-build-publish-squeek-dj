import { rpmFromMilli } from "./tempo";

export const STATUS_URL = "https://api.squeekchain.com/v1/status";
export const POLL_MS = 3000;
/** With no successful response for this long, the feed counts as offline. */
export const OFFLINE_AFTER_MS = 10000;

export interface WheelReading {
  coreStatus: string;
  rpm: number;
  distanceMm: number;
  blockHeight: string | null;
  settledRound: string | null;
  freshness: string;
  counterEpoch: string;
  /** Age of the measurement when the server generated the response, in ms (server clock on both sides). */
  ageAtResponseMs: number;
  staleAfterMs: number;
  /** Local performance.now() when the response arrived. */
  receivedAt: number;
}

export type FeedHealth = "connecting" | "live" | "stale" | "offline";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Read the fields Squeek DJ needs from a /v1/status body. Returns null when the measurement is missing or malformed. */
export function parseStatus(body: unknown, receivedAt: number): WheelReading | null {
  if (!isRecord(body) || !isRecord(body.measurement)) return null;
  const m = body.measurement;
  const rpmMilli = num(m.rpmMilli);
  const distanceMm = num(m.distanceMm);
  const coreStatus = str(m.coreStatus);
  if (rpmMilli === null || distanceMm === null || coreStatus === null) return null;

  const observed = Date.parse(str(m.observedAt) ?? "");
  const generated = Date.parse(str(body.generatedAt) ?? "");
  const ageAtResponseMs =
    Number.isFinite(observed) && Number.isFinite(generated) ? Math.max(0, generated - observed) : Number.POSITIVE_INFINITY;

  const anchor = isRecord(body.builder) && isRecord(body.builder.anchor) ? body.builder.anchor : null;
  return {
    coreStatus,
    rpm: Math.max(0, rpmFromMilli(rpmMilli)),
    distanceMm,
    blockHeight: anchor ? str(anchor.blockHeight) : null,
    settledRound: anchor ? str(anchor.settledThroughRound) : null,
    freshness: str(m.freshness) ?? "unknown",
    counterEpoch: str(m.counterEpoch) ?? "",
    ageAtResponseMs,
    staleAfterMs: (num(m.staleAfterSeconds) ?? 120) * 1000,
    receivedAt,
  };
}

/** How old the measurement is right now. */
export function readingAge(r: WheelReading, now: number): number {
  return r.ageAtResponseMs + Math.max(0, now - r.receivedAt);
}

/** `failures` counts requests that failed since the last success. */
export function feedHealth(reading: WheelReading | null, failures: number, now: number): FeedHealth {
  if (!reading) return failures > 0 ? "offline" : "connecting";
  if (now - reading.receivedAt > OFFLINE_AFTER_MS) return "offline";
  if (reading.freshness !== "online" || readingAge(reading, now) > reading.staleAfterMs) return "stale";
  return "live";
}

/** The hamster counts as idle when the core reports IDLE or the wheel is not turning. */
export function isIdle(r: WheelReading): boolean {
  return r.coreStatus.toUpperCase() === "IDLE" || r.rpm === 0;
}

/**
 * Adds up the real distance between consecutive readings. A counter reset (new epoch, or a smaller total)
 * starts a new baseline instead of counting a negative or invented distance.
 */
export class DistanceTally {
  private epoch: string | null = null;
  private last: number | null = null;
  totalMm = 0;

  add(r: WheelReading): void {
    if (this.epoch === r.counterEpoch && this.last !== null && r.distanceMm >= this.last) {
      this.totalMm += r.distanceMm - this.last;
    }
    this.epoch = r.counterEpoch;
    this.last = r.distanceMm;
  }
}

export function formatDistance(mm: number): string {
  if (mm < 1000) return `${Math.round(mm)} mm`;
  const m = mm / 1000;
  if (m < 1000) return `${m.toFixed(m < 100 ? 1 : 0)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function formatCoreStatus(s: string): string {
  const lower = s.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
