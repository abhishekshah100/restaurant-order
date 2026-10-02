import Link from 'next/link';
import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from '../Icon';
import { VegMark } from '../VegMark/VegMark';
import styles from './Chip.module.css';

interface BaseProps {
  children: ReactNode;
  /** Leading veg / non-veg mark. */
  veg?: boolean;
  iconStart?: IconName;
  iconEnd?: IconName;
  count?: number;
  size?: 'md' | 'lg';
  className?: string;
}

export interface ChipProps extends BaseProps {
  /** Toggle state; renders aria-pressed (or aria-checked with role="radio"). */
  pressed?: boolean;
  /** Single-choice chip inside a radiogroup. */
  role?: 'radio';
  tabIndex?: number;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  id?: string;
  onClick?: () => void;
  href?: undefined;
  'aria-label'?: string;
  'aria-haspopup'?: 'listbox' | 'menu' | 'dialog';
  'aria-expanded'?: boolean;
}

export interface ChipLinkProps extends BaseProps {
  href: string;
  pressed?: undefined;
  onClick?: () => void;
}

function Inner({ veg, iconStart, iconEnd, count, children }: BaseProps) {
  return (
    <>
      {veg !== undefined && <VegMark veg={veg} decorative />}
      {iconStart && <Icon name={iconStart} size="xs" />}
      {children}
      {count !== undefined && <span className={styles.count}>{count}</span>}
      {iconEnd && <Icon name={iconEnd} size="xs" />}
    </>
  );
}

export function Chip(props: ChipProps | ChipLinkProps) {
  const classes = cx(
    styles.chip,
    props.pressed && styles.on,
    props.size === 'lg' && styles.lg,
    props.className,
  );
  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={classes} onClick={props.onClick}>
        <Inner {...props} />
      </Link>
    );
  }
  return (
    <button
      id={props.id}
      type="button"
      className={classes}
      role={props.role}
      tabIndex={props.tabIndex}
      onKeyDown={props.onKeyDown}
      aria-checked={props.role === 'radio' ? Boolean(props.pressed) : undefined}
      aria-pressed={props.role === 'radio' ? undefined : props.pressed}
      onClick={props.onClick}
      aria-label={props['aria-label']}
      aria-haspopup={props['aria-haspopup']}
      aria-expanded={props['aria-expanded']}
    >
      <Inner {...props} />
    </button>
  );
}
