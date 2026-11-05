import { useEffect, useRef, useState } from 'react';
import ConfettiCanvas from '../../shared/components/ConfettiCanvas';
import AVATARS from '../../shared/avatars';
import PixelAvatar from '../../shared/components/PixelAvatar';
import QRCodeCanvas from '../../shared/components/QRCodeCanvas';
import { playSoundById, createMusicElement } from '../../shared/sounds';
import { useSocket } from '../../shared/context/SocketContext';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const CHOICE_BG = ['bg-red-600', 'bg-blue-600', 'bg-amber-500', 'bg-teal-600'];
const CHOICE_BAR = ['bg-red-500', 'bg-blue-500', 'bg-amber-400', 'bg-teal-500'];

function getAvatar(avatarId) {
  return AVATARS.find((a) => a.id === avatarId) || null;
}

function AnswerGrid({ choices, highlightIndex = null, dimOthers = false, className = 'flex-1' }) {
  return (
    <div className={`grid grid-cols-2 gap-4 w-full ${className}`}>
      {choices.map((choice, i) => {
        const isHighlighted = highlightIndex === i;
        const isDimmed = dimOthers && highlightIndex !== null && !isHighlighted;
        return (
          <div
            key={i}
            className={`${CHOICE_BG[i]} flex flex-col items-center justify-center rounded-2xl p-4 transition-all duration-500 ${
              isHighlighted ? 'ring-4 ring-white scale-105' : ''
            } ${isDimmed ? 'opacity-30' : ''}`}
          >
            <span className="text-2xl font-black text-white/80 mb-1">{CHOICE_LABELS[i]}</span>
            <span className="text-lg font-bold text-white text-center leading-snug">{choice}</span>
          </div>
        );
      })}
    </div>
  );
}

