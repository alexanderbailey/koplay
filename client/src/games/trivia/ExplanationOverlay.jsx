import './ExplanationOverlay.css';

// Same hues as the answer tiles (CHOICE_BG in TriviaTV): red-600, blue-600, amber-500, teal-600.
// Hex, not Tailwind tokens, because they are set inline (no oklch on Chrome 63).
const ACCENTS = ['#dc2626', '#2563eb', '#f59e0b', '#0d9488'];
const LABELS = ['A', 'B', 'C', 'D'];

/*
  Dim scrim + centred explanation panel, styled like the other TV cards
  (rounded, translucent black, system font) with the correct answer's colour
  as the accent. Mark the correct bar/label with className "xp-winner" so they
  sit above the dim but under the panel. Pass `leaving` to play the exit
  animation before unmounting.
*/
export default function ExplanationOverlay({ index, answer, explanation, leaving = false }) {
  const accent = ACCENTS[index] || '#4ecdc4';
  const leave = leaving ? ' xp-leaving' : '';

  return (
    <>
      <div className={`xp-dim${leave}`} aria-hidden="true" />
      <div className="xp-popup">
        <div
          className={`xp-card${leave}`}
          style={{ borderTopColor: accent }}
          role="status"
          aria-live="polite"
        >
          <p className="xp-label">Correct answer</p>
          <div className="xp-answer">
            <span className="xp-badge" style={{ backgroundColor: accent }} aria-hidden="true">
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
