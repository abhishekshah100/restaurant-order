import { useEffect, useMemo, useState } from 'react';
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
 * a button that copies the full link (`showLink`), for staff to share; never on paper.
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
  /** A "Copy link" button under the code: on screen only, not printed. */
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
      {showLink && <CopyLink link={link} table={code.table} />}
      <p className={styles.scan}>{t('adminQr.card.scan')}</p>
      <p className={styles.where}>
        {t('adminQr.card.where', { floor: code.floor.name, branch: branch.shortName })}
      </p>
    </article>
  );
}

/** How long "Link copied" shows before the button reads "Copy link" again. */
const COPIED_MS = 2000;

/** Copies the table's link to the clipboard; the link itself shows on hover. */
function CopyLink({ link, table }: { link: string; table: number }) {
  const t = useContent('common');
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const id = window.setTimeout(() => setState('idle'), COPIED_MS);
    return () => window.clearTimeout(id);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setState('copied');
    } catch {
      setState(copyBySelecting(link) ? 'copied' : 'failed');
    }
  };

  return (
    <button
      type="button"
      className={cx(styles.link, state === 'copied' && styles.copied)}
      title={link}
      aria-label={t('adminQr.card.copyLabel', { table })}
      onClick={() => void copy()}
    >
      <Icon name={state === 'copied' ? 'check' : 'copy'} size="xs" />
      <span aria-live="polite">
        {t(
          state === 'copied'
            ? 'adminQr.card.copied'
            : state === 'failed'
              ? 'adminQr.card.copyFailed'
              : 'adminQr.card.copy',
        )}
      </span>
    </button>
  );
}

/**
 * The older way to copy, for pages the clipboard API refuses (opened over plain http, as on a
 * tablet reaching a dev server by its network address): select the text and copy it.
 */
function copyBySelecting(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
