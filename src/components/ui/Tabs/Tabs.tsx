'use client';

import Link from 'next/link';
import { useCallback, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
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

/** Inset of the indicator bar from each side of the tab label. */
const INDICATOR_INSET = 2;

/**
 * Underlined tab strip. With `href` items it renders a <nav> of links
 * (aria-current marks the active one); otherwise a group of toggle buttons
 * with a roving tabindex: Tab enters on the active button, arrows / Home / End move.
 *
 * The strip scrolls sideways: soft fades on the edges show there's more, the
 * active tab is scrolled into view, and a rounded indicator slides under it.
 */
export function Tabs({ items, value, onChange, label, flush, className }: TabsProps) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const mounted = useRef(false);
  const isNav = items.every((item) => item.href !== undefined);

  /** Edge fades: only where there is more to scroll to. */
  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.dataset.moreLeft = String(el.scrollLeft > 2);
    el.dataset.moreRight = String(el.scrollLeft < max - 2);
  }, []);

  /** Moves the indicator under the active tab and keeps that tab in view. */
  const place = useCallback(
    (behavior: ScrollBehavior) => {
      const el = scrollRef.current;
      const bar = indicatorRef.current;
      const active = el?.querySelector<HTMLElement>('[data-active="true"]');
      if (!el || !bar || !active) return;
      bar.style.width = `${Math.max(0, active.offsetWidth - INDICATOR_INSET * 2)}px`;
      bar.style.transform = `translateX(${active.offsetLeft + INDICATOR_INSET}px)`;
      el.dataset.ready = 'true';

      const left = active.offsetLeft;
      const right = left + active.offsetWidth;
      const viewLeft = el.scrollLeft;
      const viewRight = viewLeft + el.clientWidth;
      if (left < viewLeft + 24 || right > viewRight - 40) {
        const target = left - (el.clientWidth - active.offsetWidth) / 2;
        el.scrollTo({ left: Math.max(0, target), behavior });
      }
      updateFades();
    },
    [updateFades],
  );

  useLayoutEffect(() => {
    place(mounted.current ? 'smooth' : 'auto');
    mounted.current = true;
  }, [value, items, place]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reflow = () => place('auto');
    const observer = new ResizeObserver(reflow);
    observer.observe(el);
    // Web fonts change label widths once they load.
    document.fonts?.ready.then(reflow).catch(() => {});
    return () => observer.disconnect();
  }, [place]);

  const indicator = <span ref={indicatorRef} className={styles.indicator} aria-hidden="true" />;
  const scrollerClass = cx(styles.tabs, flush && styles.flush);

  // Roving tabindex: only the active button (or the first, if none is) is in the tab order.
  const tabStop = items.some((item) => item.id === value) ? value : items[0]?.id;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(scrollRef.current?.querySelectorAll('button') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next].focus();
  }

  return (
    <div className={cx(styles.wrap, className)}>
      {isNav ? (
        <nav
          ref={(el) => {
            scrollRef.current = el;
          }}
          className={scrollerClass}
          aria-label={label}
          onScroll={updateFades}
        >
          {items.map((item) => {
            const on = item.id === value;
            return (
              <Link
                key={item.id}
                href={item.href as string}
                className={cx(styles.tab, on && styles.on)}
                aria-current={on ? 'true' : undefined}
                data-active={on || undefined}
              >
                {item.label}
              </Link>
            );
          })}
          {indicator}
        </nav>
      ) : (
        <div
          ref={(el) => {
            scrollRef.current = el;
          }}
          className={scrollerClass}
          role="group"
          aria-label={label}
          onKeyDown={onKeyDown}
          onScroll={updateFades}
        >
          {items.map((item) => {
            const on = item.id === value;
            return (
              <button
                key={item.id}
                type="button"
                className={cx(styles.tab, on && styles.on)}
                aria-pressed={on}
                tabIndex={item.id === tabStop ? 0 : -1}
                data-active={on || undefined}
                onClick={() => onChange?.(item.id)}
              >
                {item.label}
              </button>
            );
          })}
          {indicator}
        </div>
      )}
    </div>
  );
}
