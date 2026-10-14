'use client';

import { useRef, type KeyboardEvent } from 'react';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { legendCounts } from '@/lib/adminTables';
import type { AdminFloor } from '@/types/admin';
import styles from './FloorTabs.module.css';

/**
 * One tab per area, as a small card: its name, how many tables are free, and a red bell with a
 * count when tables there need a waiter or the bill, so staff know where to go before opening
 * it. A tab list: Tab enters on the open area, the arrow keys and Home / End move.
 */
export function FloorTabs({
  floors,
  value,
  onChange,
}: {
  floors: readonly AdminFloor[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useContent('common');
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent) => {
    const index = floors.findIndex((floor) => floor.id === value);
    const last = floors.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(floors[next].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={t('adminTables.floors')}
      className={styles.tabs}
      onKeyDown={onKeyDown}
    >
      {floors.map((floor) => {
        const selected = floor.id === value;
        const total = floor.tables.length;
        const counts = legendCounts(floor.tables);
        const attention = counts.needsWaiter + counts.wantsBill;
        return (
          <button
            key={floor.id}
            id={`floor-tab-${floor.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="floor-panel"
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(floor.id)}
          >
            <span className={styles.text}>
              <span className={styles.name}>{floor.name}</span>
              <span className={styles.free}>
                <span className={styles.freeDot} aria-hidden="true" />
                {t('adminTables.floorFree', { free: counts.available, total })}
              </span>
            </span>
            {attention > 0 && (
              <span
                className={styles.attention}
                aria-label={t.plural('adminTables.floorAttention', attention)}
              >
                <Icon name="bell" size="xs" />
                {attention}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
