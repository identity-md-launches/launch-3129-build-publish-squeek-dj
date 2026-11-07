import { formatCoreStatus, formatDistance, readingAge, type FeedHealth, type WheelReading } from "../lib/feed";

interface Props {
  reading: WheelReading | null;
  health: FeedHealth;
  now: number;
  /** The song tempo right now, or the tempo a live set would start at. */
  bpm: number | null;
  bpmNote: string;
}

const HEALTH_LABEL: Record<FeedHealth, string> = {
  connecting: "Connecting",
  live: "Live",
  stale: "Stale",
  offline: "Offline",
};

function ageText(reading: WheelReading | null, health: FeedHealth, now: number): string {
  if (health === "connecting") return "Reaching the wheel feed";
  if (!reading) return "Feed unreachable, retrying every 3 s";
  const s = Math.round(readingAge(reading, now) / 1000);
  const age = Number.isFinite(s) ? `Measured ${s < 60 ? `${s} s` : `${Math.round(s / 60)} min`} ago` : "Measurement time unknown";
  if (health === "offline") return `Feed unreachable. Last reading: ${age.toLowerCase()}`;
  return age;
}

export function WheelHud({ reading, health, now, bpm, bpmNote }: Props) {
  const dash = "–";
  return (
    <section className="hud panel" aria-labelledby="hud-title">
      <div className="hud-head">
        <h2 id="hud-title">Squeektoshi’s wheel</h2>
        <p className={`feed feed-${health}`}>
          <span className="feed-dot" aria-hidden="true" />
          <span className="feed-label">{HEALTH_LABEL[health]}</span>
        </p>
      </div>
      <p className="hud-age">{ageText(reading, health, now)}</p>
      <dl className="stats">
        <div className="stat">
          <dt>Core status</dt>
          <dd>{reading ? formatCoreStatus(reading.coreStatus) : dash}</dd>
        </div>
        <div className="stat">
          <dt>RPM</dt>
          <dd>{reading ? reading.rpm.toFixed(1) : dash}</dd>
        </div>
        <div className="stat">
          <dt title={bpmNote}>BPM</dt>
          <dd>{bpm ?? dash}</dd>
        </div>
        <div className="stat">
          <dt>Distance tonight</dt>
          <dd>{reading ? formatDistance(reading.distanceMm) : dash}</dd>
        </div>
        <div className="stat">
          <dt>Block height</dt>
          <dd>{reading?.blockHeight ?? dash}</dd>
        </div>
        <div className="stat">
          <dt>Settled round</dt>
          <dd>{reading?.settledRound ?? dash}</dd>
        </div>
      </dl>
    </section>
  );
}
