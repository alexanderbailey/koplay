import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ role, authToken, screenMode, code, quizId, onAuthError, children }) {
  const socketRef = useRef(null);
  const [sessionState, setSessionState] = useState(null);
  const [myId, setMyId] = useState(null);
  const onAuthErrorRef = useRef(onAuthError);
  onAuthErrorRef.current = onAuthError;

  useEffect(() => {
    const query = { role };
    if (authToken) query.authToken = authToken;
    if (screenMode) query.screenMode = screenMode;
    if (code) query.code = code;
    if (quizId) query.quizId = quizId;

    const socket = io({ query });
    socketRef.current = socket;

    socket.on('connect', () => setMyId(socket.id));
    socket.on('session:state', (state) => setSessionState(state));
    socket.on('auth:error', (data) => {
      if (onAuthErrorRef.current) onAuthErrorRef.current(data?.message || 'Authentication failed');
    });

    return () => socket.disconnect();
  }, [role, authToken, screenMode, code, quizId]);

  const emit = useCallback((event, ...args) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  const value = { socket: socketRef.current, sessionState, myId, emit };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

/** Offline provider for local UI previews (no Socket.IO connection). */
export function MockSocketProvider({ sessionState = null, myId = 'dev', children }) {
  const value = { socket: null, sessionState, myId, emit: () => {} };
  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}
