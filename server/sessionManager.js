const crypto = require('crypto');

// Players are keyed by a stable server-issued player ID, not by socket ID, so a
// phone that drops its websocket (app switch, screen lock, network blip) can
// reconnect as the same player. Each player also holds a private `secret` that
// is handed to their phone only; presenting it on (re)connect rebinds the new
// socket to the existing player. The secret is never included in public state.
class SessionManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = 'waiting';
    this.hostId = null;
    this.players = new Map();
    this.currentGame = null;
    this.gameState = null;
    this._private = null;
    this.authUser = null;
  }

  addPlayer(socketId, name, avatarId, noiseId) {
    for (const [, player] of this.players) {
      if (player.socketId === socketId) {
        return { error: 'Already joined' };
      }
      if (player.name.toLowerCase() === name.toLowerCase()) {
        return { error: 'Name already taken' };
      }
      if (avatarId && player.avatarId === avatarId) {
        return { error: 'Avatar already taken' };
      }
      if (noiseId && player.noiseId === noiseId) {
        return { error: 'Sound already taken' };
      }
    }

    const id = crypto.randomBytes(8).toString('hex');
    const secret = crypto.randomBytes(24).toString('hex');
    this.players.set(id, {
      name,
      avatarId: avatarId || null,
      noiseId: noiseId || null,
      secret,
      socketId,
      connected: true,
    });

    if (!this.hostId) {
      this.hostId = id;
      this.state = 'lobby';
    }

    return { ok: true, id, secret };
  }

  findBySecret(secret) {
    if (!secret || typeof secret !== 'string') return null;
    for (const [id, player] of this.players) {
      if (player.secret === secret) return id;
    }
    return null;
  }

  // Bind a (new) socket to an existing player.
  attachSocket(id, socketId) {
    const player = this.players.get(id);
    if (!player) return false;
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = null;
    return true;
  }

  // Returns true if the player was marked disconnected; false if the socket is
  // stale (the player has already reconnected on another socket).
  markDisconnected(id, socketId) {
    const player = this.players.get(id);
    if (!player || player.socketId !== socketId) return false;
    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = Date.now();
    return true;
  }

  // Pass host to a connected player if the current host is not connected.
  promoteConnectedHost() {
    const host = this.players.get(this.hostId);
    if (host && host.connected) return false;
    for (const [id, player] of this.players) {
      if (player.connected) {
        this.hostId = id;
        return true;
      }
    }
    return false;
  }

  removePlayer(id) {
    this.players.delete(id);

    if (id === this.hostId) {
      this.hostId = null;
      for (const [pid, player] of this.players) {
        if (player.connected) { this.hostId = pid; break; }
      }
      if (!this.hostId) this.hostId = this.players.keys().next().value || null;
    }

    if (this.players.size === 0) {
      this.state = 'waiting';
      this.hostId = null;
      this.currentGame = null;
      this.gameState = null;
      this._private = null;
      this.authUser = null;
    }
  }

  selectGame(gameModule) {
    this.currentGame = { id: gameModule.id, name: gameModule.name };
    this.state = 'playing';
    this.gameState = gameModule.init(this);
  }

  getPublicState() {
    const players = [];
    const takenAvatars = [];
    const takenNoises = [];
    for (const [id, player] of this.players) {
      players.push({
        id,
        name: player.name,
        isHost: id === this.hostId,
        avatarId: player.avatarId,
        noiseId: player.noiseId,
        connected: player.connected,
      });
      if (player.avatarId) takenAvatars.push(player.avatarId);
      if (player.noiseId) takenNoises.push(player.noiseId);
    }

    return {
      state: this.state,
      hostId: this.hostId,
      players,
      takenAvatars,
      takenNoises,
      currentGame: this.currentGame,
      gameState: this.gameState,
      hostAuthenticated: !!this.authUser,
      hostAuthName: this.authUser ? this.authUser.name : null,
    };
  }
}

module.exports = SessionManager;
