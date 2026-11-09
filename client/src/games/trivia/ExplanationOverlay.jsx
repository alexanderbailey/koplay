import './ExplanationOverlay.css';

// Same hues as the answer tiles (CHOICE_BG in TriviaTV): red-600, blue-600, amber-500, teal-600.
// Hex, not Tailwind tokens, because they are set inline (no oklch on Chrome 63).
// Amber gets dark text: a paragraph of white on amber is hard to read across a room.
const COLOURS = [
  { fill: '#dc2626', ink: '#ffffff' },
  { fill: '#2563eb', ink: '#ffffff' },
  { fill: '#f59e0b', ink: '#16161f' },
  { fill: '#0d9488', ink: '#ffffff' },
];
const FALLBACK = { fill: '#16213e', ink: '#ffffff' };
const LABELS = ['A', 'B', 'C', 'D'];

/*
  Dim scrim + centred explanation panel. The panel is the highlighted correct
  answer tile grown large: solid answer colour with the same white ring, so it
  reads as part of the reveal rather than a separate dialog. Mark the correct bar/label with className "xp-winner" so they
  sit above the dim but under the panel. Pass `leaving` to play the exit
  animation before unmounting.
*/
export default function ExplanationOverlay({ index, answer, explanation, leaving = false }) {
  const { fill, ink } = COLOURS[index] || FALLBACK;
  const leave = leaving ? ' xp-leaving' : '';

  return (
    <>
      <div className={`xp-dim${leave}`} aria-hidden="true" />
      <div className="xp-popup">
        <div
          className={`xp-card${leave}`}
          style={{ backgroundColor: fill, color: ink }}
          role="status"
          aria-live="polite"
        >
          <p className="xp-label">Correct answer</p>
          <div className="xp-answer">
            <span className="xp-badge" style={{ backgroundColor: ink, color: fill }} aria-hidden="true">
              {LABELS[index]}
            </span>
            <h2 className="xp-heading">{answer}</h2>
          </div>
          <p className="xp-text">{explanation}</p>
        </div>
      </div>
    </>
  );
}
