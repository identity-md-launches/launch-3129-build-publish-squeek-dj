import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { HelpDialog } from "./components/HelpDialog";
import { LANE_COLORS, LANE_KEYS, Playfield } from "./components/Playfield";
import { ScorePanel } from "./components/ScorePanel";
import { WheelHud } from "./components/WheelHud";
import { audioOn, sound, unlockAudio } from "./lib/audio";
import { accuracy, ENERGY_START, Engine, type JudgeEvent, type Stats } from "./lib/engine";
import { DistanceTally, formatDistance, isIdle } from "./lib/feed";
import { loadBest, loadSound, saveBest, saveSound, type Mode } from "./lib/storage";
import { PRACTICE_BPM, rpmToBpm } from "./lib/tempo";
import { useReducedMotion } from "./lib/useReducedMotion";
import { useWheelFeed } from "./lib/useWheelFeed";

/** A live set ends after the wheel has been still for this long. */
export const IDLE_END_MS = 12000;
/** A live set ends after the feed has been stale or unreachable for this long. */
export const FEED_END_MS = 20000;

type Phase = "ready" | "playing" | "paused" | "summary";
type EndReason = "idle" | "feed" | "energy" | "player";

interface Summary {
  mode: Mode;
  reason: EndReason;
  stats: Stats;
  durationMs: number;
  distanceMm: number | null;
  newBest: boolean;
}

interface Flash {
  key: number;
  lane: number;
  label: string;
  detail: string;
  kind: JudgeEvent["judgement"];
}

const REASON_TEXT: Record<EndReason, string> = {
  idle: "Squeektoshi stopped running, so the set ended.",
  feed: "The live feed went quiet for 20 seconds, so the set ended.",
  energy: "Your energy ran out.",
  player: "You ended the set.",
};

