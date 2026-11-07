import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DistanceTally, feedHealth, formatDistance, isIdle, parseStatus, readingAge } from "./feed";
import { rpmToBpm } from "./tempo";

const body = (over: Record<string, unknown> = {}) => ({
  generatedAt: "2026-11-07T22:14:18.594Z",
  measurement: {
    freshness: "online",
    observedAt: "2026-11-07T22:14:02.248Z",
    staleAfterSeconds: 120,
    counterEpoch: "epoch-a",
    coreStatus: "RUNNING",
    rpmMilli: 72500,
    distanceMm: 803370,
    ...over,
  },
  builder: { anchor: { blockHeight: "2110", settledThroughRound: "589" } },
});

const responseTime = Date.parse(body().generatedAt);
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(responseTime);
});
afterEach(() => vi.useRealTimers());

describe("parseStatus", () => {
  it("reads RPM, distance, block height and settled round", () => {
    const r = parseStatus(body(), 1000)!;
    expect(r.rpm).toBe(72.5);
    expect(r.distanceMm).toBe(803370);
    expect(r.blockHeight).toBe("2110");
    expect(r.settledRound).toBe("589");
    expect(Math.round(r.ageAtResponseMs)).toBe(16346);
  });

  it("rejects a body without a measurement", () => {
    expect(parseStatus({}, 0)).toBeNull();
    expect(parseStatus({ measurement: { rpmMilli: "x" } }, 0)).toBeNull();
  });
});

describe("feedHealth", () => {
  it("is connecting before any answer and offline after failures", () => {
    expect(feedHealth(null, 0, 0)).toBe("connecting");
    expect(feedHealth(null, 2, 0)).toBe("offline");
  });

  it("is live for a fresh reading, stale when old, offline when nothing new arrives", () => {
    const r = parseStatus(body(), 1000)!;
    expect(feedHealth(r, 0, 2000)).toBe("live");
    expect(feedHealth(parseStatus(body({ observedAt: "2026-11-07T22:10:00.000Z" }), 1000), 0, 2000)).toBe("stale");
    expect(feedHealth(parseStatus(body({ freshness: "stale" }), 1000), 0, 2000)).toBe("stale");
    expect(feedHealth(r, 3, 1000 + 11000)).toBe("offline");
  });

  it("counts the age of an old response at receipt, even when the server calls it online", () => {
    const frozen = {
      ...body({ observedAt: new Date(responseTime - 601000).toISOString() }),
      generatedAt: new Date(responseTime - 600000).toISOString(),
    };
    const r = parseStatus(frozen, 1000)!;
    expect(readingAge(r, 1000)).toBe(601000);
    expect(feedHealth(r, 0, 1000)).toBe("stale");
  });

  it("keeps aging the same observation through 44 successful polls even with a fixed wall clock", () => {
    const frozen = body({ observedAt: new Date(responseTime - 1000).toISOString() });
    let r = parseStatus(frozen, 0)!;
    expect(feedHealth(r, 0, 0)).toBe("live");
    for (let poll = 1; poll <= 44; poll++) r = parseStatus(frozen, poll * 3000, r)!;
    expect(readingAge(r, 132000)).toBe(133000);
    expect(feedHealth(r, 0, 132000)).toBe("stale");
    expect(feedHealth(r, 0, 143000)).toBe("offline");
  });

  it("does not make a stale observation fresh after the wall clock moves backwards", () => {
    vi.setSystemTime(responseTime + 180000);
    const old = parseStatus(body(), 1000)!;
    vi.setSystemTime(responseTime);
    const repeated = parseStatus(body(), 4000, old)!;
    expect(readingAge(repeated, 4000)).toBe(readingAge(old, 4000));
    expect(feedHealth(repeated, 0, 4000)).toBe("stale");
  });

  it("recovers when a newer observation arrives in the same epoch", () => {
    const old = parseStatus(body({ observedAt: new Date(responseTime - 180000).toISOString() }), 0)!;
    expect(feedHealth(old, 0, 0)).toBe("stale");
    const fresh = parseStatus(body({ observedAt: new Date(responseTime - 1000).toISOString() }), 3000, old)!;
    expect(readingAge(fresh, 3000)).toBe(1000);
    expect(feedHealth(fresh, 0, 3000)).toBe("live");
  });

  it("does not carry observation age across counter epochs", () => {
    const fixed = body({ observedAt: new Date(responseTime - 1000).toISOString() });
    const first = parseStatus(fixed, 0)!;
    const stale = parseStatus(fixed, 123000, first)!;
    const reset = parseStatus({ ...fixed, measurement: { ...fixed.measurement, counterEpoch: "epoch-b" } }, 126000, stale)!;
    expect(readingAge(reset, 126000)).toBe(1000);
    expect(feedHealth(reset, 0, 126000)).toBe("live");
  });

  it("keeps server observation age when the client clock is behind, and treats missing timestamps as stale", () => {
    vi.setSystemTime(responseTime - 600000);
    const r = parseStatus(body(), 1000)!;
    expect(readingAge(r, 1000)).toBe(16346);
    expect(feedHealth(parseStatus(body({ observedAt: null }), 1000), 0, 1000)).toBe("stale");
    expect(feedHealth(parseStatus({ ...body(), generatedAt: null }, 1000), 0, 1000)).toBe("stale");
  });
});

describe("idle and tempo", () => {
  it("treats IDLE or zero RPM as idle", () => {
    expect(isIdle(parseStatus(body({ coreStatus: "IDLE" }), 0)!)).toBe(true);
    expect(isIdle(parseStatus(body({ rpmMilli: 0 }), 0)!)).toBe(true);
    expect(isIdle(parseStatus(body(), 0)!)).toBe(false);
  });

  it("clamps the tempo to 48–176 BPM", () => {
    expect(rpmToBpm(0)).toBe(48);
    expect(rpmToBpm(72.5)).toBe(73);
    expect(rpmToBpm(400)).toBe(176);
  });
});

describe("DistanceTally", () => {
  it("adds real deltas and restarts on a counter reset", () => {
    const t = new DistanceTally();
    t.add(parseStatus(body({ distanceMm: 1000 }), 0)!);
    t.add(parseStatus(body({ distanceMm: 1600 }), 0)!);
    t.add(parseStatus(body({ distanceMm: 50, counterEpoch: "epoch-b" }), 0)!);
    t.add(parseStatus(body({ distanceMm: 250, counterEpoch: "epoch-b" }), 0)!);
    expect(t.totalMm).toBe(800);
    expect(formatDistance(800)).toBe("800 mm");
    expect(formatDistance(803370)).toBe("803 m");
  });
});
