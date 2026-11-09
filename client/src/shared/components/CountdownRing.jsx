import './CountdownRing.css';

const R = 42;
const CIRCUMFERENCE = 2 * Math.PI * R;

/*
  Circular countdown: a ring on a translucent dark face (matching the TV
  panels) with the seconds left in the middle. The ring empties clockwise from
  12 o'clock and turns red for the last `lowAt` seconds.

  `size` is in vh so the ring scales with the display.
*/
export default function CountdownRing({ remaining, duration, lowAt = 5, size = 7, className = '' }) {
  const frac = duration > 0 ? Math.min(1, Math.max(0, remaining / duration)) : 0;
  const low = remaining > 0 && remaining <= lowAt;

  return (
    <div
      className={`cr ${low ? 'cr--low' : ''} ${className}`.trim()}
      style={{ width: `${size}vh`, height: `${size}vh` }}
      role="timer"
      aria-label={`${remaining} seconds left`}
    >
      <svg className="cr-svg" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="cr-face" cx="50" cy="50" r="50" />
        <circle className="cr-track" cx="50" cy="50" r={R} />
        <circle
          className="cr-ring"
          cx="50"
          cy="50"
          r={R}
          transform="rotate(-90 50 50)"
          strokeDasharray={CIRCUMFERENCE}
          // Negative offset hides the elapsed part at the start of the path,
          // so the remaining arc always ends at 12 o'clock.
          strokeDashoffset={-CIRCUMFERENCE * (1 - frac)}
        />
      </svg>
      <span className="cr-text" style={{ fontSize: `${size * 0.4}vh` }}>{remaining}</span>
    </div>
  );
}
