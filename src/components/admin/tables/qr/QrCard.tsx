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
 * sharp at any size), "Scan to order & pay", and the area and branch. On screen it can also show
 * the full link (`showLink`), for staff to check or copy; never on paper.
 */
export function QrCard({
  code,
  origin,
  className,
  showLink = false,
}: {
  code: TableQrCode;
  /** This app's address, put in front of the API's path. */
  origin: string;
  className?: string;
  /** The full link under the code: on screen only, not printed. */
  showLink?: boolean;
}) {
  const t = useContent('common');
  const restaurant = useRestaurant();
  const { branch } = useAdminWorkspace();
  const link = tableLink(origin, code.path);
  const { size, d } = useMemo(() => qrPath(link), [link]);
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
      {showLink && (
        <p className={styles.link} aria-label={t('adminQr.card.link', { table: code.table })}>
          {link}
        </p>
      )}
      <p className={styles.scan}>{t('adminQr.card.scan')}</p>
      <p className={styles.where}>
        {t('adminQr.card.where', { floor: code.floor.name, branch: branch.shortName })}
      </p>
    </article>
  );
}
