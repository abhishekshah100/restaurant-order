import { useEffect } from 'react';

/**
 * With unsaved changes, leaving asks first: closing or reloading the tab (the browser's own
 * prompt) and following a link inside the app.
 */
export function useLeaveGuard(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!link || link.getAttribute('target') === '_blank') return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active, message]);
}
