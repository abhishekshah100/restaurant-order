'use client';

import Link from 'next/link';
import { useRef, type KeyboardEvent } from 'react';
import { cx } from '@/lib/cx';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  /** When set, the tab is a link (navigation tabs). */
  href?: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  /** Called for button tabs; link tabs navigate. */
  onChange?: (id: string) => void;
  /** Accessible name for the tab strip. */
  label: string;
  flush?: boolean;
  className?: string;
}

/**
 * Underlined tab strip. With `href` items it renders a <nav> of links
 * (aria-current marks the active one); otherwise a filter-style group of
 * toggle buttons with arrow-key navigation.
 */
export function Tabs({ items, value, onChange, label, flush, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isNav = items.every((item) => item.href !== undefined);
  const classes = cx(styles.tabs, flush && styles.flush, className);

  if (isNav) {
    return (
      <nav className={classes} aria-label={label}>
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href as string}
            className={cx(styles.tab, item.id === value && styles.on)}
            aria-current={item.id === value ? 'true' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const buttons = Array.from(listRef.current?.querySelectorAll('button') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  return (
    <div ref={listRef} className={classes} role="group" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cx(styles.tab, item.id === value && styles.on)}
          aria-pressed={item.id === value}
          onClick={() => onChange?.(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
