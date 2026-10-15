import { useSyncExternalStore } from 'react';

/** This app's address (empty while prerendering: QR codes draw once it's known). */
export const useOrigin = () =>
  useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => '',
  );
