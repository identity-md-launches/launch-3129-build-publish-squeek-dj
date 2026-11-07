// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

// The duration regression needs real App controls and clocks, but no network or canvas rendering.
vi.mock("./lib/useWheelFeed", () => ({
  useWheelFeed: () => ({ reading: null, health: "offline", revision: 0, now: 0 }),
}));
vi.mock("./components/Playfield", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./components/Playfield")>()),
  Playfield: () => null,
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => root.render(createElement(App)));
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  expect(button, `Button ${label}`).toBeDefined();
  await act(() => button!.click());
}

async function escape() {
  await act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" })); });
}

async function advance(ms: number) {
  await act(() => { vi.advanceTimersByTime(ms); });
}

function setLength() {
  const label = [...container.querySelectorAll(".summary dt")].find((dt) => dt.textContent === "Set length");
  return label?.nextElementSibling?.textContent;
}

describe("set duration", () => {
  it("excludes the outstanding pause when ending directly", async () => {
    await click("Practice at 100 BPM");
    await escape();
    await advance(5200);
    await click("End set");
    expect(setLength()).toBe("0:00");
  });

  it("reports the same duration after resuming and immediately pausing again", async () => {
    await click("Practice at 100 BPM");
    await escape();
    await advance(5200);
    await click("Resume");
    await escape();
    await click("End set");
    expect(setLength()).toBe("0:00");
  });

  it("counts played intervals and excludes both completed and outstanding pauses", async () => {
    await click("Practice at 100 BPM");
    await advance(1000);
    await click("Pause");
    await advance(5000);
    await click("Resume");
    await advance(2000);
    await escape();
    await advance(7000);
    await click("End set");
    expect(setLength()).toBe("0:03");
  });
});
