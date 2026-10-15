import { useMemo } from 'react';
import { useContent, useRestaurant } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { qrPath, tableLink } from '@/lib/tableQr';
import type { TableQrCode } from '@/types/admin';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import styles from './QrCard.module.css';

/**
 * The card printed on a table: the restaurant, the table number large, the QR code (drawn as SVG,
 * sharp at any size), "Scan to order & pay", and the area and branch.
 */
export function QrCard({
  code,
  origin,
  className,
}: {
  code: TableQrCode;
  /** This app's address, put in front of the API's path. */
  origin: string;
  className?: string;
}) {
  const t = useContent('common');
  const restaurant = useRestaurant();
  const { branch } = useAdminWorkspace();
  const { size, d } = useMemo(() => qrPath(tableLink(origin, code.path)), [origin, code.path]);
  return (
    <article className={cx(styles.card, className)}>
      <header className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <Icon name="olive" size="sm" />
        </span>
        <span className={styles.name}>{restaurant.name}</span>
      </header>
      <p className={styles.table}>{t('adminQr.card.table', { table: code.table })}</p>
      <svg
        className={styles.qr}
        viewBox={`-2 -2 ${size + 4} ${size + 4}`}
        role="img"
        aria-label={t('adminQr.card.alt', { table: code.table })}
        shapeRendering="crispEdges"
      >
        <rect x={-2} y={-2} width={size + 4} height={size + 4} className={styles.qrBack} />
        <path d={d} className={styles.qrModules} />
      </svg>
      <p className={styles.scan}>{t('adminQr.card.scan')}</p>
      <p className={styles.where}>
        {t('adminQr.card.where', { floor: code.floor.name, branch: branch.shortName })}
      </p>
    </article>
  );
}
