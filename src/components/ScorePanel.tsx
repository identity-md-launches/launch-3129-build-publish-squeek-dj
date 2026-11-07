import { ENERGY_MAX, multiplier, type Stats } from "../lib/engine";

interface Props {
  stats: Stats;
}

export function ScorePanel({ stats }: Props) {
  const mult = multiplier(stats.streak);
  const low = stats.energy <= 20;
  return (
    <section className="score panel" aria-label="Score">
      <dl className="stats score-stats">
        <div className="stat">
          <dt>Score</dt>
          <dd>{stats.score.toLocaleString("en-US")}</dd>
        </div>
        <div className="stat">
          <dt>Streak</dt>
          <dd>
            {stats.streak}
            {mult > 1 && <span className="mult"> ×{mult}</span>}
          </dd>
        </div>
        <div className="stat">
          <dt>Best streak</dt>
          <dd>{stats.bestStreak}</dd>
        </div>
      </dl>
      <div className="energy">
        <span className="energy-label" id="energy-label">
          Energy
        </span>
        <div
          className="meter"
          role="meter"
          aria-labelledby="energy-label"
          aria-valuemin={0}
          aria-valuemax={ENERGY_MAX}
          aria-valuenow={stats.energy}
          aria-valuetext={`${stats.energy} of ${ENERGY_MAX}${low ? ", low" : ""}`}
        >
          <div className={`meter-fill${low ? " is-low" : ""}`} style={{ inlineSize: `${(stats.energy / ENERGY_MAX) * 100}%` }} />
        </div>
        <span className="energy-value">{stats.energy}</span>
      </div>
    </section>
  );
}
