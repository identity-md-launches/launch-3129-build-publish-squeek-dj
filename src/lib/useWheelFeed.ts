import { useEffect, useState } from "react";
import { feedHealth, parseStatus, POLL_MS, STATUS_URL, type FeedHealth, type WheelReading } from "./feed";

export interface WheelFeed {
  reading: WheelReading | null;
  health: FeedHealth;
  /** Bumps on every successful response, so effects can react to a new reading. */
  revision: number;
  /** Local time the clock was last read, for "updated N s ago". */
  now: number;
}

/** Polls the live wheel status about every 3 seconds and re-evaluates freshness every second. */
export function useWheelFeed(): WheelFeed {
  const [reading, setReading] = useState<WheelReading | null>(null);
  const [failures, setFailures] = useState(0);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;
    let previousReading: WheelReading | null = null;

    const poll = async () => {
      if (document.hidden) {
        timer = window.setTimeout(poll, POLL_MS);
        return;
      }
      controller = new AbortController();
      const abort = window.setTimeout(() => controller?.abort(), 8000);
      try {
        const res = await fetch(STATUS_URL, { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = parseStatus(await res.json(), performance.now(), previousReading);
        if (!parsed) throw new Error("Unreadable status");
        if (!stopped) {
          previousReading = parsed;
          setReading(parsed);
          setFailures(0);
          setRevision((r) => r + 1);
        }
      } catch {
        if (!stopped) setFailures((f) => f + 1);
      } finally {
        window.clearTimeout(abort);
        if (!stopped) timer = window.setTimeout(poll, POLL_MS);
      }
    };
    void poll();
    const tick = window.setInterval(() => setNow(performance.now()), 1000);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearTimeout(timer);
      window.clearInterval(tick);
    };
  }, []);

  return { reading, health: feedHealth(reading, failures, now), revision, now };
}
