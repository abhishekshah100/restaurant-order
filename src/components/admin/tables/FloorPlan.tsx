'use client';

import { useRouter } from 'next/navigation';
import { useContent, useFloorPlan } from '@/api/hooks';
import { Button, EmptyState } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { floorPath, qrCodesPath } from '@/lib/adminNav';
import { legendCounts, openFloor } from '@/lib/adminTables';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { FloorLegendBar } from './FloorLegendBar';
import { FloorTabs } from './FloorTabs';
import { TableCard } from './TableCard';
import styles from './FloorPlan.module.css';

/** Seated times ("26 min") move on this often. */
const SEATED_REFRESH_MS = 30_000;

/** Placeholder tiles while the plan loads. */
const SKELETON_TILES = 8;

/**
 * /admin/dashboard/tables/: the floor plan. One tab per area (Ground floor, First floor,
 * Outdoor…), the open area's tables counted by state, and a card per table that opens its
 * page. The open area is in the address (?floor=), so coming back from a table keeps it.
 * Read from GET /admin/branches/:branchId/tables, polled every 15 s.
 */
export function FloorPlan() {
  const t = useContent('common');
  const router = useRouter();
  const { branch } = useAdminWorkspace();
  const plan = useFloorPlan(branch.id);
  const floorId = useQueryParam('floor');
  const now = useNow(SEATED_REFRESH_MS);

  let content;
  if (plan.data) {
    const floor = openFloor(plan.data.floors, floorId);
    content = floor && (
      <>
        <div className={styles.bar}>
          <FloorTabs
            floors={plan.data.floors}
            value={floor.id}
            onChange={(id) => router.replace(floorPath(id), { scroll: false })}
          />
          <Button href={qrCodesPath()} variant="secondary" iconStart="qr" className={styles.qr}>
            {t('adminTables.openQr')}
          </Button>
        </div>
        <section
          id="floor-panel"
          role="tabpanel"
          aria-labelledby={`floor-tab-${floor.id}`}
          className={styles.panel}
        >
          <FloorLegendBar counts={legendCounts(floor.tables)} />
          {floor.tables.length > 0 ? (
            <ul className={styles.grid}>
              {floor.tables.map((table) => (
                <li key={table.table}>
                  <TableCard table={table} now={now} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>{t('adminTables.emptyFloor')}</p>
          )}
        </section>
      </>
    );
  } else if (plan.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminTables.error.title')}
        className={styles.state}
        actions={
          <Button iconStart="refresh" loading={plan.isFetching} onClick={() => plan.refetch()}>
            {t('adminTables.error.retry')}
          </Button>
        }
      >
        {t('adminTables.error.body')}
      </EmptyState>
    );
  } else {
    content = (
      <div className={styles.panel} role="status" aria-label={t('adminTables.loading')}>
        <ul className={styles.grid} aria-hidden="true">
          {Array.from({ length: SKELETON_TILES }, (_, i) => (
            <li key={i} className={styles.skeleton} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* The bar above already names the page; the heading is for screen readers. */}
      <h1 className="visually-hidden">{t('adminTables.title')}</h1>
      {content}
    </div>
  );
}
