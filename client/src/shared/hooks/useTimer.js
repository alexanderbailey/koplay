import { useState, useEffect } from 'react';
import { serverNow } from '../clock';

// Whole seconds left until `endsAt` (a server timestamp), counted on the server clock.

export function useTimer(endsAt) {
  const [remaining, setRemaining] = useState(() =>
    endsAt ? Math.max(0, Math.ceil((endsAt - serverNow()) / 1000)) : 0
  );

  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }

    function tick() {
      setRemaining(Math.max(0, Math.ceil((endsAt - serverNow()) / 1000)));
    }
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return remaining;
}
