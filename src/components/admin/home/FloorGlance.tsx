'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useContent, useFloorPlan } from '@/api/hooks';
import { Chip, Icon, Skeleton } from '@/components/ui';
import { ADMIN_LINKS, tablePath } from '@/lib/adminNav';
import {
  FLOOR_FILTERS,
  floorSummary,
  inFloorFilter,
  needsAttention,
  tableFlag,
  type FloorFilter,
} from '@/lib/adminHome';
import { useAdminName, useAdminStaffId } from '@/hooks/useAdminSession';
import { initialsOf, legendOf, myTables } from '@/lib/adminTables';
import { cx } from '@/lib/cx';
import type { AdminFloorTable } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { NoteTags } from '../tables/NoteTags';
import { useSeatedLabel } from '../tables/useSeatedLabel';
import styles from './FloorGlance.module.css';
import tones from '../tables/tableTones.module.css';
import panels from './HomePanels.module.css';

/**
 * The floor at a glance: how busy it is (tables and seats taken, free, reserved), then every
 * table as a small tile in its state's colour with how long the guests have sat and what they
 * owe, and a tag when it needs a look (seated with no order yet, a long wait for food). All ·
 * Needs a look · Free narrow it; a tile opens the table. Read from GET …/tables (polled).
 */
export function FloorGlance({ now }: { now: Date | null }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const plan = useFloorPlan(branch.id);
  // None picked: My tables when I cover any, else All.
  const [picked, setPicked] = useState<FloorFilter | null>(null);
  const me = { id: useAdminStaffId(), name: useAdminName() };

  const header = (
    <header className={panels.head}>
      <div>
        <h2 id="floor-title" className={panels.title}>
          {t('adminHome.floor.title')}
        </h2>
        <p className={panels.subtitle}>{t('adminHome.floor.subtitle')}</p>
      </div>
      <Link href={ADMIN_LINKS.tables} className={panels.all}>
        {t('adminHome.floor.all')}
        <Icon name="chev" size="xs" />
      </Link>
    </header>
  );

  if (!plan.data || !now) {
    return (
      <section className={panels.panel} aria-labelledby="floor-title">
        {header}
        <div className={styles.body} role="status" aria-label={t('adminHome.floor.loading')}>
          <Skeleton shape="block" width="100%" height={160} />
        </div>
      </section>
    );
  }

  const floors = plan.data.floors;
  const summary = floorSummary(floors, now);
  const mine = myTables(floors, me);
  const filter: FloorFilter = picked ?? (mine.size > 0 ? 'mine' : 'all');
  const setFilter = setPicked;
  // My tables shows once I cover any (or while it's picked).
  const filters = FLOOR_FILTERS.filter((f) => f !== 'mine' || mine.size > 0 || filter === 'mine');
  const counts: Record<FloorFilter, number> = {
    mine: mine.size,
    all: summary.tables,
    attention: summary.attention,
    free: summary.free,
  };
  const shown = floors
    .map((floor) => ({
      ...floor,
      tables: floor.tables.filter(
        (tb) =>
          (filter === 'all' || tb.status !== 'outOfService') &&
          inFloorFilter(tb, filter, now, mine),
      ),
    }))
    .filter((floor) => floor.tables.length > 0);
  const busyShare = summary.tables > 0 ? (summary.busy / summary.tables) * 100 : 0;

  return (
    <section className={panels.panel} aria-labelledby="floor-title">
      {header}
      <div className={styles.body}>
        {summary.tables > 0 && (
          <div className={styles.summary}>
            <p className={styles.busy}>
              {t('adminHome.floor.busy', { busy: summary.busy, tables: summary.tables })}
              <span className={styles.seats}>
                {t('adminHome.floor.seats', { taken: summary.seatsTaken, seats: summary.seats })}
              </span>
            </p>
            <div className={styles.bar} aria-hidden="true">
              <span style={{ width: `${busyShare}%` }} />
            </div>
            <p className={styles.counts}>
              <span className={styles.freeDot} aria-hidden="true" />
              {t('adminHome.floor.free', { count: summary.free })}
              {summary.reserved > 0 && (
                <>
                  <span className={styles.reservedDot} aria-hidden="true" />
                  {t('adminHome.floor.reserved', { count: summary.reserved })}
                </>
              )}
            </p>
          </div>
        )}

        <div
          className={styles.filters}
          role="group"
          aria-label={t('adminHome.floor.filters.label')}
        >
          {filters.map((f) => (
            <Chip key={f} pressed={filter === f} count={counts[f]} onClick={() => setFilter(f)}>
              {t(`adminHome.floor.filters.${f}`)}
            </Chip>
          ))}
        </div>

        {shown.length > 0 ? (
          shown.map((floor) => (
            <div key={floor.id} className={styles.floor}>
              {floors.length > 1 && <h3 className={styles.floorName}>{floor.name}</h3>}
              <ul className={styles.grid}>
                {floor.tables.map((table) => (
                  <li key={table.table}>
                    <Tile table={table} now={now} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className={styles.empty}>
            {summary.tables === 0
              ? t('adminHome.floor.empty')
              : filter === 'mine'
                ? t('adminHome.floor.emptyMine')
                : filter === 'attention'
                  ? t('adminHome.floor.emptyAttention')
                  : t('adminHome.floor.emptyFree')}
          </p>
        )}
      </div>
    </section>
  );
}

/** One table: number, state, then what matters about it now; a tag when it needs a look. */
function Tile({ table, now }: { table: AdminFloorTable; now: Date }) {
  const t = useContent('common');
  const { money, clock } = useAdminWorkspace();
  const seatedLabel = useSeatedLabel();
  const status = t(`adminTables.status.${table.status}`);
  const flag = tableFlag(table, now);
  const seated = seatedLabel(table.seatedAt, now);
  const lines = [
    seated,
    table.due > 0 ? t('adminHome.floor.due', { amount: money.format(table.due) }) : null,
    table.booking && (table.status === 'available' || table.status === 'reserved')
      ? t('adminHome.floor.next', { time: clock.time(table.booking.at) })
      : null,
  ].filter(Boolean);

  return (
    <Link
      href={tablePath(table.table)}
      data-state={legendOf(table.status)}
      className={cx(
        styles.tile,
        tones[legendOf(table.status)],
        needsAttention(table, now) && styles.alert,
      )}
      aria-label={t('adminHome.floor.tile', {
        table: table.table,
        status: [
          status,
          flag ? t(`adminHome.floor.flags.${flag}`) : null,
          table.waiter ? t('adminHome.floor.coveredBy', { name: table.waiter.name }) : null,
        ]
          .filter(Boolean)
          .join(', '),
      })}
    >
      <span className={styles.top}>
        <span className={styles.number}>{table.table}</span>
        {table.waiter ? (
          <span className={styles.waiter} title={table.waiter.name}>
            {initialsOf(table.waiter.name)}
          </span>
        ) : (
          <span className={styles.seatsOf}>
            <Icon name="user" size="xs" />
            {table.seats}
          </span>
        )}
      </span>
      <span className={styles.status}>
        <span className={styles.dot} />
        {status}
      </span>
      {lines.length > 0 && <span className={styles.line}>{lines.join(' · ')}</span>}
      {table.note && <NoteTags tags={table.note.tags} max={1} />}
      {flag && <span className={styles.flag}>{t(`adminHome.floor.flags.${flag}`)}</span>}
    </Link>
  );
}
