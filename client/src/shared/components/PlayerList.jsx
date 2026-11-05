export default function PlayerList({ players, myId, className = '' }) {
  return (
    <ul className={`flex flex-col gap-2 ${className}`}>
      {players.map((p) => (
        <li
          key={p.id}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-light/50 ${
            p.id === myId ? 'border-l-3 border-accent' : ''
          } ${p.connected === false ? 'opacity-50' : ''}`}
        >
          <span className="text-base">{p.name}</span>
          {p.connected === false && (
            <span className="text-xs text-muted-light">reconnecting...</span>
          )}
          {p.isHost && (
            <span className="text-xs font-bold text-accent bg-accent/20 px-2 py-0.5 rounded">
              HOST
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
