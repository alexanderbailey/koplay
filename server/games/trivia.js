const QUESTION_TIME = 60;
const MIN_PLAYERS = 1;
const EXPLANATION_REVEAL_MS = 3000;

const quizStore = require('../quizStore');
const { ROLE_GENERATE, ROLE_ADMIN } = require('../users');
const { EXPLANATION_MAX, normalizeRoundsExplanations } = require('../quizValidate');

function getVisibleQuizzes(session) {
  const auth = session.authUser || null;
  if (!auth) return [];
  const all = quizStore.summaries();
  const filtered = (auth.role & ROLE_ADMIN) ? all : all.filter((q) => q.creator === auth.name);
  return filtered.map((q) => ({
    ...q,
    canDelete: !!(auth.role & ROLE_ADMIN) || q.creator === auth.name,
  }));
}

function priv(session) {
  if (!session._private) session._private = {};
  return session._private;
}

function clearTimer(session) {
  const p = priv(session);
  if (p.phaseTimer) {
    clearTimeout(p.phaseTimer);
    p.phaseTimer = null;
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function activePlayers(session) {
  return Array.from(session.players.keys());
}

function getCurrentQuestion(session) {
  const gs = session.gameState;
  const p = priv(session);
  return p.shuffledRounds[gs.round - 1][gs.questionNum - 1];
}

// AI quiz generation is optional: it needs both a Gemini key on the server
// and a user with ROLE_GENERATE. Without a key, only saved quizzes (including
// ones uploaded via POST /api/quiz) can be selected.
function geminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

function canGenerate(session) {
  return geminiConfigured() && !!(session.authUser && (session.authUser.role & ROLE_GENERATE));
}

async function generateQuestions(topic) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in environment');

  const prompt = `Generate a trivia quiz about "${topic}" with 3 difficulty rounds.
Return ONLY a valid JSON object with no markdown formatting or code blocks.
Use this exact structure:
{
  "rounds": [
    {
      "name": "Easy",
      "questions": [
        {"question": "...", "choices": ["A", "B", "C", "D"], "answer": 0},
        {"question": "...", "choices": ["A", "B", "C", "D"], "answer": 1, "explanation": "..."}
      ]
    },
    {"name": "Medium", "questions": [...]},
    {"name": "Hard", "questions": [...]}
  ]
}
Rules:
- Exactly 5 questions per round (15 total)
- Exactly 4 choices per question
- "answer" is the 0-based index of the correct choice (0, 1, 2, or 3)
- Easy questions should be general knowledge, Medium moderately challenging, Hard quite difficult
- All questions must be factually accurate
- Vary which index the correct answer appears at
- Optional "explanation": a short why-the-answer-is-correct (1-2 sentences, aim under 260 characters, hard max ${EXPLANATION_MAX}). Include it ONLY when the correct choice text alone would leave players unclear (jargon, terse names, non-obvious facts). Omit the field entirely when the choice is self-explanatory. Never use an empty string.`;

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 429) {
      throw new Error('Gemini quota exceeded - check your API plan or try a different model');
    }
    throw new Error(`Gemini API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content in Gemini response');

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.rounds) || parsed.rounds.length < 3) {
    throw new Error('Invalid rounds structure in response');
  }
  for (const round of parsed.rounds) {
    if (!Array.isArray(round.questions) || round.questions.length < 5) {
      throw new Error('Invalid questions structure in response');
    }
  }

  const explErr = normalizeRoundsExplanations(parsed.rounds);
  if (explErr) throw new Error(explErr);

  return parsed.rounds;
}

function showRoundIntro(session) {
  clearTimer(session);
  if (!session.gameState) return;
  const gs = session.gameState;
  const p = priv(session);

  gs.phase = 'roundIntro';
  gs.roundName = p.currentRounds[gs.round - 1].name;
  gs.question = null;
  gs.image = null;
  gs.choices = null;
  gs.explanation = null;
  gs.explanationVisible = false;
  gs.timer = null;

  session.broadcastState();
}

function startQuestion(session) {
  clearTimer(session);
  const p = priv(session);
  p.roundAnswers = new Map();

  const q = getCurrentQuestion(session);
  const gs = session.gameState;

  gs.phase = 'question';
  gs.roundName = p.currentRounds[gs.round - 1].name;
  gs.question = q.question;
  gs.image = q.image || null;
  gs.choices = q.choices;
  gs.answeredCount = 0;
  gs.totalPlayers = activePlayers(session).length;
  gs.correctIndex = null;
  gs.playerResults = null;
  gs.choiceCounts = null;
  gs.explanation = null;
  gs.explanationVisible = false;
  gs.recentAnswers = [];
  gs.earlyEnd = false;
  gs.timer = {
    endsAt: Date.now() + QUESTION_TIME * 1000,
    duration: QUESTION_TIME,
  };

  session.broadcastState();

  p.phaseTimer = setTimeout(() => {
    p.phaseTimer = null;
    endQuestion(session, false);
  }, QUESTION_TIME * 1000);
}

function endQuestion(session, early) {
  clearTimer(session);
  if (!session.gameState) return;
  session.gameState.earlyEnd = early;
  showReveal(session);
}

function showReveal(session) {
  clearTimer(session);
  if (!session.gameState) return;

  const q = getCurrentQuestion(session);
  const gs = session.gameState;
  const p = priv(session);
  const players = activePlayers(session);

  const playerResults = [];
  for (const id of players) {
    const answer = p.roundAnswers.get(id);
    const correct = answer === q.answer;
    if (correct) {
      gs.scores[id] = (gs.scores[id] || 0) + 1;
    }
    const player = session.players.get(id);
    playerResults.push({
      name: player ? player.name : '(left)',
      correct,
      avatarId: player ? player.avatarId : null,
      choiceIndex: answer != null ? answer : null,
    });
  }

  const choiceCounts = [0, 0, 0, 0];
  for (const [, idx] of p.roundAnswers) {
    if (idx != null && idx >= 0 && idx < 4) choiceCounts[idx]++;
  }

  gs.phase = 'reveal';
  gs.correctIndex = q.answer;
  gs.playerResults = playerResults;
  gs.choiceCounts = choiceCounts;
  gs.explanation = q.explanation || null;
  gs.explanationVisible = false;
  gs.timer = null;

  session.broadcastState();

  if (gs.explanation) {
    p.phaseTimer = setTimeout(() => {
      p.phaseTimer = null;
      if (!session.gameState || session.gameState.phase !== 'reveal') return;
      session.gameState.explanationVisible = true;
      session.broadcastState();
    }, EXPLANATION_REVEAL_MS);
  }
}

function showExplanation(session) {
  if (!session.gameState || session.gameState.phase !== 'reveal') return;
  const gs = session.gameState;
  if (!gs.explanation || gs.explanationVisible) return;
  clearTimer(session);
  gs.explanationVisible = true;
  session.broadcastState();
}

function nextQuestion(session) {
  clearTimer(session);
  if (!session.gameState) return;
  const gs = session.gameState;
  const p = priv(session);
  const totalQuestions = p.shuffledRounds[gs.round - 1].length;

  gs.questionNum++;

  if (gs.questionNum > totalQuestions) {
    showRoundEnd(session);
    return;
  }

  startQuestion(session);
}

function showRoundEnd(session) {
  clearTimer(session);
  const gs = session.gameState;

  gs.phase = 'roundEnd';
  gs.question = null;
  gs.image = null;
  gs.choices = null;
  gs.correctIndex = null;
  gs.playerResults = null;
  gs.choiceCounts = null;
  gs.explanation = null;
  gs.explanationVisible = false;
  gs.timer = null;

  session.broadcastState();
}

function nextRound(session) {
  clearTimer(session);
  if (!session.gameState) return;
  const gs = session.gameState;
  const p = priv(session);

  gs.round++;

  if (gs.round > gs.totalRounds) {
    gameOver(session);
    return;
  }

  gs.questionNum = 1;
  gs.totalQuestions = p.shuffledRounds[gs.round - 1].length;
  showRoundIntro(session);
}

function gameOver(session) {
  clearTimer(session);
  const gs = session.gameState;

  gs.phase = 'gameover';
  gs.timer = null;
  gs.question = null;
  gs.image = null;
  gs.choices = null;
  gs.correctIndex = null;
  gs.playerResults = null;
  gs.choiceCounts = null;
  gs.explanation = null;
  gs.explanationVisible = false;

  const ranking = activePlayers(session).map((id) => ({
    id,
    name: session.players.get(id).name,
    score: gs.scores[id] || 0,
  }));
  ranking.sort((a, b) => b.score - a.score);
  gs.finalRanking = ranking;

  session.broadcastState();
}

function checkAllAnswered(session) {
  const p = priv(session);
  const players = activePlayers(session);
  if (p.roundAnswers.size >= players.length) {
    endQuestion(session, true);
    return true;
  }
  return false;
}

function startWithRounds(session, rounds, topic) {
  const p = priv(session);
  p.currentRounds = rounds;
  p.shuffledRounds = rounds.map((r) => shuffle(r.questions));

  Object.assign(session.gameState, {
    phase: 'characterSelect',
    topic,
    error: null,
    joinLocked: false,
    round: 1,
    totalRounds: rounds.length,
    roundName: null,
    questionNum: 1,
    totalQuestions: p.shuffledRounds[0].length,
    question: null,
    image: null,
    choices: null,
    answeredCount: 0,
    totalPlayers: activePlayers(session).length,
    correctIndex: null,
    playerResults: null,
    choiceCounts: null,
    explanation: null,
    explanationVisible: false,
    scores: null,
    recentAnswers: [],
    earlyEnd: false,
    timer: null,
    finalRanking: null,
  });
  session.broadcastState();
}

module.exports = {
  id: 'trivia',
  name: 'Trivia',
  description: 'Answer questions across 3 rounds - easy, medium, hard!',

  init(session) {
    const players = activePlayers(session);

    if (players.length < MIN_PLAYERS) {
      return {
        phase: 'error',
        message: `Need at least ${MIN_PLAYERS} player to start Trivia.`,
      };
    }

    const p = priv(session);
    p.shuffledRounds = null;
    p.currentRounds = null;
    p.roundAnswers = null;
    clearTimer(session);

    session.gameState = {
      phase: 'topicSelect',
      topic: null,
      error: null,
      savedQuizzes: getVisibleQuizzes(session),
      canGenerate: canGenerate(session),
      joinLocked: false,
      round: null,
      totalRounds: null,
      roundName: null,
      questionNum: null,
      totalQuestions: null,
      question: null,
      image: null,
      choices: null,
      answeredCount: 0,
      totalPlayers: players.length,
      correctIndex: null,
      playerResults: null,
      choiceCounts: null,
      explanation: null,
      explanationVisible: false,
      scores: null,
      recentAnswers: [],
      earlyEnd: false,
      timer: null,
      finalRanking: null,
    };

    return session.gameState;
  },

  handleAction(session, playerId, action) {
    if (!session.gameState || session.gameState.phase === 'error') return;

    if (action.type === 'loadQuiz') {
      if (session.gameState.phase !== 'topicSelect') return;
      if (playerId !== session.hostId) return;

      const quiz = quizStore.get(action.quizId);
      if (!quiz) {
        session.gameState.error = 'Quiz not found';
        return;
      }

      startWithRounds(session, quiz.rounds, quiz.topic);
      return;
    }

    if (action.type === 'generateQuiz') {
      if (session.gameState.phase !== 'topicSelect') return;
      if (playerId !== session.hostId) return;

      const auth = session.authUser || null;
      if (!canGenerate(session)) {
        session.gameState.error = geminiConfigured()
          ? 'Quiz generation not enabled for this screen'
          : 'AI quiz generation is not configured on this server';
        return;
      }

      const topic = (action.topic || '').trim();
      if (!topic) return;

      session.gameState.phase = 'generating';
      session.gameState.topic = topic;
      session.gameState.error = null;
      session.broadcastState();

      generateQuestions(topic).then((rounds) => {
        if (!session.gameState) return;
        try {
          const player = session.players.get(playerId);
          quizStore.save({ topic, rounds, creator: auth.name, ip: player ? player.ip : null });
        } catch (err) {
          console.error('Failed to persist quiz:', err.message);
        }
        startWithRounds(session, rounds, topic);
      }).catch((err) => {
        if (!session.gameState) return;
        console.error('Gemini generation failed:', err.message);
        session.gameState.phase = 'topicSelect';
        session.gameState.savedQuizzes = getVisibleQuizzes(session);
        session.gameState.canGenerate = canGenerate(session);
        session.gameState.error = err.message;
        session.broadcastState();
      });
      return;
    }

    if (action.type === 'deleteQuiz') {
      if (session.gameState.phase !== 'topicSelect') return;
      if (playerId !== session.hostId) return;

      const auth = session.authUser || null;
      if (!auth) { session.gameState.error = 'Not authorized'; return; }

      const isAdmin = !!(auth.role & ROLE_ADMIN);
      const result = quizStore.remove(action.quizId, isAdmin ? null : auth.name);
      if (result.error) {
        session.gameState.error = result.error;
        return;
      }

      session.gameState.error = null;
      session.gameState.savedQuizzes = getVisibleQuizzes(session);
      return;
    }

    if (action.type === 'selectCharacter') {
      if (session.gameState.phase !== 'characterSelect') return;

      const { avatarId, noiseId } = action;
      if (!avatarId || !noiseId) return;

      for (const [id, player] of session.players) {
        if (id === playerId) continue;
        if (player.avatarId === avatarId) return;
        if (player.noiseId === noiseId) return;
      }

      const player = session.players.get(playerId);
      if (player) {
        player.avatarId = avatarId;
        player.noiseId = noiseId;
      }

      session.broadcastState();
      return;
    }

    if (action.type === 'startGame') {
      if (session.gameState.phase !== 'characterSelect') return;
      if (playerId !== session.hostId) return;

      const gs = session.gameState;
      gs.joinLocked = true;

      const players = activePlayers(session);
      gs.scores = {};
      for (const id of players) {
        gs.scores[id] = 0;
      }

      gs.totalPlayers = players.length;

      showRoundIntro(session);
      return;
    }

    if (action.type === 'answer') {
      if (session.gameState.phase !== 'question') return;
      const p = priv(session);
      if (!p.roundAnswers) return;
      if (p.roundAnswers.has(playerId)) return;

      const index = action.index;
      if (typeof index !== 'number' || index < 0 || index >= session.gameState.choices.length) return;

      p.roundAnswers.set(playerId, index);
      session.gameState.answeredCount = p.roundAnswers.size;

      const player = session.players.get(playerId);
      if (player) {
        session.gameState.recentAnswers.push({
          playerId,
          avatarId: player.avatarId,
          noiseId: player.noiseId,
        });
      }

      session.broadcastState();
      checkAllAnswered(session);
      return;
    }

    if (action.type === 'showExplanation') {
      if (playerId !== session.hostId) return;
      showExplanation(session);
      return;
    }

    if (action.type === 'advance') {
      if (playerId !== session.hostId) return;
      if (session.gameState.phase === 'roundIntro') {
        startQuestion(session);
      } else if (session.gameState.phase === 'reveal') {
        const gs = session.gameState;
        if (gs.explanation && !gs.explanationVisible) {
          showExplanation(session);
          return;
        }
        nextQuestion(session);
      } else if (session.gameState.phase === 'roundEnd') {
        nextRound(session);
      }
      return;
    }

    if (action.type === 'playAgain') {
      const phase = session.gameState.phase;
      const isLastRoundEnd = phase === 'roundEnd' && session.gameState.round === session.gameState.totalRounds;
      if (phase !== 'gameover' && !isLastRoundEnd) return;
      if (playerId !== session.hostId) return;

      this.init(session);
      // Don't broadcast here - index.js will auto-load a pushed quiz first if set
      return;
    }
  },

  onPlayerLeave(session, playerId) {
    if (!session.gameState || session.gameState.phase === 'error') return;

    if (
      session.gameState.phase === 'topicSelect' ||
      session.gameState.phase === 'generating' ||
      session.gameState.phase === 'characterSelect'
    ) {
      session.gameState.totalPlayers = activePlayers(session).filter((id) => id !== playerId).length;
      return;
    }

    const remaining = activePlayers(session).filter((id) => id !== playerId);
    session.gameState.totalPlayers = remaining.length;

    if (remaining.length < MIN_PLAYERS) {
      clearTimer(session);
      gameOver(session);
      return;
    }

    const p = priv(session);
    if (session.gameState.phase === 'question' && p.roundAnswers) {
      checkAllAnswered(session);
    }
  },
};
