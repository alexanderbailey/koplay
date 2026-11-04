require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const rooms = require('./rooms');
const games = require('./games');
const users = require('./users');
const screens = require('./screens');
const quizStore = require('./quizStore');
const { normalizeQuestionExplanation } = require('./quizValidate');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.json());
app.use(express.static(distPath));
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

function broadcastState(gameCode) {
  const room = rooms.getByCode(gameCode);
  if (!room) return;
  io.to(gameCode).emit('session:state', {
    ...room.session.getPublicState(),
    gameCode,
    hostAuthRequired: !room.session.authUser && !room.autoQuizId,
  });
}
rooms.setBroadcast(broadcastState);

// Cloudflare adds these headers to every request that arrives through the tunnel;
// they cannot be removed by the sender. Local requests never carry them.
function viaTunnel(req) {
  return !!(req.headers['cf-ray'] || req.headers['cf-connecting-ip']);
}

// Resolve the caller for the sensitive API (/api/quiz, /api/screen/push).
// Local mode: implicit local owner, but never through the tunnel.
// Otherwise: Bearer token with ROLE_UPLOAD.
function apiUser(req, res) {
  if (users.LOCAL_MODE) {
    if (viaTunnel(req)) {
      res.status(403).json({ error: 'This API is not available through the public tunnel' });
      return null;
    }
    return users.localUser();
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const user = users.findByToken(token);
  if (!user || !users.hasRole(user, users.ROLE_UPLOAD)) {
    res.status(401).json({ error: 'Invalid token or missing upload permission' });
    return null;
  }
  return user;
}

// Upload a quiz via JSON - requires ROLE_UPLOAD
app.post('/api/quiz', (req, res) => {
  const user = apiUser(req, res);
  if (!user) return;

  const { topic, rounds } = req.body || {};
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return res.status(400).json({ error: 'topic is required' });
  }
  if (!Array.isArray(rounds) || rounds.length === 0) {
    return res.status(400).json({ error: 'rounds must be a non-empty array' });
  }
  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    if (!round.name || typeof round.name !== 'string') {
      return res.status(400).json({ error: `rounds[${ri}].name is required` });
    }
    if (!Array.isArray(round.questions) || round.questions.length === 0) {
      return res.status(400).json({ error: `rounds[${ri}].questions must be a non-empty array` });
    }
    for (let qi = 0; qi < round.questions.length; qi++) {
      const q = round.questions[qi];
      if (!q.question || typeof q.question !== 'string') {
        return res.status(400).json({ error: `rounds[${ri}].questions[${qi}].question is required` });
      }
      if (!Array.isArray(q.choices) || q.choices.length !== 4 || q.choices.some((c) => typeof c !== 'string')) {
        return res.status(400).json({ error: `rounds[${ri}].questions[${qi}].choices must be an array of 4 strings` });
      }
      if (typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) {
        return res.status(400).json({ error: `rounds[${ri}].questions[${qi}].answer must be 0-3` });
      }
      if (q.image != null && (typeof q.image !== 'string' || !/^https?:\/\//i.test(q.image))) {
        return res.status(400).json({ error: `rounds[${ri}].questions[${qi}].image must be an http(s) URL` });
      }
      const explErr = normalizeQuestionExplanation(q, `rounds[${ri}].questions[${qi}]`);
      if (explErr) {
        return res.status(400).json({ error: explErr });
      }
    }
  }

  const quiz = quizStore.save({ topic: topic.trim(), rounds, creator: user.name, ip: req.ip });
  res.status(201).json({ id: quiz.id, topic: quiz.topic, creator: quiz.creator });
});

