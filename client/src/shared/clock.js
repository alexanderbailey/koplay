// Server clock, as seen from this device.
//
// TV clocks are often set wrong, so countdowns must not compare the server's
// `endsAt` with the local Date.now(). Every session:state carries the server's
// time (`serverNow`); we keep the offset between the two clocks here.
//
// Each sample is late by the network delay, so it can only underestimate the
// true offset: keep the largest one seen, but start over if the local clock
// clearly jumped (e.g. the TV corrected its time mid-game).
const JUMP_MS = 2000;

let offset = 0;
let synced = false;

export function syncServerClock(serverTime) {
  if (typeof serverTime !== 'number') return;
  const sample = serverTime - Date.now();
  if (!synced || sample > offset || offset - sample > JUMP_MS) {
    offset = sample;
    synced = true;
  }
}

export function serverNow() {
  return Date.now() + offset;
}
