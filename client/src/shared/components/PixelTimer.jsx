import { useEffect, useMemo, useRef, useState } from 'react';
import './PixelTimer.css';

/*
  Pixel-art countdown dial on a 25x25 grid.
  The ring empties clockwise from 12 o'clock and the hand points at the
  boundary between used and remaining time.
*/

const N = 25;
const C = N / 2;
const TAU = Math.PI * 2;
const sq = (x, y) => `M${x} ${y}h1v1h-1z`;

/* Static geometry: built once */
const GEOMETRY = (() => {
  let black = '';
  let face = '';
  const ring = []; // { x, y, f } where f = angle as a fraction of a turn
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - C;
      const dy = y + 0.5 - C;
      const r = Math.hypot(dx, dy);
      if (r > 12.5) continue;
      if (r > 11.3) { black += sq(x, y); continue; } // outer outline
      if (r > 8.3) { // progress ring
        let a = Math.atan2(dx, -dy);
        if (a < 0) a += TAU;
        ring.push({ x, y, f: a / TAU });
        continue;
      }
      if (r > 7.3) { black += sq(x, y); continue; } // inner outline
      if (r > 5.3 && (dx === 0 || dy === 0)) { black += sq(x, y); continue; } // 12/3/6/9 ticks
      face += sq(x, y);
    }
  }
  return { black, face, ring };
})();

const HUB = sq(11, 12) + sq(13, 12) + sq(12, 11) + sq(12, 13);

function handPath(frac) {
  const a = frac * TAU;
  const seen = new Set();
  let d = '';
  for (let t = 0; t <= 6.3; t += 0.2) {
    const hx = Math.floor(C + Math.sin(a) * t);
    const hy = Math.floor(C - Math.cos(a) * t);
    const k = hx * 100 + hy;
    if (!seen.has(k)) {
      seen.add(k);
      d += sq(hx, hy);
    }
  }
  return d + HUB;
}

/*
  PixelTimer: purely presentational.
  progress = fraction of time ELAPSED (0 = full, 1 = empty).
*/
export function PixelTimer({ progress = 0, low = false, label, className = '', style }) {
  const p = Math.min(1, Math.max(0, progress));

  const { fill, track } = useMemo(() => {
    let fillPath = '';
    let trackPath = '';
    for (const c of GEOMETRY.ring) {
      if (c.f < p) trackPath += sq(c.x, c.y);
      else fillPath += sq(c.x, c.y);
    }
    return { fill: fillPath, track: trackPath };
  }, [p]);

  const hand = useMemo(() => handPath(p), [p]);

  return (
    <div className={`pt ${low ? 'pt--low' : ''} ${className}`.trim()} style={style}>
      <svg
        className="pt-dial"
        viewBox={`0 0 ${N} ${N}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={label || `${Math.round((1 - p) * 100)}% of time remaining`}
      >
        <path className="pt-face" d={GEOMETRY.face} />
        {track ? <path className="pt-track" d={track} /> : null}
        {fill ? <path className="pt-fill" d={fill} /> : null}
        <path className="pt-ink" d={GEOMETRY.black} />
        <path className="pt-ink" d={hand} />
      </svg>
    </div>
  );
}

/*
  useCountdown: drives the timer with requestAnimationFrame.
  tick = true  -> hand and ring jump once per second (clock-like, retro)
  tick = false -> smooth sweep (still pixel-quantised by the grid)
  To restart, change the component's `key`.
*/
export function useCountdown(duration, { running = true, tick = true, onComplete } = {}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;

  useEffect(() => {
    if (!running || elapsedRef.current >= duration) return;
    const start = performance.now() - elapsedRef.current * 1000;
    let raf;
    const loop = (now) => {
      const e = Math.min(duration, (now - start) / 1000);
      elapsedRef.current = e;
      // Same value = no re-render, so tick mode renders once per second
      setElapsed(tick ? Math.floor(e) : Math.round(e * 30) / 30);
      if (e >= duration) {
        if (doneRef.current) doneRef.current();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, duration, tick]);

  const remaining = Math.max(0, duration - elapsed);
  return { elapsed, remaining, progress: duration ? elapsed / duration : 1 };
}

/* PixelCountdown: timer + timing in one */
export function PixelCountdown({
  duration = 30,
  running = true,
  tick = true,
  lowAt = 5,
  onComplete,
  ...rest
}) {
  const { remaining, progress } = useCountdown(duration, { running, tick, onComplete });
  const secondsLeft = Math.ceil(remaining);
  return (
    <PixelTimer
      progress={progress}
      low={remaining > 0 && secondsLeft <= lowAt}
      label={`${secondsLeft} seconds left`}
      {...rest}
    />
  );
}

export default PixelCountdown;