// Push a quiz to a screen - requires ROLE_UPLOAD and screen ownership
app.post('/api/screen/push', (req, res) => {
  const user = apiUser(req, res);
  if (!user) return;

  const { screenUuid, quizId } = req.body || {};
  if (!screenUuid || !quizId) {
    return res.status(400).json({ error: 'screenUuid and quizId are required' });
  }

  const screen = screens.findByUuid(screenUuid);
  if (!screen) return res.status(404).json({ error: 'Screen not found' });
  if (!screens.isOwner(screen, user.name)) {
    return res.status(403).json({ error: 'You are not an owner of this screen' });
  }

  const quiz = quizStore.get(quizId);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

  const room = rooms.getOrCreate(screenUuid);
  rooms.attachBroadcast(room);
  room.autoQuizId = quizId;

  // If a game is already in topicSelect, load the quiz immediately
  if (
    room.session.currentGame?.id === 'trivia' &&
    room.session.gameState?.phase === 'topicSelect' &&
    room.session.hostId
  ) {
    const triviaGame = games.get('trivia');
    if (triviaGame) {
      triviaGame.handleAction(room.session, room.session.hostId, { type: 'loadQuiz', quizId });
    }
  }

  broadcastState(room.gameCode);
  res.json({ ok: true, gameCode: room.gameCode, topic: quiz.topic });
});

