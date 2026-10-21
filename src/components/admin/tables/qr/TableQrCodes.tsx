'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useContent, useTableQrCodes } from '@/api/hooks';
import { Button, Chip, Icon } from '@/components/ui';
import { ADMIN_LINKS } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { usePrintSheet } from './PrintSheet';
import { QrCard } from './QrCard';
import { useOrigin } from './useOrigin';
import { useQrDownload } from './useQrDownload';
import styles from './TableQrCodes.module.css';

/**
 * /admin/dashboard/tables/qr/: a QR card for every table, by area. Pick an area, select cards
 * (or all), and print them on A4 — or download one as a PNG. Read from GET
 * /admin/branches/:branchId/tables/qr-codes.
 */
export function TableQrCodes() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const codes = useTableQrCodes(branch.id);
  const origin = useOrigin();
  const [floor, setFloor] = useState<string | 'all'>('all');
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const { print, sheet } = usePrintSheet(origin);
  const download = useQrDownload(origin);

  const all = codes.data?.codes ?? [];
  const floors = [...new Map(all.map((c) => [c.floor.id, c.floor])).values()];
  const shown = floor === 'all' ? all : all.filter((c) => c.floor.id === floor);
  const picked = all.filter((c) => selected.has(c.table));
  const toggle = (table: number) => {
    const next = new Set(selected);
    if (next.has(table)) next.delete(table);
    else next.add(table);
    setSelected(next);
  };

  return (
    <div className={styles.page}>
      <Link href={ADMIN_LINKS.tables} className={styles.back}>
        <Icon name="back" size="xs" />
        {t('adminQr.back')}
      </Link>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{t('adminQr.title')}</h1>
          <p className={styles.subtitle}>{t('adminQr.subtitle')}</p>
        </div>
        <Button iconStart="check" disabled={picked.length === 0} onClick={() => print(picked)}>
          {picked.length > 0
            ? t.plural('adminQr.printSelected', picked.length)
            : t('adminQr.print')}
        </Button>
      </header>

      <div className={styles.tools}>
        {/* One area: nothing to choose between. */}
        {floors.length > 1 && (
          <div className={styles.floors} role="group" aria-label={t('adminQr.floors')}>
            <Chip pressed={floor === 'all'} onClick={() => setFloor('all')}>
              {t('adminQr.allFloors')}
            </Chip>
            {floors.map((f) => (
              <Chip key={f.id} pressed={floor === f.id} onClick={() => setFloor(f.id)}>
                {f.name}
              </Chip>
            ))}
          </div>
        )}
        <div className={styles.selection}>
          <span className={styles.count}>{t.plural('adminQr.selected', picked.length)}</span>
          <button
            type="button"
            className={styles.link}
            onClick={() => setSelected(new Set([...selected, ...shown.map((c) => c.table)]))}
          >
            {t('adminQr.selectAll')}
          </button>
          {picked.length > 0 && (
            <button type="button" className={styles.link} onClick={() => setSelected(new Set())}>
              {t('adminQr.clear')}
            </button>
          )}
        </div>
      </div>

      {origin && codes.data ? (
        <ul className={styles.grid}>
          {shown.map((code) => {
            const on = selected.has(code.table);
            return (
              <li key={code.table} className={cx(styles.item, on && styles.on)}>
                <label className={styles.pick}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(code.table)}
                    aria-label={t('adminQr.select', { table: code.table })}
                  />
                </label>
                <QrCard code={code} origin={origin} showLink />
                <Button
                  size="sm"
                  variant="secondary"
                  iconStart="arrow"
                  className={styles.download}
                  aria-label={t('adminQr.downloadLabel', { table: code.table })}
                  onClick={() => void download(code)}
                >
                  {t('adminQr.download')}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={styles.skeleton} role="status" aria-label={t('adminQr.loading')} />
      )}
      <p className={styles.tip}>{t('adminQr.tip')}</p>
      {sheet}
    </div>
  );
}
