import { useState, useEffect } from 'react';
import PlayAgainButton from '../../shared/components/PlayAgainButton';
import AVATARS from '../../shared/avatars';
import SOUNDS from '../../shared/sounds';
import PixelAvatar from '../../shared/components/PixelAvatar';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const CHOICE_BG = [
  'bg-red-600 active:bg-red-700',
  'bg-blue-600 active:bg-blue-700',
  'bg-amber-500 active:bg-amber-600',
  'bg-teal-600 active:bg-teal-700',
];
const CHOICE_BG_PLAIN = ['bg-red-600', 'bg-blue-600', 'bg-amber-500', 'bg-teal-600'];

function formatDate(ms) {
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const opts = d.getFullYear() === now.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return d.toLocaleDateString([], opts);
}

function TopicSelectPhase({ gs, isHost, emit }) {
  const [mode, setMode] = useState('list'); // 'list' | 'generate'
  const [topic, setTopic] = useState('');

  const quizzes = gs.savedQuizzes || [];

  if (!isHost) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-2xl font-bold">Trivia!</p>
        <p className="text-muted-light text-center">Waiting for host to pick a quiz...</p>
        {gs.error && <p className="text-red-400 text-center text-sm">{gs.error}</p>}
      </div>
    );
  }

  function handleLoad(quizId) {
    emit('game:action', { type: 'loadQuiz', quizId });
  }

  function handleDelete(quizId) {
    if (!confirm('Delete this quiz?')) return;
    emit('game:action', { type: 'deleteQuiz', quizId });
  }

  function handleGenerate(e) {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    emit('game:action', { type: 'generateQuiz', topic: t });
  }

  return (
    <div className="min-h-screen flex flex-col gap-4 p-4 pb-8">
      <h2 className="text-2xl font-bold mt-2">Pick a Quiz</h2>

      {gs.error && (
        <p className="text-red-400 text-center text-sm bg-red-900/30 rounded-lg p-2">{gs.error}</p>
      )}

      {quizzes.length === 0 ? (
        <p className="text-muted-light text-center text-sm">No quizzes available.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {quizzes.map((q) => (
            <li key={q.id} className="flex items-stretch bg-surface-light border border-muted/30 rounded-lg overflow-hidden">
              <button
                onClick={() => handleLoad(q.id)}
                className="flex-1 text-left px-4 py-3 active:bg-surface-light/70"
              >
                <div className="font-semibold text-white">{q.topic}</div>
                <div className="text-xs text-muted-light mt-0.5">
                  by {q.creator} · {formatDate(q.createdAt)}
                </div>
              </button>
              {q.canDelete && (
                <button
                  onClick={() => handleDelete(q.id)}
                  className="px-4 text-muted-light hover:text-red-400 active:bg-red-900/30"
                  aria-label="Delete quiz"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {mode === 'generate' && gs.canGenerate && (
        <form onSubmit={handleGenerate} className="flex flex-col gap-3 mt-2 p-4 bg-surface-light/50 border border-muted/30 rounded-lg">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic (e.g. The Beatles)"
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-surface-light border border-muted/30 text-white placeholder:text-muted"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('list')}
              className="flex-1 py-3 bg-surface-light border border-muted/30 text-muted-light rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!topic.trim()}
              className="flex-1 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg"
            >
              Generate
            </button>
          </div>
        </form>
      )}

      {mode === 'list' && gs.canGenerate && (
        <button
          onClick={() => setMode('generate')}
          className="mt-2 w-full py-3 bg-surface-light border border-muted/30 text-white rounded-lg active:bg-surface-light/70"
        >
          + Generate new quiz
        </button>
      )}
    </div>
  );
}

function GeneratingPhase({ gs }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-xl font-bold animate-pulse">Generating questions...</p>
      <p className="text-muted-light text-center">Topic: {gs.topic}</p>
      <p className="text-muted text-sm text-center">This may take a few seconds</p>
    </div>
  );
}

function CharacterSelectPhase({ gs, myId, isHost, players, emit }) {
  const [step, setStep] = useState('avatar'); // 'avatar' | 'noise'
  const [avatarId, setAvatarId] = useState(null);
  const [noiseId, setNoiseId] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const myPlayer = players.find((p) => p.id === myId);
  const alreadySelected = myPlayer?.avatarId && myPlayer?.noiseId;

  const takenAvatars = players.filter((p) => p.id !== myId).map((p) => p.avatarId).filter(Boolean);
  const takenNoises = players.filter((p) => p.id !== myId).map((p) => p.noiseId).filter(Boolean);

  function handleAvatarSelect(id) {
    if (takenAvatars.includes(id)) return;
    setAvatarId(id);
  }

  function handleNoiseSelect(sound) {
    if (takenNoises.includes(sound.id)) return;
    sound.play();
    setNoiseId(sound.id);
  }

  function handleConfirm() {
    if (avatarId && noiseId) {
      emit('game:action', { type: 'selectCharacter', avatarId, noiseId });
      setConfirmed(true);
    }
  }

  function handleStartGame() {
    emit('game:action', { type: 'startGame' });
  }

  // Already confirmed (either just now or from a previous submit that got reflected in state)
  if (confirmed || alreadySelected) {
    const avatar = AVATARS.find((a) => a.id === (myPlayer?.avatarId || avatarId));
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
        {avatar && <PixelAvatar avatar={avatar} size={72} />}
        <p className="text-xl font-bold text-teal">Ready!</p>
        <p className="text-muted-light">Waiting for host to start...</p>
        {isHost && (
          <button
            onClick={handleStartGame}
            className="mt-4 w-full max-w-xs py-4 bg-accent hover:bg-accent-hover text-white text-xl font-bold rounded-xl"
          >
            Start Quiz
          </button>
        )}
      </div>
    );
  }

  if (step === 'avatar') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-center mb-2">Choose Avatar</h2>
          <p className="text-muted-light text-center text-sm mb-6">Pick your character</p>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {AVATARS.map((avatar) => {
              const taken = takenAvatars.includes(avatar.id);
              const selected = avatarId === avatar.id;
              return (
                <button
                  key={avatar.id}
                  onClick={() => handleAvatarSelect(avatar.id)}
                  disabled={taken}
                  className={`flex items-center justify-center p-1.5 rounded-lg border-2 transition-colors ${
                    taken
                      ? 'opacity-25 border-muted/20 cursor-not-allowed'
                      : selected
                        ? 'border-accent bg-accent/20'
                        : 'border-muted/20 hover:border-muted/50'
                  }`}
                >
                  <PixelAvatar avatar={avatar} size={48} />
                </button>
              );
            })}
          </div>
          <button
            onClick={() => avatarId && setStep('noise')}
            disabled={!avatarId}
            className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-lg font-semibold rounded-lg transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  if (step === 'noise') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-center mb-2">Choose Sound</h2>
          <p className="text-muted-light text-center text-sm mb-6">Tap to preview, pick your noise</p>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {SOUNDS.map((sound) => {
              const taken = takenNoises.includes(sound.id);
              const selected = noiseId === sound.id;
              return (
                <button
                  key={sound.id}
                  onClick={() => handleNoiseSelect(sound)}
                  disabled={taken}
                  className={`flex items-center justify-center p-2 rounded-lg border-2 transition-colors ${
                    taken
                      ? 'opacity-25 border-muted/20 cursor-not-allowed'
                      : selected
                        ? 'border-accent bg-accent/20'
                        : 'border-muted/20 hover:border-muted/50'
                  }`}
                >
                  <span className="text-4xl">🔊</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('avatar')}
              className="flex-1 py-3 bg-surface-light border border-muted/30 text-muted-light text-lg font-semibold rounded-lg transition-colors hover:bg-surface-light/80"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={!noiseId}
              className="flex-1 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-lg font-semibold rounded-lg transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function QuestionPhase({ gs, emit }) {
  const [answered, setAnswered] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3000);
    return () => clearTimeout(t);
  }, []);

  function handleAnswer(index) {
    emit('game:action', { type: 'answer', index });
    setSelectedIndex(index);
    setAnswered(true);
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-2xl font-bold animate-pulse">Get Ready...</p>
      </div>
    );
  }

  if (answered) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="p-4 text-center text-white font-semibold bg-surface-light/80">
          Answer locked in!
        </div>
        <div className="grid grid-cols-2 flex-1">
          {gs.choices.map((choice, i) => (
            <div
              key={i}
              className={`flex flex-col items-center justify-center p-4 ${CHOICE_BG_PLAIN[i]} ${
                i === selectedIndex ? 'ring-4 ring-white ring-inset' : 'opacity-40'
              }`}
            >
              <span className="text-4xl font-black text-white/80">{CHOICE_LABELS[i]}</span>
              <span className="text-lg font-semibold text-white text-center mt-1">{choice}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-4 text-center text-white/60 text-sm bg-surface-light/50">
        Pick your answer!
      </div>
      <div className="grid grid-cols-2 flex-1">
        {gs.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(i)}
            className={`flex flex-col items-center justify-center p-4 ${CHOICE_BG[i]}`}
          >
            <span className="text-4xl font-black text-white/80">{CHOICE_LABELS[i]}</span>
            <span className="text-lg font-semibold text-white text-center mt-1">{choice}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TriviaPhone({ gameState: gs, myId, isHost, players, emit }) {
  const questionKey = `${gs.round}-${gs.questionNum}`;

  if (gs.phase === 'error') {
    return <p className="text-error text-center">{gs.message}</p>;
  }

  if (gs.phase === 'topicSelect') {
    return <TopicSelectPhase gs={gs} isHost={isHost} emit={emit} />;
  }

  if (gs.phase === 'generating') {
    return <GeneratingPhase gs={gs} />;
  }

  if (gs.phase === 'characterSelect') {
    return <CharacterSelectPhase gs={gs} myId={myId} isHost={isHost} players={players} emit={emit} />;
  }

  if (gs.phase === 'question') {
    return <QuestionPhase key={questionKey} gs={gs} emit={emit} />;
  }

  if (gs.phase === 'roundIntro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-3xl font-black">{gs.roundName}</p>
        <p className="text-muted-light">Round {gs.round} of {gs.totalRounds}</p>
        {isHost && (
          <button
            onClick={() => emit('game:action', { type: 'advance' })}
            className="mt-4 w-full max-w-xs py-4 bg-accent hover:bg-accent-hover text-white text-xl font-bold rounded-xl"
          >
            Start Round
          </button>
        )}
        {!isHost && <p className="text-muted text-sm">Waiting for host...</p>}
      </div>
    );
  }

  if (gs.phase === 'reveal') {
    const myPlayer = players.find((p) => p.id === myId);
    const me = gs.playerResults?.find((r) => myPlayer && r.name === myPlayer.name);
    const needsExplanation = !!(gs.explanation && !gs.explanationVisible);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        {me && (
          <p className={`text-2xl font-bold ${me.correct ? 'text-teal' : 'text-error'}`}>
            {me.correct ? 'Correct!' : 'Wrong!'}
          </p>
        )}
        <p className="text-muted-light">Your score: {gs.scores?.[myId] || 0}</p>
        {isHost && (
          <button
            onClick={() => emit('game:action', {
              type: needsExplanation ? 'showExplanation' : 'advance',
            })}
            className="mt-4 w-full max-w-xs py-4 bg-accent hover:bg-accent-hover text-white text-xl font-bold rounded-xl"
          >
            {needsExplanation ? 'Show explanation' : 'Next Question'}
          </button>
        )}
      </div>
    );
  }

  if (gs.phase === 'roundEnd') {
    const isLastRound = gs.round === gs.totalRounds;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <div className="text-lg font-bold">{isLastRound ? 'Final Scores!' : `End of ${gs.roundName} Round`}</div>
        <p className="text-muted-light">Your score: {gs.scores?.[myId] || 0}</p>
        {isHost && !isLastRound && (
          <button
            onClick={() => emit('game:action', { type: 'advance' })}
            className="mt-4 w-full max-w-xs py-4 bg-accent hover:bg-accent-hover text-white text-xl font-bold rounded-xl"
          >
            Next Round
          </button>
        )}
        {isHost && isLastRound && <PlayAgainButton />}
        {!isHost && <p className="text-muted text-sm">Waiting for host...</p>}
      </div>
    );
  }

  return null;
}
