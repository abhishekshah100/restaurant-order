/*
 * The server said the guest's session has ended (it expired, or staff freed its table: the
 * guests left). Whatever request found out, the session provider lets the session go and starts
 * over: a new visit from the table's QR link (name and number asked again), or the start screen.
 * A tiny relay, so the query client (which sees every failed request) needn't import the provider.
 */

let restart: (() => void) | null = null;

/** The session provider's way to start over (one provider: the last one registered). */
export function onGuestSessionEnded(handler: () => void): () => void {
  restart = handler;
  return () => {
    if (restart === handler) restart = null;
  };
}

export function guestSessionEnded(): void {
  restart?.();
}