function AnsweredRow({ entries }) {
  return (
    <div className="flex items-center gap-4 bg-black/40 rounded-xl px-6 py-3">
      <span className="text-white/50 text-lg font-semibold shrink-0">Answered</span>
      <div className="flex gap-3 flex-wrap">
        {entries.map((entry, i) => {
          const avatar = getAvatar(entry.avatarId);
          if (!avatar) return null;
          return (
            <div key={i} className={entry.correct === false ? 'opacity-40' : ''}>
              <PixelAvatar avatar={avatar} size={40} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopicSelectPhase({ gs }) {
  return (
    <div
      className="h-screen flex flex-col items-center justify-center gap-6 bg-cover bg-center"
      style={{ backgroundImage: 'url(/tv/background.jpg)' }}
    >
      <div className="bg-black/60 rounded-3xl px-20 py-14 flex flex-col items-center gap-6">
        <p className="text-8xl font-black text-white">Trivia!</p>
        <p className="text-white/60 text-3xl">Waiting for host to choose a topic...</p>
        {gs.error && <p className="text-red-400 text-2xl">{gs.error}</p>}
      </div>
    </div>
  );
}

function GeneratingPhase({ gs }) {
  return (
    <div
      className="h-screen flex flex-col items-center justify-center gap-6 bg-cover bg-center"
      style={{ backgroundImage: 'url(/tv/background.jpg)' }}
    >
      <div className="bg-black/60 rounded-3xl px-20 py-14 flex flex-col items-center gap-6">
        <p className="text-5xl font-black text-white animate-pulse">Generating questions...</p>
        <p className="text-white/60 text-2xl">Topic: {gs.topic}</p>
      </div>
    </div>
  );
}

const PODIUM_COLOURS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];

function RoundLeaderboard({ scores, players }) {
  const entries = players
    .map((p) => ({ ...p, score: scores?.[p.id] || 0, avatar: getAvatar(p.avatarId) }))
    .sort((a, b) => b.score - a.score);

  const top = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4">
      {top.map((e, i) => (
        <div key={e.id} className="flex items-center gap-6 bg-black/50 rounded-2xl px-6 py-4">
          <span className={`text-4xl font-black w-10 text-center ${PODIUM_COLOURS[i]}`}>
            {i + 1}
          </span>
          {e.avatar && <PixelAvatar avatar={e.avatar} size={56} />}
          <span className="text-3xl font-bold text-white flex-1">{e.name}</span>
          <span className={`text-4xl font-black ${PODIUM_COLOURS[i]}`}>{e.score}</span>
        </div>
      ))}
      {rest.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-2">
          {rest.map((e) => (
            <div key={e.id} className="flex flex-col items-center gap-1 opacity-60">
              {e.avatar && <PixelAvatar avatar={e.avatar} size={40} />}
              <span className="text-white/80 text-sm font-semibold">{e.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoundIntroPhase({ gs }) {
  return (
    <div
      className="h-screen flex flex-col items-center justify-center gap-6 bg-cover bg-center"
      style={{ backgroundImage: 'url(/tv/background.jpg)' }}
    >
      <div className="bg-black/60 rounded-3xl px-20 py-14 flex flex-col items-center gap-4">
        <p className="text-white/60 text-3xl font-semibold uppercase tracking-widest">
          Round {gs.round} of {gs.totalRounds}
        </p>
        <p className="text-9xl font-black text-white">{gs.roundName}</p>
      </div>
    </div>
  );
}

function CharacterSelectPhase({ gs, players, gameCode }) {
  const joinUrl = gameCode
    ? `${window.location.origin}/?code=${gameCode}`
    : `${window.location.origin}/`;
  const soundedRef = useRef(new Set());

  useEffect(() => {
    for (const player of players) {
      if (player.noiseId && !soundedRef.current.has(player.id)) {
        soundedRef.current.add(player.id);
        playSoundById(player.noiseId);
      }
    }
  }, [players]);

  return (
    <div
      className="h-screen flex bg-cover bg-center"
      style={{ backgroundImage: 'url(/tv/lobby-background.jpg)' }}
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-10 bg-black/50">
        <h1 className="text-5xl font-bold text-white">Choose your character!</h1>
        <div className="flex flex-wrap justify-center gap-6">
          {players.map((p) => {
            const avatar = getAvatar(p.avatarId);
            return (
              <div key={p.id} className={`flex flex-col items-center ${p.connected === false ? 'opacity-40' : ''}`}>
                {avatar
                  ? <PixelAvatar avatar={avatar} size={72} />
                  : <div className="w-[72px] h-[72px] rounded-full border-2 border-white/30 bg-white/10 flex items-center justify-center">
                      <span className="text-white/40 text-2xl">?</span>
                    </div>
                }
                <span className="text-white text-lg font-semibold mt-2">{p.name}</span>
                {p.connected === false
                  ? <span className="text-white/60 text-sm mt-2">Reconnecting...</span>
                  : p.avatarId && <span className="text-white/60 text-sm mt-2">Ready</span>}
              </div>
            );
          })}
        </div>
        <p className="text-white/60 text-xl">Waiting for host to start...</p>
      </div>
      {!gs.joinLocked && (
        <div className="flex flex-col items-center justify-center gap-4 p-8 bg-black/60">
          <QRCodeCanvas url={joinUrl} size={180} />
          <p className="text-white/60 text-sm">Scan to join</p>
          {gameCode && (
            <p className="font-mono font-bold text-white tracking-widest text-xl">{gameCode}</p>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionImage({ src, className = '' }) {
  return (
    <div className={`relative min-h-0 ${className}`}>
      <img src={src} alt="" className="absolute inset-0 w-full h-full object-contain" />
    </div>
  );
}

function QuestionPhase({ gs, showAnswers }) {
  const hasImage = !!gs.image;
  return (
    <div
      className="h-screen flex flex-col p-6 gap-4 bg-cover bg-center"
      style={{ backgroundImage: 'url(/tv/background.jpg)' }}
    >
      <div className="flex items-center text-white/70 text-lg bg-black/40 rounded-xl px-4 py-2">
        <span>{gs.roundName} · Q{gs.questionNum}/{gs.totalQuestions}</span>
      </div>
      <div className={`${hasImage ? '' : 'flex-[2]'} flex items-center justify-center px-6 py-4 bg-black/40 rounded-xl`}>
        <p className={`${hasImage ? 'text-4xl' : 'text-7xl'} font-bold text-white text-center leading-tight`}>
          {gs.question}
        </p>
      </div>
      {hasImage && <QuestionImage src={gs.image} className="flex-[2]" />}
      {showAnswers && (
        <>
          <AnswerGrid choices={gs.choices} className={hasImage ? 'flex-[2]' : 'flex-1'} />
          <AnsweredRow entries={gs.recentAnswers} />
        </>
      )}
    </div>
  );
}


function RevealPhase({ gs, players }) {
  const counts = gs.choiceCounts || [0, 0, 0, 0];
  const maxCount = Math.max(...counts, 1);

  return (
    <div
      className="h-screen flex flex-col p-6 gap-4 bg-cover bg-center"
      style={{ backgroundImage: 'url(/tv/background.jpg)' }}
    >
      <div className="text-2xl font-bold text-white text-center bg-black/40 rounded-xl px-4 py-2">
        {gs.question}
      </div>

      {/* Bars — all anchored to the same baseline, height driven by vote count.
          When the question has an image it stays visible beside the bars. */}
      <div className="flex-1 flex min-h-0">
        {gs.image && <QuestionImage src={gs.image} className="w-1/3" />}
        <div className="flex-1 flex items-end gap-6 px-8">
          {gs.choices.map((choice, i) => {
            const count = counts[i];
            const isCorrect = i === gs.correctIndex;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className={`text-2xl font-bold ${isCorrect ? 'text-white' : 'text-white/60'}`}>
                  {count}{isCorrect ? ' ✓' : ''}
                </span>
                <div
                  className={`w-full rounded-t-xl transition-all duration-700 ${CHOICE_BAR[i]} ${isCorrect ? '' : 'opacity-20'}`}
                  style={{ height: `${(count / maxCount) * 50}vh` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Labels — separate fixed row below the bars */}
      <div className="flex gap-6 px-8">
        {gs.choices.map((choice, i) => {
          const isCorrect = i === gs.correctIndex;
          return (
            <div
              key={i}
              className={`flex-1 rounded-xl px-3 py-3 text-center ${CHOICE_BG[i]} ${isCorrect ? 'ring-4 ring-white' : 'opacity-25'}`}
            >
              <span className="text-white font-bold text-lg block">{CHOICE_LABELS[i]}</span>
              <span className="text-white/90 text-sm leading-snug">{choice}</span>
            </div>
          );
        })}
      </div>

      <AnsweredRow entries={gs.playerResults || []} />
    </div>
  );
}

export default function TriviaTV({ gameState: gs, players }) {
  const { sessionState } = useSocket();
  const gameCode = sessionState?.gameCode || null;
  // Track which question answers are visible for — auto-false when question changes
  const [showAnswersKey, setShowAnswersKey] = useState(null);
  const showAnswers = showAnswersKey === `${gs.round}-${gs.questionNum}`;
  const countdownRef = useRef(null);
  const gongRef = useRef(null);
  const gongTimerRef = useRef(null);
  const questionAudioRef = useRef(null);
  const lobbyAudioRef = useRef(null);
  const showAnswersTimerRef = useRef(null);
  const answersProcessedRef = useRef(new Set());

  function stopAll() {
    if (showAnswersTimerRef.current) {
      clearTimeout(showAnswersTimerRef.current);
      showAnswersTimerRef.current = null;
    }
    if (questionAudioRef.current) {
      questionAudioRef.current.pause();
      questionAudioRef.current = null;
    }
    if (gongTimerRef.current) {
      clearTimeout(gongTimerRef.current);
      gongTimerRef.current = null;
    }
    if (countdownRef.current) {
      countdownRef.current.pause();
      countdownRef.current = null;
    }
    if (gongRef.current) {
      gongRef.current.pause();
      gongRef.current = null;
    }
    if (lobbyAudioRef.current) {
      lobbyAudioRef.current.pause();
      lobbyAudioRef.current = null;
    }
  }

  // Reset answer tracking only when a new question begins (not on roundEnd where
  // questionNum also increments — that would let stale recentAnswers replay sounds)
  useEffect(() => {
    if (gs.phase === 'question') {
      answersProcessedRef.current = new Set();
    }
  }, [gs.phase, gs.round, gs.questionNum]); // eslint-disable-line react-hooks/exhaustive-deps

  // Play each player's sound whenever recentAnswers gains a new entry.
  // No phase gate — the Set prevents replays, and the reset above ensures
  // the last player's sound plays even when reveal arrives in the same batch.
  useEffect(() => {
    if (!gs.recentAnswers) return;
    for (const entry of gs.recentAnswers) {
      if (!answersProcessedRef.current.has(entry.playerId)) {
        answersProcessedRef.current.add(entry.playerId);
        if (entry.noiseId) playSoundById(entry.noiseId);
      }
    }
  }, [gs.recentAnswers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lobby music — looping while on character select screen
  useEffect(() => {
    if (gs.phase === 'characterSelect') {
      const audio = createMusicElement('/tv/lobby.mp3', { loop: true });
      audio.play().catch(() => {});
      lobbyAudioRef.current = audio;
    } else {
      if (lobbyAudioRef.current) {
        lobbyAudioRef.current.pause();
        lobbyAudioRef.current = null;
      }
    }
    return () => {
      if (lobbyAudioRef.current) {
        lobbyAudioRef.current.pause();
        lobbyAudioRef.current = null;
      }
    };
  }, [gs.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gs.phase === 'roundIntro') {
      stopAll();
      const audio = createMusicElement('/tv/round_start.wav');
      audio.play().catch(() => {});
      questionAudioRef.current = audio;
    } else if (gs.phase === 'question') {
      stopAll();
      const questionKey = `${gs.round}-${gs.questionNum}`;
      // Play question.mp3 while the question is displayed before answers appear
      const qAudio = createMusicElement('/tv/question.mp3');
      qAudio.play().catch(() => {});
      questionAudioRef.current = qAudio;
      // After 3s, reveal answers and start the countdown music
      showAnswersTimerRef.current = setTimeout(() => {
        showAnswersTimerRef.current = null;
        if (questionAudioRef.current) {
          questionAudioRef.current.pause();
          questionAudioRef.current = null;
        }
        const cdAudio = createMusicElement('/tv/countdown.mp3');
        cdAudio.play().catch(() => {});
        countdownRef.current = cdAudio;
        setShowAnswersKey(questionKey);
      }, 3000);
    } else if (gs.phase === 'reveal') {
      if (gs.earlyEnd) {
        // Stop countdown, wait 1s for last player's sound then play gong
        stopAll();
        gongTimerRef.current = setTimeout(() => {
          gongTimerRef.current = null;
          const audio = createMusicElement('/tv/gong.mp3');
          audio.play().catch(() => {});
          gongRef.current = audio;
        }, 1000);
      }
      // Natural timeout: countdown.mp3 keeps playing through its cooldown section
    } else {
      stopAll();
    }

    return () => {
      // cleanup only on unmount
    };
  }, [gs.phase, gs.round, gs.questionNum]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => stopAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (gs.phase === 'error') {
    return <p className="text-error text-center text-2xl">{gs.message}</p>;
  }

  if (gs.phase === 'topicSelect') {
    return <TopicSelectPhase gs={gs} />;
  }

  if (gs.phase === 'generating') {
    return <GeneratingPhase gs={gs} />;
  }

  if (gs.phase === 'characterSelect') {
    return <CharacterSelectPhase gs={gs} players={players} gameCode={gameCode} />;
  }

  if (gs.phase === 'roundIntro') {
    return <RoundIntroPhase gs={gs} />;
  }

  if (gs.phase === 'question') {
    return <QuestionPhase gs={gs} showAnswers={showAnswers} />;
  }

  if (gs.phase === 'reveal') {
    return <RevealPhase gs={gs} players={players} />;
  }

  if (gs.phase === 'roundEnd') {
    const isLastRound = gs.round === gs.totalRounds;
    return (
      <div
        className="relative h-screen flex flex-col items-center justify-center gap-8 w-full px-8 bg-cover bg-center"
        style={{ backgroundImage: 'url(/tv/background.jpg)' }}
      >
        {isLastRound && <ConfettiCanvas />}
        <div className="text-5xl font-black text-white">
          {isLastRound ? 'Final Scores!' : `End of ${gs.roundName} Round`}
        </div>
        <RoundLeaderboard scores={gs.scores} players={players} />
        {!isLastRound && (
          <div className="text-white/60 text-2xl">Next round starting soon...</div>
        )}
      </div>
    );
  }

  return null;
}
