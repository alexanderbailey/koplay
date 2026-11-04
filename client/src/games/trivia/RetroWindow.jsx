import './RetroWindow.css';

/*
  Match TriviaTV CHOICE_BG / CHOICE_BAR palette.
  `shadow` is a dark shade of accent (no color-mix - Chrome 63 / Tizen 5).
*/
export const ANSWER_COLOURS = {
  A: { accent: '#dc2626', ink: '#ffffff', shadow: '#580f0f' },
  B: { accent: '#2563eb', ink: '#ffffff', shadow: '#0f2c5e' },
  C: { accent: '#f59e0b', ink: '#16161f', shadow: '#623f04' },
  D: { accent: '#0d9488', ink: '#ffffff', shadow: '#053b36' },
};

/* 3x3 pixel X, purely decorative */
const PixelX = () => (
  <svg className="qa-x" viewBox="0 0 3 3" shapeRendering="crispEdges" aria-hidden="true">
    <path fill="currentColor" d="M0 0h1v1H0zM2 0h1v1H2zM1 1h1v1H1zM0 2h1v1H0zM2 2h1v1H2z" />
  </svg>
);

/*
  QuizAnswer: the popup card itself.
  Pass `accent` / `ink` / `shadow` to override the colour picked from `letter`.
*/
export function QuizAnswer({
  letter = 'B',
  answer = 'Photosynthesis',
  explanation = 'Plants convert light energy into chemical energy, producing glucose and releasing oxygen as a byproduct of the reaction.',
  label = 'CORRECT ANSWER',
  accent,
  ink,
  shadow,
  className = '',
  style,
}) {
  const colours = ANSWER_COLOURS[letter] || ANSWER_COLOURS.B;
  const vars = Object.assign({}, style, {
    '--qa-accent': accent || colours.accent,
    '--qa-ink': ink || colours.ink,
    '--qa-shadow': shadow || colours.shadow,
  });

  return (
    <div className={`qa ${className}`.trim()} style={vars} role="status" aria-live="polite">
      <div className="qa-frame">
        <div className="qa-inner">
          <div className="qa-bar">
            <span className="qa-label">{label}</span>
            <PixelX />
          </div>
          <div className="qa-body">
            <div className="qa-answer">
              <div className="qa-tile" aria-hidden="true">{letter}</div>
              <h2 className="qa-heading">
                <span className="qa-sr">Answer {letter}: </span>
                {answer}
              </h2>
            </div>
            <p className="qa-text">{explanation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/*
  Dim scrim + centered card as separate layers.
  Mark the correct bar/label with className "qa-winner" so they sit above the
  dim (z-25) but still under the popup (z-40).
*/
export function QuizAnswerOverlay(props) {
  return (
    <>
      <div className="qa-dim" aria-hidden="true" />
      <div className="qa-popup">
        <QuizAnswer {...props} />
      </div>
    </>
  );
}

export default QuizAnswer;
