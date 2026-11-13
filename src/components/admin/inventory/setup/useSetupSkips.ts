'use client';

import { useCallback, useState } from 'react';
import type { SetupStep } from '@/lib/inventorySetup';

/*
 * The optional Get started steps (warnings, recipes) someone chose to skip, per branch, on this
 * device: a convenience only, so the guide stops asking. Any other device simply offers them
 * again from Today; nothing depends on it.
 */

const key = (branchId: string) => `olive.inventory.setupSkips.v1.${branchId}`;

function read(branchId: string): Set<SetupStep> {
  try {
    const raw = window.localStorage.getItem(key(branchId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(list)
        ? list.filter((s): s is SetupStep => s === 'levels' || s === 'recipes')
        : [],
    );
  } catch {
    return new Set();
  }
}

export function useSetupSkips(branchId: string) {
  const [skips, setSkips] = useState<Set<SetupStep>>(() => read(branchId));
  const skip = useCallback(
    (step: SetupStep) => {
      setSkips((current) => {
        const next = new Set(current).add(step);
        try {
          window.localStorage.setItem(key(branchId), JSON.stringify([...next]));
        } catch {
          // Blocked storage: skipped until the page reloads.
        }
        return next;
      });
    },
    [branchId],
  );
  return { skips, skip };
}
