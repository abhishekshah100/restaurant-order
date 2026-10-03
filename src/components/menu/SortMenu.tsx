'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Chip, Icon, OptionGroup, Sheet } from '@/components/ui';
import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import type { SortKey } from '@/lib/menu';
import styles from './SortMenu.module.css';

export interface SortMenuProps {
  value: SortKey;
  onChange: (sort: SortKey) => void;
  options?: SortKey[];
  /** Open the list towards the right edge. */
  alignEnd?: boolean;
  /** popover (desktop) or a bottom sheet of radios (mobile chip rows that scroll). */
  presentation?: 'popover' | 'sheet';
}

/** "⇅ Recommended ▾" chip that opens a listbox of sort orders. */
export function SortMenu({
  value,
  onChange,
  options = ['recommended', 'price-asc', 'price-desc'],
  alignEnd,
  presentation = 'popover',
}: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const t = useContent('menu');
  const label = (sort: SortKey) => t(`sort.${sort}`);
  // In the sheet, arrow keys move the radio selection (and apply it) but keep the sheet open;
  // only an explicit pick (click, Enter or Space) closes it.
  const arrowKey = useRef(false);

  useEffect(() => {
    if (!open || presentation === 'sheet') return;
    listRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, presentation]);

  const close = () => {
    setOpen(false);
    rootRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  };
  const choose = (sort: SortKey) => {
    onChange(sort);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      close();
    }
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <Chip
        iconStart="sort"
        iconEnd="chevd"
        aria-haspopup={presentation === 'sheet' ? 'dialog' : 'listbox'}
        aria-expanded={open}
        aria-label={t('sort.current', { label: label(value) })}
        onClick={() => {
          setActive(Math.max(0, options.indexOf(value)));
          setOpen((o) => !o);
        }}
      >
        {value === 'recommended' || value === 'best-match' ? label(value) : t('sort.price')}
      </Chip>
      {presentation === 'sheet' && (
        <Sheet open={open} onClose={() => setOpen(false)} title={t('sort.sortBy')}>
          <div
            className={styles.contents}
            onKeyDownCapture={(e) => {
              arrowKey.current = e.key.startsWith('Arrow');
            }}
            onClickCapture={() => {
              arrowKey.current = false;
            }}
          >
            <OptionGroup
              id={`${listId}-sheet`}
              type="radio"
              title={t('sort.sortBy')}
              titleClassName="visually-hidden"
              value={value}
              onChange={(id) => {
                onChange(id as SortKey);
                if (!arrowKey.current) setOpen(false);
                arrowKey.current = false;
              }}
              choices={options.map((opt) => ({ id: opt, label: label(opt) }))}
            />
          </div>
        </Sheet>
      )}
      {open && presentation === 'popover' && (
        <ul
          ref={listRef}
          id={listId}
          className={cx(styles.menu, alignEnd && styles.end)}
          role="listbox"
          tabIndex={-1}
          aria-label={t('sort.sortBy')}
          aria-activedescendant={`${listId}-${options[active]}`}
          onKeyDown={onKeyDown}
        >
          {options.map((opt, i) => (
            <li
              key={opt}
              id={`${listId}-${opt}`}
              role="option"
              aria-selected={opt === value}
              className={cx(
                styles.option,
                i === active && styles.active,
                opt === value && styles.selected,
              )}
              onClick={() => choose(opt)}
              onPointerEnter={() => setActive(i)}
            >
              {label(opt)}
              {opt === value && <Icon name="check" size="xs" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
