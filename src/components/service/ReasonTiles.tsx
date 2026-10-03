'use client';

import type { KeyboardEvent } from 'react';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { WAITER_REASONS } from '@/lib/service';
import type { WaiterReason } from '@/types/service';
import styles from './WaiterRequestDialog.module.css';

interface ReasonTilesProps {
  value: WaiterReason;
  onChange: (reason: WaiterReason) => void;
  idPrefix: string;
}

/** Single-select reason tiles: a radiogroup with roving focus and arrow keys. */
export function ReasonTiles({ value, onChange, idPrefix }: ReasonTilesProps) {
  const t = useContent('service');
  const move = (event: KeyboardEvent<HTMLButtonElement>, from: number) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = WAITER_REASONS[(from + delta + WAITER_REASONS.length) % WAITER_REASONS.length];
    onChange(next.id);
    document.getElementById(`${idPrefix}-${next.id}`)?.focus();
  };

  return (
    <div className={styles.tiles} role="radiogroup" aria-label={t('waiterDialog.reasonsLabel')}>
      {WAITER_REASONS.map((reason, index) => {
        const checked = reason.id === value;
        return (
          <button
            key={reason.id}
            id={`${idPrefix}-${reason.id}`}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={cx(styles.tile, checked && styles.on)}
            onClick={() => onChange(reason.id)}
            onKeyDown={(event) => move(event, index)}
          >
            <Icon name={reason.icon} className={styles.tileIcon} />
            <span>{t(`waiterDialog.reasons.${reason.id}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
