import { describe, expect, it } from "vitest";
import { ENERGY_START, Engine, GOOD_MS, judge, multiplier, PERFECT_MS } from "./engine";

const firstNote = (e: Engine) => [...e.notes].sort((a, b) => a.time - b.time)[0];

describe("judge", () => {
  it("uses the 60 ms and 130 ms windows", () => {
    expect(judge(0)).toBe("perfect");
    expect(judge(-PERFECT_MS)).toBe("perfect");
    expect(judge(PERFECT_MS + 1)).toBe("good");
    expect(judge(-GOOD_MS)).toBe("good");
    expect(judge(GOOD_MS + 1)).toBeNull();
  });
});

describe("Engine", () => {
  it("schedules notes on the beat at the given tempo", () => {
    const e = new Engine({ startTime: 0, bpm: 120, travelMs: 1000, seed: 1 });
    e.update(10000);
    const beats = [...new Set(e.beats)].sort((a, b) => a - b);
    for (let i = 1; i < beats.length; i++) expect(beats[i] - beats[i - 1]).toBeCloseTo(500, 5);
  });

  it("scores a perfect and a good hit, and a missed note breaks the streak", () => {
    const e = new Engine({ startTime: 0, bpm: 120, travelMs: 1000, seed: 3 });
    e.update(1500);
    const n1 = firstNote(e);
    expect(e.hit(n1.lane, n1.time + 20)?.judgement).toBe("perfect");
    expect(e.stats.score).toBe(300);
    expect(e.stats.streak).toBe(1);

    const n2 = [...e.notes].filter((n) => n.judged === null).sort((a, b) => a.time - b.time)[0];
    expect(e.hit(n2.lane, n2.time - 100)?.judgement).toBe("good");
    expect(e.stats.streak).toBe(2);
    expect(e.stats.bestStreak).toBe(2);

    e.update(n2.time + 1);
    const n3 = [...e.notes].filter((n) => n.judged === null).sort((a, b) => a.time - b.time)[0];
    const events = e.update(n3.time + GOOD_MS + 1);
    expect(events.some((ev) => ev.judgement === "miss")).toBe(true);
    expect(e.stats.streak).toBe(0);
    expect(e.stats.bestStreak).toBe(2);
    expect(e.stats.energy).toBeLessThan(ENERGY_START);
  });

  it("ignores a press outside the Good window", () => {
    const e = new Engine({ startTime: 0, bpm: 100, travelMs: 1000, seed: 5 });
    e.update(1500);
    const n = firstNote(e);
    expect(e.hit(n.lane, n.time - GOOD_MS - 5)).toBeNull();
    expect(e.hit((n.lane + 1) % 4, n.time)).toBeNull();
    expect(e.stats.energy).toBe(ENERGY_START - 4);
  });

  it("glides toward a new target tempo one beat at a time", () => {
    const e = new Engine({ startTime: 0, bpm: 60, travelMs: 500, seed: 2 });
    e.setTargetBpm(120);
    e.update(4000);
    expect(e.bpm).toBeGreaterThan(60);
    e.update(60000);
    expect(e.bpm).toBe(120);
  });

  it("empties energy after repeated misses", () => {
    const e = new Engine({ startTime: 0, bpm: 176, travelMs: 500, seed: 9 });
    e.update(30000);
    expect(e.energyEmpty).toBe(true);
  });

  it("shift moves every scheduled note after a pause", () => {
    const e = new Engine({ startTime: 0, bpm: 120, travelMs: 1000, seed: 4 });
    e.update(1500);
    const before = firstNote(e).time;
    e.shift(5000);
    expect(firstNote(e).time).toBe(before + 5000);
  });

  it("raises the multiplier every 10 in a row, capped at 4", () => {
    expect(multiplier(0)).toBe(1);
    expect(multiplier(10)).toBe(2);
    expect(multiplier(99)).toBe(4);
  });
});
