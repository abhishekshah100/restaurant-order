import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName, type IconSize } from '../Icon';
import styles from './IconButton.module.css';

export type IconButtonVariant = 'plain' | 'raised' | 'soft';

interface BaseProps {
  icon: IconName;
  /** Required: icon buttons have no visible text. */
  label: string;
  variant?: IconButtonVariant;
  size?: 'sm' | 'md';
  iconSize?: IconSize;
  className?: string;
  /** Extra content such as a badge. */
  children?: ReactNode;
}

export interface IconButtonProps
  extends
    BaseProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'aria-label'> {
  href?: undefined;
}

export interface IconLinkProps extends BaseProps {
  href: string;
  onClick?: () => void;
}

export function IconButton(props: IconButtonProps | IconLinkProps) {
  const { icon, label, variant = 'plain', size = 'md', iconSize, className, children } = props;
  const classes = cx(
    styles.btn,
    variant !== 'plain' && styles[variant],
    size === 'sm' && styles.sm,
    className,
  );
  const glyph = <Icon name={icon} size={iconSize ?? (size === 'sm' ? 'xs' : 'md')} />;

  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={classes} aria-label={label} onClick={props.onClick}>
        {glyph}
        {children}
      </Link>
    );
  }

  const {
    icon: _icon,
    label: _label,
    variant: _variant,
    size: _size,
    iconSize: _iconSize,
    className: _className,
    children: _children,
    type = 'button',
    ...rest
  } = props;
  return (
    <button {...rest} type={type} className={classes} aria-label={label}>
      {glyph}
      {children}
    </button>
  );
}
