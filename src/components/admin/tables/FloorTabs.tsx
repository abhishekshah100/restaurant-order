'use client';

import { useRef, type KeyboardEvent } from 'react';
import { useContent } from '@/api/hooks';
import type { AdminFloor } from '@/types/admin';
import styles from './FloorTabs.module.css';

/**
 * One tab per area, each with how many of its tables are free. A tab list: Tab enters on the
 * open area, the arrow keys and Home / End move between areas.
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
        const free = floor.tables.filter((table) => table.status === 'available').length;
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
            <span className={styles.name}>{floor.name}</span>
            <span className={styles.free}>
              {t('adminTables.floorFree', { free, total: floor.tables.length })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