// Validate game code (phone uses this before connecting socket)
app.get('/api/code/:code', (req, res) => {
  const room = rooms.getByCode(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Invalid game code' });
  res.json({ ok: true });
});

// /screen - in-app login form; users with ROLE_INTERACTIVE authenticate via socket
app.get('/screen', (req, res) =>
  res.sendFile(path.join(distPath, 'tv.html'))
);

// /screen/:uuid - must be a UUID in SCREENS (not a user token)
app.get('/screen/:uuid', (req, res) => {
  const screen = screens.findByUuid(req.params.uuid);
  if (!screen) return res.status(404).send('Not found');
  res.sendFile(path.join(distPath, 'tv.html'));
});

app.get('/phone', (req, res) =>
  res.sendFile(path.join(distPath, 'phone.html'))
);

app.get('/', (req, res) => {
  if (req.query.quiz) {
    const quiz = quizStore.get(req.query.quiz);
    if (!quiz) return res.status(404).send('Quiz not found');
    return res.sendFile(path.join(distPath, 'tv.html'));
  }
  res.sendFile(path.join(distPath, 'phone.html'));
});

// Temporary diagnostic page for TV browser testing
app.get('/tv-test', (req, res) => {
  res.send(`<!DOCTYPE html><html><body style="background:#1a1a2e;color:#eee;font-family:sans-serif;padding:2em">
<h1>TV Browser Diagnostics</h1>
<p id="ua"></p>
<p id="mod"></p>
<script>document.getElementById('ua').textContent='UA: '+navigator.userAgent;</script>
<script type="module">document.getElementById('mod').textContent='ES Modules: SUPPORTED';</script>
<script nomodule>document.getElementById('mod').textContent='ES Modules: NOT SUPPORTED';</script>
</body></html>`);
});

// Track which game code each socket belongs to
const socketRooms = new Map(); // socketId -> { gameCode, role }

io.on('connection', (socket) => {
  const role = socket.handshake.query.role;
  const code = socket.handshake.query.code;            // Player: game code
  const quizId = socket.handshake.query.quizId;        // TV: quiz-auth mode
  const authToken = socket.handshake.query.authToken;   // TV: screen UUID or user token
  const screenMode = socket.handshake.query.screenMode; // 'manual' = /screen login form

  if (role === 'tv') {
    let room;

    if (quizId && !authToken) {
      // Quiz-auth mode: /?quiz=<id> - no user, single-quiz only
      const quiz = quizStore.get(quizId);
      if (!quiz) {
        socket.emit('auth:error', { message: 'Quiz not found' });
        socket.disconnect();
        return;
      }
      room = rooms.getOrCreateByQuizId(quizId);
      rooms.attachBroadcast(room);
      room.session.authUser = null;
      room.autoQuizId = quizId;
    } else if (authToken) {
      const screen = screens.findByUuid(authToken);
      if (screen) {
        // Physical screen UUID - no user auth, host authenticates separately
        room = rooms.getOrCreate(authToken);
        rooms.attachBroadcast(room);
        // Local mode: the display belongs to the local owner, so no host password.
        room.session.authUser = users.LOCAL_MODE ? users.localUser() : null;
        // Don't clear autoQuizId - a pushed quiz may already be set
      } else if (screenMode === 'manual') {
        // /screen login form - validate as a user with ROLE_INTERACTIVE
        const user = users.findByToken(authToken);
        if (!user || !users.hasRole(user, users.ROLE_INTERACTIVE)) {
          socket.emit('auth:error', { message: 'Invalid access code' });
          socket.disconnect();
          return;
        }
        room = rooms.getOrCreate(authToken);
        rooms.attachBroadcast(room);
        room.session.authUser = user;
        room.autoQuizId = null;
      } else {
        socket.emit('auth:error', { message: 'Invalid access code' });
        socket.disconnect();
        return;
      }
    } else {
      socket.disconnect();
      return;
    }

    socket.join(room.gameCode);
    socketRooms.set(socket.id, { gameCode: room.gameCode, role: 'tv' });
    broadcastState(room.gameCode);
  }

  if (role === 'player') {
    const room = rooms.getByCode(code?.toUpperCase());
    if (!room) {
      socket.emit('error', { message: 'Invalid game code' });
      socket.disconnect();
      return;
    }
    const gameCode = room.gameCode;
    const session = room.session;

    socket.join(gameCode);
    socketRooms.set(socket.id, { gameCode, role: 'player' });
    socket.emit('session:state', {
      ...session.getPublicState(),
      gameCode,
      hostAuthRequired: !session.authUser && !room.autoQuizId,
    });

    socket.on('player:join', ({ name, avatarId, noiseId, accessCode }) => {
      if (!name || typeof name !== 'string' || !name.trim()) {
        socket.emit('error', { message: 'Name is required' });
        return;
      }
      if (session.gameState?.joinLocked) {
        socket.emit('error', { message: 'Game already started, cannot join' });
        return;
      }
      // First joiner on a screen room without a pushed quiz must provide an access code
      const needsAuth = session.players.size === 0 && !session.authUser && !room.autoQuizId;
      if (needsAuth) {
        const user = users.findByToken(accessCode);
        if (!user || !users.hasRole(user, users.ROLE_INTERACTIVE)) {
          socket.emit('error', { message: 'Invalid access code' });
          return;
        }
        session.authUser = user;
      }
      const result = session.addPlayer(socket.id, name.trim(), avatarId, noiseId);
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }
      session.players.get(socket.id).ip = socket.handshake.address;
      if (session.hostId === socket.id && room.autoQuizId) {
        const triviaGame = games.get('trivia');
        if (triviaGame) {
          session.selectGame(triviaGame);
          triviaGame.handleAction(session, socket.id, { type: 'loadQuiz', quizId: room.autoQuizId });
        }
      }
      broadcastState(gameCode);
    });

    socket.on('host:selectGame', ({ gameId }) => {
      if (socket.id !== session.hostId) {
        socket.emit('error', { message: 'Only the host can select a game' });
        return;
      }
      const game = games.get(gameId);
      if (!game) {
        socket.emit('error', { message: 'Unknown game' });
        return;
      }
      session.selectGame(game);
      if (game.id === 'trivia' && room.autoQuizId) {
        game.handleAction(session, socket.id, { type: 'loadQuiz', quizId: room.autoQuizId });
      }
      broadcastState(gameCode);
    });

    socket.on('game:action', (data) => {
      if (!session.currentGame) return;
      const game = games.get(session.currentGame.id);
      if (game && game.handleAction) {
        game.handleAction(session, socket.id, data);
        // After playAgain resets to topicSelect, auto-load a pushed quiz instead of showing auth
        if (
          room.autoQuizId &&
          session.gameState?.phase === 'topicSelect' &&
          socket.id === session.hostId
        ) {
          game.handleAction(session, socket.id, { type: 'loadQuiz', quizId: room.autoQuizId });
        }
        broadcastState(gameCode);
      }
    });
  }

  socket.on('disconnect', () => {
    const entry = socketRooms.get(socket.id);
    socketRooms.delete(socket.id);
    if (!entry) return;

    const { gameCode, role: disconnectedRole } = entry;
    if (disconnectedRole === 'tv') return;

    const room = rooms.getByCode(gameCode);
    if (!room) return;

    if (room.session.currentGame) {
      const game = games.get(room.session.currentGame.id);
      if (game && game.onPlayerLeave) {
        game.onPlayerLeave(room.session, socket.id);
      }
    }
    room.session.removePlayer(socket.id);
    if (room.session.players.size === 0) {
      room.autoQuizId = null;
    }
    broadcastState(gameCode);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`KoPlay is running on port ${PORT}`);
});
