import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

// Phones keep a per-game-code player secret so that when the websocket drops
// (app switch, screen lock, page reload) they reconnect as the same player.
function secretKey(code) {
  return `koplay:player:${code}`;
}

function loadSecret(code) {
  try {
    return localStorage.getItem(secretKey(code));
  } catch {
    return null;
  }
}

function saveSecret(code, secret) {
  try {
    if (secret) localStorage.setItem(secretKey(code), secret);
    else localStorage.removeItem(secretKey(code));
  } catch {
    // Storage unavailable (private mode): reconnects still work within this page.
  }
}

export function SocketProvider({ role, authToken, screenMode, code, quizId, onAuthError, children }) {
  const socketRef = useRef(null);
  const [sessionState, setSessionState] = useState(null);
  const [myId, setMyId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const onAuthErrorRef = useRef(onAuthError);
  onAuthErrorRef.current = onAuthError;

  useEffect(() => {
    const query = { role };
    if (authToken) query.authToken = authToken;
    if (screenMode) query.screenMode = screenMode;
    if (code) query.code = code;
    if (quizId) query.quizId = quizId;

    const isPlayer = role === 'player';
    // In-memory fallback for when localStorage is unavailable.
    let memSecret = null;
    let replacedHere = false;
    const opts = { query };
    if (isPlayer) {
      // Evaluated on every connect and reconnect, so the latest secret is sent.
      opts.auth = (cb) => cb({ playerSecret: loadSecret(code) || memSecret });
    }

    const socket = io(opts);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (!isPlayer) setMyId(socket.id);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('session:state', (state) => setSessionState(state));
    socket.on('player:identity', ({ playerId, secret, replaced: wasReplaced }) => {
      if (wasReplaced) {
        // Another tab/browser took over this seat; it shares our storage, so leave it alone.
        replacedHere = true;
        setMyId(null);
        setReplaced(true);
        socket.disconnect();
        return;
      }
      memSecret = secret || null;
      saveSecret(code, secret);
      setMyId(playerId || null);
    });
    socket.on('auth:error', (data) => {
      if (onAuthErrorRef.current) onAuthErrorRef.current(data?.message || 'Authentication failed');
    });

    // Mobile browsers often kill the socket while the page is in the background
    // and back off before retrying; reconnect straight away when it's visible again.
    // disconnect() + connect() cancels any pending backoff and dials immediately.
    function handleVisible() {
      if (document.visibilityState !== 'visible' || socket.connected || replacedHere) return;
      socket.disconnect();
      socket.connect();
    }
    if (isPlayer) {
      document.addEventListener('visibilitychange', handleVisible);
      window.addEventListener('pageshow', handleVisible);
    }

    return () => {
      if (isPlayer) {
        document.removeEventListener('visibilitychange', handleVisible);
        window.removeEventListener('pageshow', handleVisible);
      }
      socket.disconnect();
    };
  }, [role, authToken, screenMode, code, quizId]);

  const emit = useCallback((event, ...args) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  const value = { socket: socketRef.current, sessionState, myId, emit, connected, replaced };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
