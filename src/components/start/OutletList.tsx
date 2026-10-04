'use client';

import { useRef, type KeyboardEvent } from 'react';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { createClock } from '@/lib/clock';
import { cx } from '@/lib/cx';
import { branchModes } from '@/lib/fulfilment';
import type { Branch } from '@/types/branch';
import { MODE_ICON } from './ModeOptions';
import styles from './OutletList.module.css';

export interface OutletListProps {
  branches: readonly Branch[];
  value: string | null;
  onChange: (branchId: string) => void;
  /** Accessible name of the radio group. */
  label: string;
}

const NEXT_KEYS = ['ArrowDown', 'ArrowRight'];
const PREV_KEYS = ['ArrowUp', 'ArrowLeft'];

/** "Open · until 9:00 PM", "Closed · opens 11:00 AM" or "Ordering paused", with its tone. */
function useOutletStatus() {
  const t = useContent('home');
  return (branch: Branch) => {
    if (branch.status === 'open') {
      return { tone: styles.open, text: t('start.openUntil', { time: branch.closesAt }) };
    }
    if (branch.status === 'paused') return { tone: styles.paused, text: t('start.paused') };
    return { tone: styles.closed, text: t('start.closedOpens', { time: branch.opensAt }) };
  };
}

/**
 * The outlets as radio cards: name, address, whether it's open (and until when, in its own
 * time), its local time, and the ways it takes orders.
 */
export function OutletList({ branches, value, onChange, label }: OutletListProps) {
  const t = useContent('home');
  const common = useContent('common');
  const status = useOutletStatus();
  const now = useNow();
  const groupRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = NEXT_KEYS.includes(event.key) ? 1 : PREV_KEYS.includes(event.key) ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = branches.findIndex((b) => b.id === value);
    const next = branches[(index + step + branches.length) % branches.length].id;
    onChange(next);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-branch="${next}"]`)?.focus();
  };

  return (
    <div ref={groupRef} role="radiogroup" aria-label={label} className={styles.list}>
      {branches.map((branch, i) => {
        const on = branch.id === value;
        const { tone, text } = status(branch);
        return (
          <button
            key={branch.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-branch={branch.id}
            tabIndex={on || (value === null && i === 0) ? 0 : -1}
            className={cx(styles.outlet, on && styles.on)}
            onClick={() => onChange(branch.id)}
            onKeyDown={onKeyDown}
          >
            <span className={styles.badge} aria-hidden="true">
              <Icon name="store" />
            </span>
            <span className={styles.body}>
              <span className={styles.name}>{branch.name}</span>
              <span className={styles.address}>{branch.address}</span>
              <span className={styles.meta}>
                <span className={cx(styles.status, tone)}>{text}</span>
                {now && (
                  <span className={styles.time}>
                    <Icon name="clock" size="xs" />
                    {t('start.localTime', { time: createClock(branch).time(now) })}
                  </span>
                )}
              </span>
              <span className={styles.modes}>
                {branchModes(branch).map((mode) => (
                  <span key={mode} className={styles.mode}>
                    <Icon name={MODE_ICON[mode]} size="xs" />
                    {common(`modes.${mode}`)}
                  </span>
                ))}
              </span>
            </span>
            <span className={styles.radio} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
