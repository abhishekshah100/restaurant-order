'use client';

import type { KeyboardEvent } from 'react';
import { Chip, type IconName } from '@/components/ui';
import styles from './ChoiceChips.module.css';

export interface ChoiceChipsProps {
  id: string;
  /** Accessible name (id of the visible heading). */
  labelledBy: string;
  choices: string[];
  value: string;
  onChange: (choice: string) => void;
  icons?: Partial<Record<string, IconName>>;
}

/** Single-choice chips (e.g. spice level) with radiogroup arrow-key behaviour. */
export function ChoiceChips({ id, labelledBy, choices, value, onChange, icons }: ChoiceChipsProps) {
  const move = (from: number, delta: number) => {
    const next = (from + delta + choices.length) % choices.length;
    onChange(choices[next]);
    document.getElementById(`${id}-${next}`)?.focus();
  };
  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(index, -1);
    }
  };
  return (
    <div className={styles.chips} role="radiogroup" aria-labelledby={labelledBy}>
      {choices.map((choice, index) => (
        <Chip
          key={choice}
          id={`${id}-${index}`}
          role="radio"
          pressed={choice === value}
          tabIndex={choice === value ? 0 : -1}
          iconStart={icons?.[choice]}
          onClick={() => onChange(choice)}
          onKeyDown={onKeyDown(index)}
        >
          {choice}
        </Chip>
      ))}
    </div>
  );
}