const KEY_TO_LANE: Record<string, number> = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
const emptyStats = (): Stats => ({ score: 0, streak: 0, bestStreak: 0, energy: ENERGY_START, perfect: 0, good: 0, miss: 0 });

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function App() {
  const feed = useWheelFeed();
  const reducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("ready");
  const [mode, setMode] = useState<Mode>("live");
  const [engine, setEngine] = useState<Engine | null>(null);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [songBpm, setSongBpm] = useState<number | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [pressed, setPressed] = useState<boolean[]>([false, false, false, false]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [soundOn, setSoundOn] = useState(loadSound);
  const [best, setBest] = useState(() => ({ live: loadBest("live"), practice: loadBest("practice") }));
  const [announcement, setAnnouncement] = useState("");

  const helpRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);
  const tally = useRef(new DistanceTally());
  const tallyHasReading = useRef(false);
  const idleSince = useRef<number | null>(null);
  const feedBadSince = useRef<number | null>(null);
  const pausedAt = useRef(0);
  const startedAt = useRef(0);
  const pausedTotal = useRef(0);
  const lastBeat = useRef(0);
  const beatCount = useRef(0);
  const flashKey = useRef(0);
  const ended = useRef(false);
  const live = useRef({ phase, mode, soundOn, health: feed.health });
  live.current = { phase, mode, soundOn, health: feed.health };

  const wheelBpm = feed.reading ? rpmToBpm(feed.reading.rpm) : null;
  const wheelIdle = feed.reading ? isIdle(feed.reading) : true;
  const canGoLive = feed.health === "live" && feed.reading !== null;

  const showJudgement = useCallback((ev: JudgeEvent) => {
    const label = ev.judgement === "perfect" ? "Perfect" : ev.judgement === "good" ? "Good" : "Miss";
    const ms = Math.round(Math.abs(ev.deltaMs));
    const detail = ev.judgement === "miss" ? "" : ms === 0 ? "On the beat" : `${ms} ms ${ev.deltaMs < 0 ? "early" : "late"}`;
    setFlash({ key: ++flashKey.current, lane: ev.lane, label, detail, kind: ev.judgement });
  }, []);

  const endSet = useCallback(
    (reason: EndReason) => {
      if (!engine || ended.current) return;
      ended.current = true;
      const playMode = live.current.mode;
      const final = { ...engine.stats };
      const newBest = saveBest(playMode, final.score);
      const finishedAt = live.current.phase === "paused" ? pausedAt.current : performance.now();
      if (newBest) setBest((b) => ({ ...b, [playMode]: final.score }));
      setSummary({
        mode: playMode,
        reason,
        stats: final,
        durationMs: finishedAt - startedAt.current - pausedTotal.current,
        distanceMm: tallyHasReading.current ? tally.current.totalMm : null,
        newBest,
      });
      setStats(final);
      // Clearing the engine empties the lanes behind the summary.
      setEngine(null);
      setPhase("summary");
      setAnnouncement(`Set over. ${REASON_TEXT[reason]} Score ${final.score}.`);
    },
    [engine],
  );

  const start = useCallback(
    (nextMode: Mode) => {
      const now = performance.now();
      const reading = feed.reading;
      const bpm = nextMode === "live" && reading ? rpmToBpm(reading.rpm) : PRACTICE_BPM;
      if (live.current.soundOn) unlockAudio();
      const e = new Engine({ startTime: now, bpm, seed: Math.floor(Math.random() * 1e9) });
      ended.current = false;
      tally.current = new DistanceTally();
      tallyHasReading.current = false;
      if (reading && feed.health !== "offline") {
        tally.current.add(reading);
        tallyHasReading.current = true;
      }
      idleSince.current = nextMode === "live" && reading && isIdle(reading) ? now : null;
      feedBadSince.current = null;
      startedAt.current = now;
      pausedTotal.current = 0;
      lastBeat.current = now;
      beatCount.current = 0;
      setMode(nextMode);
      setEngine(e);
      setStats({ ...e.stats });
      setSongBpm(bpm);
      setFlash(null);
      setSummary(null);
      setPhase("playing");
      setAnnouncement(nextMode === "live" ? `Live set started at ${bpm} BPM.` : `Practice started at ${PRACTICE_BPM} BPM.`);
      stageRef.current?.focus({ preventScroll: true });
    },
    [feed.reading, feed.health],
  );

  const pause = useCallback(() => {
    if (live.current.phase !== "playing") return;
    pausedAt.current = performance.now();
    setPhase("paused");
    setAnnouncement("Paused.");
  }, []);

  const resume = useCallback(() => {
    if (live.current.phase !== "paused" || !engine) return;
    const gap = performance.now() - pausedAt.current;
    engine.shift(gap);
    pausedTotal.current += gap;
    lastBeat.current += gap;
    if (idleSince.current !== null) idleSince.current += gap;
    if (feedBadSince.current !== null) feedBadSince.current += gap;
    setPhase("playing");
    setAnnouncement("Resumed.");
    stageRef.current?.focus({ preventScroll: true });
  }, [engine]);

  // Each new reading: count real distance, steer the live tempo and watch for a still wheel.
  useEffect(() => {
    const r = feed.reading;
    if (!r || (phase !== "playing" && phase !== "paused")) return;
    tally.current.add(r);
    tallyHasReading.current = true;
    if (mode !== "live" || !engine) return;
    engine.setTargetBpm(rpmToBpm(r.rpm));
    if (isIdle(r)) idleSince.current ??= performance.now();
    else idleSince.current = null;
  }, [feed.revision]);

  const onFrame = useCallback(
    (now: number) => {
      if (!engine) return;
      const misses = engine.update(now);
      const { soundOn: soundEnabled, mode: playMode, health } = live.current;
      for (const b of engine.beats) {
        if (b > lastBeat.current && b <= now) {
          lastBeat.current = b;
          if (soundEnabled) sound.beat(beatCount.current % 4 === 0);
          beatCount.current++;
        }
      }
      if (misses.length) {
        if (soundEnabled) sound.miss();
        showJudgement(misses[misses.length - 1]);
        setStats({ ...engine.stats });
      }
      setSongBpm((prev) => (prev === engine.bpm ? prev : engine.bpm));

      if (engine.energyEmpty) return endSet("energy");
      if (playMode !== "live") return;
      if (idleSince.current !== null && now - idleSince.current >= IDLE_END_MS) return endSet("idle");
      if (health !== "live") {
        feedBadSince.current ??= now;
        if (now - feedBadSince.current >= FEED_END_MS) return endSet("feed");
      } else {
        feedBadSince.current = null;
      }
    },
    [engine, endSet, showJudgement],
  );

  const press = useCallback(
    (lane: number, t: number) => {
      if (live.current.phase !== "playing" || !engine) return;
      setPressed((p) => p.map((v, i) => (i === lane ? true : v)));
      window.setTimeout(() => setPressed((p) => p.map((v, i) => (i === lane ? false : v))), 110);
      const ev = engine.hit(lane, t);
      setStats({ ...engine.stats });
      if (!ev) return;
      if (live.current.soundOn) sound.hit(lane, ev.judgement === "perfect");
      showJudgement(ev);
    },
    [engine, showJudgement],
  );

  // Keyboard: D F J K hit lanes, Escape pauses and resumes. Physical key codes keep the lanes put on any layout.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || helpRef.current?.open) return;
      const { phase: p } = live.current;
      if (e.code === "Escape") {
        if (p === "playing") pause();
        else if (p === "paused") resume();
        return;
      }
      const lane = KEY_TO_LANE[e.code];
      if (lane === undefined || p !== "playing") return;
      e.preventDefault();
      if (!e.repeat) press(lane, e.timeStamp);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, pause, resume]);

  // Leaving the tab pauses the set instead of counting a wall of misses.
  useEffect(() => {
    const onHide = () => document.hidden && pause();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [pause]);

  useEffect(() => {
    if (phase === "summary") summaryHeadingRef.current?.focus();
  }, [phase]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    saveSound(next);
    if (next) {
      unlockAudio();
      if (audioOn()) sound.hit(2, true);
    }
  };

  const openHelp = () => {
    pause();
    helpRef.current?.showModal();
  };

  const onPad = (lane: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    press(lane, e.timeStamp);
  };

  const playing = phase === "playing" || phase === "paused";
  const hudBpm = playing ? songBpm : wheelBpm;
  const hudBpmNote = playing
    ? mode === "live"
      ? "Song tempo, following the wheel"
      : "Practice tempo"
    : "Tempo a live set would start at";
  // One filled action: live when the wheel is turning and the feed is live, practice otherwise.
  const liveIsPrimary = canGoLive && !wheelIdle;

  const liveNote = !canGoLive
    ? feed.health === "connecting"
      ? "Live sets open once the wheel feed answers."
      : "Live sets need a fresh feed. Practice works any time."
    : wheelIdle
      ? "The wheel is still right now. A live set ends after 12 s of stillness."
      : `The wheel is turning. A live set starts at ${wheelBpm} BPM.`;

  const startActions = (
    <div className="actions">
      <button
        type="button"
        className={`btn ${liveIsPrimary ? "btn-primary" : "btn-secondary"}`}
        onClick={() => start("live")}
        disabled={!canGoLive}
        aria-describedby="live-note"
      >
        Start live set
      </button>
      <button type="button" className={`btn ${liveIsPrimary ? "btn-secondary" : "btn-primary"}`} onClick={() => start("practice")}>
        Practice at {PRACTICE_BPM} BPM
      </button>
      <p className="note" id="live-note">
        {liveNote}
      </p>
    </div>
  );

  const bests = (
    <p className="bests">
      Best score: live {best.live.toLocaleString("en-US")}, practice {best.practice.toLocaleString("en-US")}. Saved in this
      browser.
    </p>
  );

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          <img src="./favicon.svg" alt="" width="28" height="28" />
          Squeek DJ
        </h1>
        <div className="utilities">
          <button type="button" className="btn btn-ghost" aria-pressed={soundOn} onClick={toggleSound}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9h4l5-4v14l-5-4H4z" />
              {soundOn ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /> : <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />}
            </svg>
            <span className="sound-word">Sound</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={openHelp}>
            How to play
          </button>
        </div>
      </header>

      <main className="layout">
        <WheelHud reading={feed.reading} health={feed.health} now={feed.now} bpm={hudBpm} bpmNote={hudBpmNote} />

        <ScorePanel stats={stats} />

        <section className="stage-wrap" aria-label="Game">
          <div className="stage" ref={stageRef} tabIndex={-1}>
            <Playfield engine={engine} running={phase === "playing"} reducedMotion={reducedMotion} onFrame={onFrame} />

            {playing && (
              <div className="stage-bar">
                <span className="mode-tag">{mode === "live" ? "Live set" : `Practice, ${PRACTICE_BPM} BPM`}</span>
                {phase === "playing" ? (
                  <button type="button" className="btn btn-ghost btn-small" onClick={pause}>
                    Pause
                  </button>
                ) : null}
              </div>
            )}

            {flash && phase === "playing" && (
              <div key={flash.key} className={`judgement judgement-${flash.kind}`} aria-hidden="true">
                <span className="judgement-label">{flash.label}</span>
                {flash.detail && <span className="judgement-detail">{flash.detail}</span>}
              </div>
            )}

            {phase === "ready" && (
              <div className="overlay">
                <div className="overlay-body">
                  <h2 className="headline">One wheel turn, one beat.</h2>
                  <p className="lede">A four-lane rhythm game whose tempo follows Squeektoshi’s real hamster wheel.</p>
                  {startActions}
                  <p className="hint">Press D F J K or tap the pads as notes cross the line.</p>
                  {bests}
                </div>
              </div>
            )}

            {phase === "paused" && (
              <div className="overlay">
                <div className="overlay-body">
                  <h2 className="title">Paused</h2>
                  <div className="actions">
                    <button type="button" className="btn btn-primary" onClick={resume}>
                      Resume
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => endSet("player")}>
                      End set
                    </button>
                  </div>
                  <p className="hint">Escape also resumes.</p>
                </div>
              </div>
            )}

            {phase === "summary" && summary && (
              <div className="overlay">
                <div className="overlay-body">
                  <h2 className="title" ref={summaryHeadingRef} tabIndex={-1}>
                    {summary.newBest ? "New best score" : "Set over"}
                  </h2>
                  <p className="lede">
                    {REASON_TEXT[summary.reason]} Hits and misses count perfect / good / miss. Wheel distance is what the
                    real wheel covered during the set.
                  </p>
                  <dl className="summary">
                    <div>
                      <dt>Score</dt>
                      <dd>{summary.stats.score.toLocaleString("en-US")}</dd>
                    </div>
                    <div>
                      <dt>Best streak</dt>
                      <dd>{summary.stats.bestStreak}</dd>
                    </div>
                    <div>
                      <dt>Accuracy</dt>
                      <dd>{accuracy(summary.stats)}%</dd>
                    </div>
                    <div>
                      <dt>Hits and misses</dt>
                      <dd>
                        {summary.stats.perfect} / {summary.stats.good} / {summary.stats.miss}
                      </dd>
                    </div>
                    <div>
                      <dt>Set length</dt>
                      <dd>{formatDuration(summary.durationMs)}</dd>
                    </div>
                    <div>
                      <dt>Wheel distance</dt>
                      <dd>{summary.distanceMm === null ? "No feed" : formatDistance(summary.distanceMm)}</dd>
                    </div>
                  </dl>
                  {startActions}
                  {bests}
                </div>
              </div>
            )}
          </div>

          <div className="pads">
            {LANE_KEYS.map((key, lane) => (
              <button
                key={key}
                type="button"
                className={`pad${pressed[lane] ? " is-down" : ""}`}
                style={{ ["--lane" as string]: LANE_COLORS[lane] }}
                onPointerDown={onPad(lane)}
                onClick={(e) => e.detail === 0 && press(lane, e.timeStamp)}
                disabled={phase !== "playing"}
                aria-label={`Lane ${lane + 1}, key ${key}`}
              >
                {key}
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Squeek DJ is a community project for the Squeekchain Buildooooor badge. Live data from{" "}
          <a href="https://api.squeekchain.com/v1/status">api.squeekchain.com/v1/status</a>.
        </p>
      </footer>

      <p className="visually-hidden" role="status">
        {announcement}
      </p>
      <HelpDialog ref={helpRef} />
    </div>
  );
}
