'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import styles from './OptionRow.module.css';

export interface OptionRowProps {
  id?: string;
  type: 'radio' | 'checkbox';
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
  sub?: ReactNode;
  /** Right-aligned price text, e.g. "₹369", "+₹40", "Free". */
  price?: ReactNode;
  disabled?: boolean;
  /** Roving tabindex for radios (managed by OptionGroup). */
  tabIndex?: number;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

/** Variant (radio) or add-on (checkbox) row. Keeps the design's button + ARIA role pattern. */
export function OptionRow({
  id,
  type,
  checked,
  onChange,
  label,
  sub,
  price,
  disabled,
  tabIndex,
  onKeyDown,
}: OptionRowProps) {
  return (
    <button
      id={id}
      type="button"
      role={type}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={tabIndex}
      className={cx(styles.opt, checked && styles.on, disabled && styles.disabled)}
      onClick={() => !disabled && onChange()}
      onKeyDown={onKeyDown}
    >
      <span
        className={type === 'radio' ? styles.radio : cx(styles.check, checked && styles.checkOn)}
        aria-hidden="true"
      />
      <span className={styles.grow}>
        <span>{label}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
      {price !== undefined && <span className={styles.p}>{price}</span>}
      {type === 'radio' && (
        <span
          className={cx(styles.check, checked && styles.checkOn, styles.badge)}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export interface OptionChoice {
  id: string;
  label: ReactNode;
  sub?: ReactNode;
  price?: ReactNode;
  disabled?: boolean;
}

interface OptionGroupBase {
  /** Visible group title, e.g. "Choose a size". */
  title: ReactNode;
  /** Right-aligned hint, e.g. "Required" or "Optional · up to 3". */
  hint?: ReactNode;
  choices: OptionChoice[];
  /** Visual heading level for the title. */
  titleClassName?: string;
  /** list (default) · grid: 2 columns from 1024px. */
  layout?: 'list' | 'grid';
  /** Radios render as stacked tiles below 1024px (quick-add portions). */
  tilesOnMobile?: boolean;
  /** Heading element for the title (default h3). */
  headingAs?: 'h2' | 'h3';
  id: string;
}

export interface RadioGroupProps extends OptionGroupBase {
  type: 'radio';
  value: string | undefined;
  onChange: (id: string) => void;
}

export interface CheckboxGroupProps extends OptionGroupBase {
  type: 'checkbox';
  value: string[];
  onChange: (ids: string[]) => void;
  /** Max selectable; further unchecked rows become disabled. */
  max?: number;
}

/** Titled group of OptionRows with radiogroup keyboard support (arrows move + select). */
export function OptionGroup(props: RadioGroupProps | CheckboxGroupProps) {
  const t = useContent('common');
  const {
    title,
    hint,
    choices,
    id,
    titleClassName = 't-h3',
    layout = 'list',
    tilesOnMobile,
    headingAs: Heading = 'h3',
  } = props;
  const titleId = `${id}-title`;
  const listClass = cx(
    styles.opts,
    layout === 'grid' && styles.grid,
    tilesOnMobile && styles.tilesMobile,
  );

  if (props.type === 'radio') {
    const enabled = choices.filter((c) => !c.disabled);
    const focusId = props.value ?? enabled[0]?.id;
    const move = (from: string, delta: number) => {
      const index = enabled.findIndex((c) => c.id === from);
      const next = enabled[(index + delta + enabled.length) % enabled.length];
      if (!next) return;
      props.onChange(next.id);
      document.getElementById(`${id}-${next.id}`)?.focus();
    };
    return (
      <div>
        <div className={styles.head}>
          <Heading id={titleId} className={titleClassName}>
            {title}
          </Heading>
          {hint && <span className={styles.req}>{hint}</span>}
        </div>
        <div
          className={listClass}
          role="radiogroup"
          aria-labelledby={titleId}
          data-count={choices.length >= 4 ? 'many' : choices.length}
        >
          {choices.map((choice) => (
            <OptionRow
              key={choice.id}
              id={`${id}-${choice.id}`}
              type="radio"
              checked={props.value === choice.id}
              onChange={() => props.onChange(choice.id)}
              label={choice.label}
              sub={choice.sub}
              price={choice.price}
              disabled={choice.disabled}
              tabIndex={choice.id === focusId ? 0 : -1}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  move(choice.id, 1);
                } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                  event.preventDefault();
                  move(choice.id, -1);
                }
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  const { value, onChange, max } = props;
  const atLimit = max !== undefined && value.length >= max;
  return (
    <div>
      <div className={styles.head}>
        <Heading id={titleId} className={titleClassName}>
          {title}
        </Heading>
        {hint && <span className={styles.req}>{hint}</span>}
      </div>
      <div
        className={listClass}
        role="group"
        aria-labelledby={titleId}
        data-count={choices.length >= 4 ? 'many' : choices.length}
      >
        {choices.map((choice) => {
          const checked = value.includes(choice.id);
          return (
            <OptionRow
              key={choice.id}
              type="checkbox"
              checked={checked}
              onChange={() =>
                onChange(checked ? value.filter((v) => v !== choice.id) : [...value, choice.id])
              }
              label={choice.label}
              sub={
                choice.sub ??
                (!checked && atLimit ? t('options.addOnLimit', { max: max ?? 0 }) : undefined)
              }
              price={choice.price}
              disabled={choice.disabled || (!checked && atLimit)}
            />
          );
        })}
      </div>
    </div>
  );
}
