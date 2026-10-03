import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from '../Icon';
import { Spinner } from '../Spinner/Spinner';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark';
export type ButtonSize = 'sm' | 'md';

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Shows a spinner, keeps the brand fill and blocks clicks. */
  loading?: boolean;
  /** Text shown after a divider, e.g. the live price on "Add to cart | ₹409". */
  meta?: ReactNode;
  iconStart?: IconName;
  iconEnd?: IconName;
  className?: string;
  children: ReactNode;
}

export interface ButtonProps
  extends BaseProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  href?: undefined;
}

export interface ButtonLinkProps extends BaseProps {
  href: string;
  /** Render as a disabled-looking, non-interactive link. */
  disabled?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
}

function Content({ loading, iconStart, iconEnd, meta, children, size }: BaseProps) {
  const iconSize = size === 'sm' ? 'xs' : 'sm';
  return (
    <>
      {loading ? <Spinner /> : iconStart && <Icon name={iconStart} size={iconSize} />}
      {children}
      {meta !== undefined && (
        <>
          <span className={styles.sep} aria-hidden="true" />
          <span className={styles.meta}>{meta}</span>
        </>
      )}
      {!loading && iconEnd && <Icon name={iconEnd} size={iconSize} />}
    </>
  );
}

export function Button(props: ButtonProps | ButtonLinkProps) {
  const { variant = 'primary', size = 'md', block, loading, className } = props;
  const classes = cx(
    styles.btn,
    styles[variant],
    size === 'sm' && styles.sm,
    block && styles.block,
    loading && styles.loading,
    className,
  );

  if (props.href !== undefined) {
    const { href, disabled, onClick } = props;
    if (disabled) {
      return (
        <span className={classes} aria-disabled="true" role="link">
          <Content {...props} />
        </span>
      );
    }
    return (
      <Link href={href} className={classes} onClick={onClick} aria-label={props['aria-label']}>
        <Content {...props} />
      </Link>
    );
  }

  const {
    variant: _variant,
    size: _size,
    block: _block,
    loading: _loading,
    meta: _meta,
    iconStart: _iconStart,
    iconEnd: _iconEnd,
    className: _className,
    children: _children,
    type = 'button',
    disabled,
    onClick,
    ...rest
  } = props;
  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      <Content {...props} />
    </button>
  );
}
