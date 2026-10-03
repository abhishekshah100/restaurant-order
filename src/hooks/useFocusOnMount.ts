'use client';

import { useEffect, useRef } from 'react';

/**
 * Moves focus to the element when it mounts: for a screen that replaces the previous one in
 * place (a payment's processing, failed and done states), so keyboard and screen-reader users
 * start from its heading. Give the element `tabIndex={-1}`.
 */
export function useFocusOnMount<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled) ref.current?.focus();
  }, [enabled]);
  return ref;
}
