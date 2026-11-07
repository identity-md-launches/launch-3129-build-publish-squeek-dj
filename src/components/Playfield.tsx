import { useEffect, useRef } from "react";
import { LANES, type Engine } from "../lib/engine";

/** Lane colours for the canvas art and the pads. Kept in one place so both match. */
export const LANE_COLORS = ["#5cc8ff", "#6ee7b7", "#ffd166", "#b49cff"];
export const LANE_KEYS = ["D", "F", "J", "K"];
/** The hit line sits this far down the lane. */
export const HIT_LINE = 0.86;

interface Props {
  engine: Engine | null;
  running: boolean;
  reducedMotion: boolean;
  /** Called every frame while running, with the frame time. */
  onFrame: (now: number) => void;
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, engine: Engine | null, now: number, reducedMotion: boolean) {
  ctx.clearRect(0, 0, w, h);
  const laneW = w / LANES;
  const hitY = h * HIT_LINE;

  // Beat pulse on the hit line; off under reduced motion.
  let pulse = 0;
  if (engine && !reducedMotion) {
    for (const b of engine.beats) {
      const since = now - b;
      if (since >= 0 && since < 180) pulse = Math.max(pulse, 1 - since / 180);
    }
  }

  for (let i = 0; i < LANES; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(i * laneW, 0, laneW, h);
  }

  // Hit line and lane targets.
  ctx.fillStyle = `rgba(255,255,255,${0.35 + pulse * 0.4})`;
  ctx.fillRect(0, hitY - 1.5, w, 3);
  const r = Math.min(laneW * 0.3, 26);
  for (let i = 0; i < LANES; i++) {
    ctx.beginPath();
    ctx.arc(i * laneW + laneW / 2, hitY, r, 0, Math.PI * 2);
    ctx.strokeStyle = LANE_COLORS[i];
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (!engine) return;
  const pxPerMs = hitY / engine.travelMs;
  for (const n of engine.notes) {
    const x = n.lane * laneW + laneW / 2;
    if (n.judged === null) {
      const y = hitY - (n.time - now) * pxPerMs;
      if (y < -r || y > h + r) continue;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.86, 0, Math.PI * 2);
      ctx.fillStyle = LANE_COLORS[n.lane];
      ctx.fill();
    } else if (n.judged !== "miss") {
      // A hit note fades out where it was struck; reduced motion skips the expanding ring.
      const t = Math.min(1, (now - n.judgedAt) / 300);
      ctx.beginPath();
      ctx.arc(x, hitY, reducedMotion ? r : r * (1 + t * 0.6), 0, Math.PI * 2);
      ctx.strokeStyle = LANE_COLORS[n.lane];
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

export function Playfield({ engine, running, reducedMotion, onFrame }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let size = { w: 0, h: 0 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = { w: rect.width, h: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, size.w, size.h, engine, performance.now(), reducedMotion);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const loop = (now: number) => {
      frameRef.current(now);
      draw(ctx, size.w, size.h, engine, now, reducedMotion);
      raf = requestAnimationFrame(loop);
    };
    if (running) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [engine, running, reducedMotion]);

  return <canvas ref={canvasRef} className="playfield" aria-hidden="true" />;
}
