import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MockSocketProvider } from '../shared/context/SocketContext';
import TriviaTV from '../games/trivia/TriviaTV';
import '../index.css';

const SHORT_EXPLANATION = 'Named for the pigment that captures sunlight.';

const LONG_EXPLANATION =
  'Plants convert light energy into chemical energy, producing glucose and releasing oxygen as a byproduct of the reaction.';

// At the 300-character hard max (ends on a single period)
const MAX_EXPLANATION =
  'Plants convert light energy into chemical energy via chlorophyll, producing glucose for growth and releasing oxygen as a byproduct. This reaction underpins nearly all food webs on Earth and keeps atmospheric oxygen levels high enough for animals to breathe comfortably worldwide each and every day.';

const CHOICES = ['Respiration', 'Photosynthesis', 'Transpiration', 'Fermentation'];

const PLAYERS = [
  { id: 'p1', name: 'Ada', avatarId: 'avatar_00' },
  { id: 'p2', name: 'Ben', avatarId: 'avatar_05' },
  { id: 'p3', name: 'Cara', avatarId: 'avatar_13' },
  { id: 'p4', name: 'Dee', avatarId: 'avatar_20' },
];

function explanationFor(mode) {
  if (mode === 'short') return SHORT_EXPLANATION;
  if (mode === 'max') return MAX_EXPLANATION;
  return LONG_EXPLANATION;
}

function buildGameState({ explanation, explanationVisible, withImage, textMode, correctIndex }) {
  return {
    phase: 'reveal',
    round: 2,
    totalRounds: 3,
    roundName: 'Medium',
    questionNum: 2,
    totalQuestions: 5,
    question: 'What process do plants use to make food from sunlight?',
    image: withImage
      ? 'https://commons.wikimedia.org/wiki/Special:FilePath/Photosynthesis_en.svg?width=640'
      : null,
    choices: CHOICES,
    correctIndex,
    choiceCounts: [1, 3, 0, 1],
    explanation: explanation ? explanationFor(textMode) : null,
    explanationVisible: explanation ? explanationVisible : false,
    playerResults: [
      { name: 'Ada', correct: true, avatarId: 'avatar_00', choiceIndex: correctIndex },
      { name: 'Ben', correct: false, avatarId: 'avatar_05', choiceIndex: 0 },
      { name: 'Cara', correct: true, avatarId: 'avatar_13', choiceIndex: correctIndex },
      { name: 'Dee', correct: true, avatarId: 'avatar_20', choiceIndex: correctIndex },
    ],
    scores: { p1: 2, p2: 1, p3: 3, p4: 2 },
    earlyEnd: false,
    timer: null,
  };
}

function Preview() {
  const [hasExplanation, setHasExplanation] = useState(true);
  const [visible, setVisible] = useState(true);
  const [withImage, setWithImage] = useState(false);
  const [textMode, setTextMode] = useState('long'); // short | long | max
  const [correctIndex, setCorrectIndex] = useState(1);
  const [animKey, setAnimKey] = useState(0);

  const gameState = buildGameState({
    explanation: hasExplanation,
    explanationVisible: visible,
    withImage,
    textMode,
    correctIndex,
  });

  function replayPopIn(mode) {
    if (mode) setTextMode(mode);
    setHasExplanation(true);
    setVisible(false);
    requestAnimationFrame(() => {
      setTimeout(() => {
        setVisible(true);
        setAnimKey((k) => k + 1);
      }, 50);
    });
  }

  return (
    <MockSocketProvider sessionState={{ gameCode: 'DEV00' }}>
      <div className="relative h-screen w-screen overflow-hidden">
        <TriviaTV key={animKey} gameState={gameState} players={PLAYERS} />

        <div
          className="absolute left-3 top-3 z-50 flex flex-wrap items-center bg-black/80 text-white text-sm"
          style={{ padding: '8px 10px', maxWidth: '92vw' }}
        >
          <span className="font-bold" style={{ marginRight: 12 }}>Reveal preview</span>
          <label className="flex items-center" style={{ marginRight: 10 }}>
            <input
              type="checkbox"
              checked={hasExplanation}
              onChange={(e) => {
                setHasExplanation(e.target.checked);
                if (!e.target.checked) setVisible(false);
                else setVisible(true);
              }}
              style={{ marginRight: 4 }}
            />
            explanation
          </label>
          <label className="flex items-center" style={{ marginRight: 10 }}>
            <input
              type="checkbox"
              checked={visible}
              disabled={!hasExplanation}
              onChange={(e) => setVisible(e.target.checked)}
              style={{ marginRight: 4 }}
            />
            visible
          </label>
          <label className="flex items-center" style={{ marginRight: 10 }}>
            Letter
            <select
              value={correctIndex}
              onChange={(e) => setCorrectIndex(Number(e.target.value))}
              style={{ marginLeft: 4, color: '#000' }}
            >
              {CHOICES.map((c, i) => (
                <option key={c} value={i}>{['A', 'B', 'C', 'D'][i]} - {c}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center" style={{ marginRight: 10 }}>
            Text
            <select
              value={textMode}
              disabled={!hasExplanation}
              onChange={(e) => setTextMode(e.target.value)}
              style={{ marginLeft: 4, color: '#000' }}
            >
              <option value="short">short</option>
              <option value="long">long</option>
              <option value="max">max 300 chars</option>
            </select>
          </label>
          <label className="flex items-center" style={{ marginRight: 10 }}>
            <input
              type="checkbox"
              checked={withImage}
              onChange={(e) => setWithImage(e.target.checked)}
              style={{ marginRight: 4 }}
            />
            image
          </label>
          <button
            type="button"
            onClick={() => replayPopIn()}
            className="bg-accent text-white font-semibold"
            style={{ padding: '4px 10px', border: 'none', cursor: 'pointer', marginRight: 6 }}
          >
            Replay pop-in
          </button>
          <button
            type="button"
            onClick={() => replayPopIn('max')}
            className="bg-accent text-white font-semibold"
            style={{ padding: '4px 10px', border: 'none', cursor: 'pointer' }}
          >
            Replay max (300)
          </button>
          {hasExplanation && (
            <span style={{ marginLeft: 10, opacity: 0.7 }}>
              {explanationFor(textMode).length} chars
            </span>
          )}
        </div>
      </div>
    </MockSocketProvider>
  );
}

createRoot(document.getElementById('root')).render(<Preview />);
