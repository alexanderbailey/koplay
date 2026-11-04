# Development

Architecture notes for contributors live in [CLAUDE.md](../CLAUDE.md). The short version:

- `server/index.js` wires Express and Socket.IO. Every mutation ends with `broadcastState()`, which sends the full room state to all clients in that room.
- `server/rooms.js` holds one session per screen/room. `server/sessionManager.js` is the per-room state machine. Games live in `server/games/` and are registered in `server/games/index.js`.
- `client/src/tv/` is the display app, `client/src/phone/` the phone app, `client/src/shared/` the common code, and `client/src/games/` the lazy-loaded game components.

## Adding a game

1. Create `server/games/yourGame.js` exporting `{ id, name, description, init, handleAction, onPlayerLeave }`. Keep per-room data on the `session` object, not in module variables, so rooms stay isolated.
2. Register it in `server/games/index.js`.
3. Create `client/src/games/yourGame/` with an `index.js` (metadata and lazy imports), `YourGameTV.jsx` (props `{ gameState, players }`) and `YourGamePhone.jsx` (props `{ gameState, myId, isHost, players, emit }`).
4. Register it in `client/src/games/registry.js` and add it to `availableGames`.

## Browser compatibility

The display still targets Samsung Tizen 5 (Chrome 63). See the compatibility section of CLAUDE.md before using modern CSS or JS in display code.

## UI previews (no quiz / socket)

With the Vite client running (`npm run dev` in `client/`, or `npm run dev:client` from the repo root):

- [Trivia reveal + explanation popup](http://localhost:5173/dev-trivia-reveal.html) - toggles for explanation on/off, visible, long text, image, and replay pop-in. Uses the real `TriviaTV` component with fake state; not included in production builds.
