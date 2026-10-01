import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from '../Icon';
import styles from './Banner.module.css';

export type BannerTone = 'warn' | 'err' | 'info' | 'ok';

const DEFAULT_ICON: Record<BannerTone, IconName> = {
  warn: 'clock',
  err: 'wifioff',
  info: 'info',
  ok: 'checkc',
};

export interface BannerProps {
  tone: BannerTone;
  icon?: IconName;
  children: ReactNode;
  action?: ReactNode;
  /** Announce politely (status) or assertively (alert). */
  live?: 'polite' | 'assertive';
  className?: string;
}

export function Banner({ tone, icon, children, action, live, className }: BannerProps) {
  return (
    <div
      className={cx(styles.banner, styles[tone], className)}
      role={live === 'assertive' ? 'alert' : live === 'polite' ? 'status' : undefined}
    >
      <Icon name={icon ?? DEFAULT_ICON[tone]} size="sm" />
      <div className={styles.text}>{children}</div>
      {action}
    </div>
  );
}
