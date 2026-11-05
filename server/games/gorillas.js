const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const GRAVITY = 0.4;
const SCALE = 0.4;
const GORILLA_RADIUS = 20;
const POINTS_TO_WIN = 3;

const BUILDING_COLORS = [
  '#4a3f6b', '#3d5a80', '#5c4a72', '#2c5f7c', '#6b4f4f',
  '#4f6b5c', '#5a4f6b', '#3f5c6b', '#6b5a4a', '#4a6b5f',
];

function generateBuildings() {
  const buildings = [];
  const count = 8 + Math.floor(Math.random() * 5); // 8-12
  const buildingWidth = CANVAS_WIDTH / count;

  for (let i = 0; i < count; i++) {
    buildings.push({
      x: i * buildingWidth,
      width: buildingWidth,
      height: 150 + Math.random() * 300,
      color: BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)],
    });
  }
  return buildings;
}

function placeGorillas(buildings) {
  const b1 = buildings[1];
  const b2 = buildings[buildings.length - 2];
  return [
    { x: b1.x + b1.width / 2, y: CANVAS_HEIGHT - b1.height - GORILLA_RADIUS },
    { x: b2.x + b2.width / 2, y: CANVAS_HEIGHT - b2.height - GORILLA_RADIUS },
  ];
}

function simulateThrow(playerIndex, angle, velocity, wind, buildings, gorillas) {
  const g = gorillas[playerIndex];
  const radians = (angle * Math.PI) / 180;
  const direction = playerIndex === 0 ? 1 : -1;

  let vx = Math.cos(radians) * velocity * SCALE * direction;
  let vy = -Math.sin(radians) * velocity * SCALE;
  let x = g.x;
  let y = g.y - GORILLA_RADIUS;

  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = gorillas[opponentIndex];

  for (let step = 0; step < 5000; step++) {
    vx += wind;
    vy += GRAVITY;
    x += vx;
    y += vy;

    // Off-screen check
    if (x < -50 || x > CANVAS_WIDTH + 50 || y > CANVAS_HEIGHT + 50) {
      return { result: 'miss' };
    }

    // Opponent hit check
    const dx = x - opponent.x;
    const dy = y - opponent.y;
    if (Math.sqrt(dx * dx + dy * dy) < GORILLA_RADIUS * 2) {
      return { result: 'gorillaHit' };
    }

    // Building collision check
    if (y > 0) {
      for (const b of buildings) {
        if (x >= b.x && x <= b.x + b.width && y >= CANVAS_HEIGHT - b.height) {
          return { result: 'buildingHit' };
        }
      }
    }
  }

  return { result: 'miss' };
}

function initRound(gameState) {
  gameState.buildings = generateBuildings();
  gameState.gorillas = placeGorillas(gameState.buildings);
  gameState.wind = (Math.random() - 0.5) * 0.2; // ±0.1
  gameState.lastThrow = null;
  gameState.phase = 'aiming';
}

module.exports = {
  id: 'gorillas',
  name: 'Gorillas',
  description: 'Throw bananas across the skyline!',

  init(session) {
    const playerIds = [...session.players].filter(([, p]) => p.connected !== false).map(([id]) => id);
    if (playerIds.length < 2) {
      return { phase: 'error', message: 'Need at least 2 players' };
    }

    const turnOrder = [playerIds[0], playerIds[1]];
    const gameState = {
      turnOrder,
      currentTurnIndex: 0,
      scores: [0, 0],
      pointsToWin: POINTS_TO_WIN,
      throwId: 0,
      lastThrow: null,
      phase: 'aiming',
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
      buildings: null,
      gorillas: null,
      wind: 0,
    };

    initRound(gameState);
    return gameState;
  },

  handleAction(session, playerId, action) {
    const gs = session.gameState;

    if (action.type === 'throw') {
      if (gs.phase !== 'aiming') return;
      if (gs.turnOrder[gs.currentTurnIndex] !== playerId) return;

      const angle = Math.max(0, Math.min(90, Number(action.angle) || 0));
      const velocity = Math.max(1, Math.min(100, Number(action.velocity) || 50));
      const playerIndex = gs.currentTurnIndex;

      const { result } = simulateThrow(
        playerIndex, angle, velocity, gs.wind, gs.buildings, gs.gorillas
      );

      gs.throwId++;
      gs.lastThrow = {
        throwId: gs.throwId,
        playerIndex,
        angle,
        velocity,
        wind: gs.wind,
        startX: gs.gorillas[playerIndex].x,
        startY: gs.gorillas[playerIndex].y - GORILLA_RADIUS,
        result,
      };

      if (result === 'gorillaHit') {
        gs.scores[playerIndex]++;
        if (gs.scores[playerIndex] >= gs.pointsToWin) {
          gs.phase = 'gameOver';
          gs.winner = playerIndex;
        } else {
          // New round
          gs.currentTurnIndex = gs.currentTurnIndex === 0 ? 1 : 0;
          initRound(gs);
          // Preserve the lastThrow so TV can animate before showing new round
          gs.lastThrow = {
            throwId: gs.throwId,
            playerIndex,
            angle,
            velocity,
            wind: gs.lastThrow.wind,
            startX: gs.lastThrow.startX,
            startY: gs.lastThrow.startY,
            result,
          };
        }
      } else {
        // miss or buildingHit — switch turns, new wind
        gs.currentTurnIndex = gs.currentTurnIndex === 0 ? 1 : 0;
        gs.wind = (Math.random() - 0.5) * 0.2;
      }
    } else if (action.type === 'playAgain') {
      if (playerId !== session.hostId) return;
      Object.assign(gs, module.exports.init(session));
    }
  },

  onPlayerLeave(session, playerId) {
    const gs = session.gameState;
    if (!gs || gs.phase === 'gameOver') return;

    const idx = gs.turnOrder.indexOf(playerId);
    if (idx === -1) return;

    // Active player left — other player wins
    gs.phase = 'gameOver';
    gs.winner = idx === 0 ? 1 : 0;
  },
};
