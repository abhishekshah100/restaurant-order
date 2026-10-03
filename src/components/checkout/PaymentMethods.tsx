'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Icon, Tag, type IconName } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './Checkout.module.css';

export interface PaymentMethodOption<T extends string> {
  id: T;
  title: string;
  /** Shorter description below 1024px. */
  mobileSub: string;
  desktopSub: string;
  icon: IconName;
  /** A green tag next to the title, e.g. "Fastest". */
  tag?: string;
}

interface PaymentMethodsProps<T extends string> {
  /** Accessible name of the radio group. */
  label: string;
  methods: readonly PaymentMethodOption<T>[];
  value: T;
  onChange: (id: T) => void;
}

const NEXT_KEYS = ['ArrowDown', 'ArrowRight'];
const PREV_KEYS = ['ArrowUp', 'ArrowLeft'];

/**
 * Payment method cards (11 · w11): a radio group of rows on mobile, two cards across on web.
 * Arrow keys move the choice and focus, as in a native radio group.
 */
export function PaymentMethods<T extends string>({
  label,
  methods,
  value,
  onChange,
}: PaymentMethodsProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = NEXT_KEYS.includes(event.key) ? 1 : PREV_KEYS.includes(event.key) ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = methods.findIndex((m) => m.id === value);
    const next = methods[(index + step + methods.length) % methods.length].id;
    onChange(next);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-method="${next}"]`)?.focus();
  };

  return (
    <div ref={groupRef} className={styles.methods} role="radiogroup" aria-label={label}>
      {methods.map((m) => {
        const on = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-method={m.id}
            className={cx(styles.method, on && styles.methodOn)}
            onClick={() => onChange(m.id)}
            onKeyDown={onKeyDown}
          >
            <span className={styles.methodTopRow}>
              <span className={styles.radio} aria-hidden="true" />
              <span className={styles.methodBadge} aria-hidden="true">
                <Icon name={m.icon} />
              </span>
            </span>
            <span className={styles.methodBody}>
              <span className={styles.methodTitle}>
                <span className={styles.methodTitleText}>{m.title}</span>
                {m.tag && (
                  <span className={styles.mobileTag}>
                    <Tag variant="ok" icon={null}>
                      {m.tag}
                    </Tag>
                  </span>
                )}
              </span>
              <span className={styles.methodSub}>
                <span className="hide-desktop">{m.mobileSub}</span>
                <span className="hide-mobile">{m.desktopSub}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
