import { describe, expect, it } from "vitest";
import { DistanceTally, feedHealth, formatDistance, isIdle, parseStatus } from "./feed";
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
