'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Chip, Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './Platform.module.css';

/** Highest number a limit takes (the server's too). */
const MAX = 100_000;

/**
 * One limit: − / + by `step`, the number typed straight in, a quick choice (`presets`: History
 * days' 7 / 30 / 90 / 365), or Unlimited. Says what the package gives and what the client has
 * now, in red when it's over.
 */
export function LimitField({
  id,
  name,
  value,
  step,
  packageValue,
  used,
  presets,
  about,
  onChange,
}: {
  id: string;
  name: string;
  value: number | null;
  step: number;
  /** The package's number (undefined: not shown, as on the Packages tab). */
  packageValue?: number | null;
  /** What the client has now (null or undefined: not counted). */
  used?: number | null;
  /** Quick numbers, as chips under it (in days). */
  presets?: readonly number[];
  /** What the limit covers, under its name. */
  about?: string;
  onChange: (value: number | null) => void;
}) {
  const t = useContent('common');
  const [text, setText] = useState(value === null ? '' : String(value));
  // Follows the value when it changes from outside (a package picked, − / +, Unlimited).
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(value === null ? '' : String(value));
  }
  const unlimited = value === null;
  const over = used != null && value !== null && used > value;
  const set = (n: number) => onChange(Math.min(Math.max(n, 0), MAX));

  const hint = [
    packageValue !== undefined
      ? t('platform.limits.package', {
          value: packageValue === null ? t('platform.limits.unlimited') : String(packageValue),
        })
      : null,
    used != null ? t('platform.limits.using', { used: String(used) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={styles.limit}>
      <div className={styles.limitText}>
        <label className={styles.limitName} htmlFor={id}>
          {name}
        </label>
        {about && <span className={styles.limitHint}>{about}</span>}
        {hint && (
          <span className={cx(styles.limitHint, over && styles.over)} id={`${id}-hint`}>
            {over ? t('platform.limits.over', { hint }) : hint}
          </span>
        )}
      </div>
      <div className={styles.stepper} role="group" aria-label={name}>
        <button
          type="button"
          aria-label={t('platform.limits.lower', { name })}
          disabled={unlimited || value <= 0}
          onClick={() => value !== null && set(value - step)}
        >
          <Icon name="minus" size="sm" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX}
          value={text}
          placeholder={t('platform.limits.infinity')}
          disabled={unlimited}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => {
            setText(event.target.value);
            const n = Number.parseInt(event.target.value, 10);
            if (!Number.isNaN(n)) set(n);
          }}
          onBlur={() => setText(value === null ? '' : String(value))}
        />
        <button
          type="button"
          aria-label={t('platform.limits.raise', { name })}
          disabled={unlimited || value >= MAX}
          onClick={() => value !== null && set(value + step)}
        >
          <Icon name="plus" size="sm" />
        </button>
      </div>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(event) =>
            onChange(event.target.checked ? null : (packageValue ?? used ?? step))
          }
        />
        {t('platform.limits.unlimited')}
      </label>
      {presets && (
        <div className={styles.presets} role="group" aria-label={t('platform.limits.presets')}>
          {presets.map((days) => (
            <Chip key={days} pressed={value === days} onClick={() => onChange(days)}>
              {t('platform.limits.days', { count: days })}
            </Chip>
          ))}
          <Chip pressed={unlimited} onClick={() => onChange(null)}>
            {t('platform.limits.unlimited')}
          </Chip>
        </div>
      )}
    </div>
  );
}
