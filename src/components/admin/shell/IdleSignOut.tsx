'use client';

import { useEffect, useRef, useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Dialog } from '@/components/ui';
import {
  ACTIVITY_THROTTLE_MS,
  idleState,
  localStore,
  noteIdleSignOut,
  readLastActive,
  writeLastActive,
  type IdleState,
} from '@/lib/idleSignOut';
import styles from './IdleSignOut.module.css';
import { useShellActions } from './useShellActions';

/** What counts as using the screen (moving the mouse doesn't: a bump isn't someone there). */
const USE_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
const TICK_MS = 1_000;

/**
 * Signs the staff screen out when nobody has used it for a while (lib/idleSignOut): "Still
 * there?" a minute before, then the sign-in page, which says why. Any use on any staff tab of
 * this device keeps it signed in; so does coming back to the warning.
 */
export function IdleSignOut() {
  const t = useContent('common');
  const { signOut } = useShellActions();
  const signOutRef = useRef(signOut);
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);
  const [state, setState] = useState<IdleState>({ kind: 'active' });
  /** Marks a use now (the warning's buttons and Esc go through here too). */
  const usedRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const storage = localStore();
    // Sessions from before this was added (nothing written yet) count from now.
    let mine = readLastActive(storage) ?? Date.now();
    if (readLastActive(storage) === null) writeLastActive(storage, mine);
    let written = 0;
    let done = false;

    const lastUse = () => Math.max(readLastActive(storage) ?? 0, mine);
    const check = () => {
      if (done) return;
      const next = idleState(Date.now(), lastUse());
      if (next.kind === 'expired') {
        done = true;
        noteIdleSignOut(storage);
        signOutRef.current();
        return;
      }
      setState((prev) =>
        prev.kind === next.kind &&
        (next.kind !== 'warning' ||
          (prev.kind === 'warning' && prev.secondsLeft === next.secondsLeft))
          ? prev
          : next,
      );
    };
    const used = () => {
      const now = Date.now();
      mine = now;
      if (now - written >= ACTIVITY_THROTTLE_MS) {
        written = now;
        writeLastActive(storage, now);
      }
      setState((prev) => (prev.kind === 'active' ? prev : { kind: 'active' }));
    };
    usedRef.current = used;
    // Back from another app or a sleeping screen: check at once, not at the next tick.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    const timer = window.setInterval(check, TICK_MS);
    for (const name of USE_EVENTS) {
      window.addEventListener(name, used, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      done = true;
      window.clearInterval(timer);
      for (const name of USE_EVENTS) window.removeEventListener(name, used, { capture: true });
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (state.kind !== 'warning') return null;
  return (
    <Dialog
      open
      onClose={() => usedRef.current()}
      presentation="modal"
      title={t('adminIdle.title')}
      description={t('adminIdle.body', { seconds: state.secondsLeft })}
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => signOutRef.current()}>
            {t('adminIdle.signOut')}
          </Button>
          <Button iconStart="check" onClick={() => usedRef.current()}>
            {t('adminIdle.stay')}
          </Button>
        </div>
      }
    >
      {null}
    </Dialog>
  );
}
