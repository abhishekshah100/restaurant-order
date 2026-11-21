'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AuditArea, AuditEvent } from '@/api/contracts';
import { api } from '@/api/endpoints';
import { useAuditLog, useContent } from '@/api/hooks';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { Button, Chip, EmptyState, Icon, Skeleton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { tablePath } from '@/lib/adminNav';
import { isTodayOnly, parseDayRange, type DayLimits, type DayRange } from '@/lib/dayRange';
import { DateRangeFilter } from '../DateRangeFilter';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useAuditText } from './useAuditText';
import styles from './AuditLog.module.css';
import { downloadFile } from '@/lib/saveFile';

// The bill pop-up and the Payments page's printing: downloaded the first time a bill opens.
const AuditBill = dynamic(() => import('./AuditBill').then((m) => m.AuditBill), {
  ssr: false,
  loading: () => <LoadingSignal />,
});

/** Setting changes shown before "Show all". */
const CHANGES_SHOWN = 5;

const AREAS = ['all', 'orders', 'tables', 'invoices', 'cash', 'menu', 'settings', 'staff'] as const;
type AreaFilter = (typeof AREAS)[number];
const isArea = (v: string | null): v is AreaFilter => AREAS.some((a) => a === v);

/** The server's limits: seven years back, 92 days at a time. */
const AUDIT_LIMITS: DayLimits = { historyDays: 7 * 366, rangeDays: 92 };

const AUDIT_PATH = '/admin/dashboard/audit/';

const AREA_ICON = {
  orders: 'receipt',
  tables: 'table',
  invoices: 'list',
  cash: 'cash',
  menu: 'menu',
  settings: 'sliders',
  staff: 'user',
} as const;

const areaOf = (action: AuditEvent['action']): AuditArea => {
  if (action.startsWith('cash.')) return 'cash';
  if (action.startsWith('menu.')) return 'menu';
  if (action.startsWith('settings.')) return 'settings';
  if (action.startsWith('table.')) return 'tables';
  if (action.startsWith('invoice.') || action.startsWith('order.buyer')) return 'invoices';
  if (action.startsWith('staff.') || action.startsWith('role.') || action.startsWith('session.')) {
    return 'staff';
  }
  return 'orders';
};

/**
 * /admin/dashboard/audit/ (`audit.view`): who did what at the branch, newest first. Pick the
 * days (today without any; up to 92, back seven years), what (an area) and who; each entry says
 * what happened in a sentence, with why and the particulars (a settings change field by field,
 * before → after), and links to its table or opens its bill (View bill: the Payments page's
 * order pop-up, read when opened). 100 at a time ("Load more"); the days as filtered download as CSV. The filters stay in the address.
 * Read from GET …/audit; nothing here changes an entry (they can't be).
 */
export function AuditLog() {
  const t = useContent('common');
  const { branch, clock, filePrefix } = useAdminWorkspace();
  const token = useAdminToken();
  const { showToast } = useToast();
  const router = useRouter();
  const now = useNow(60_000);
  const today = clock.dayKey(now ?? new Date());
  const days = parseDayRange(useQueryParam('from'), useQueryParam('to'), today, AUDIT_LIMITS);
  const areaParam = useQueryParam('area');
  const area: AreaFilter = isArea(areaParam) ? areaParam : 'all';
  const staffId = useQueryParam('staff') ?? undefined;
  const [exporting, setExporting] = useState(false);
  const [bill, setBill] = useState<string | null>(null);
  const query = {
    from: days.from,
    to: days.to,
    ...(area !== 'all' ? { area } : {}),
    ...(staffId ? { staffId } : {}),
  };
  const log = useAuditLog(branch.id, query);

  const goTo = (range: DayRange, next: { area?: AreaFilter; staff?: string | null } = {}) => {
    const search = new URLSearchParams();
    if (!isTodayOnly(range, today)) {
      search.set('from', range.from);
      search.set('to', range.to);
    }
    const nextArea = next.area ?? area;
    if (nextArea !== 'all') search.set('area', nextArea);
    const nextStaff = next.staff === undefined ? staffId : next.staff;
    if (nextStaff) search.set('staff', nextStaff);
    const qs = search.toString();
    router.replace(qs ? `${AUDIT_PATH}?${qs}` : AUDIT_PATH, { scroll: false });
  };

  const download = async () => {
    if (!token || exporting) return;
    setExporting(true);
    try {
      const blob = await api.auditExport(token, branch.id, query);
      downloadFile(
        new Blob([blob], { type: 'text/csv' }),
        `${filePrefix} - Activity log ${days.from} to ${days.to}.csv`,
      );
    } catch {
      showToast(t('adminAudit.exportFailed'), { tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const pages = log.data?.pages ?? [];
  const events = pages.flatMap((p) => p.events);
  const staff = pages[0]?.staff ?? [];
  const filtered = area !== 'all' || Boolean(staffId);

  let content;
  if (log.data) {
    content =
      events.length === 0 ? (
        <p className={styles.empty}>
          {filtered ? t('adminAudit.emptyFiltered') : t('adminAudit.empty')}
        </p>
      ) : (
        <>
          <ol className={styles.list}>
            {events.map((event) => (
              <AuditRow key={event.id} event={event} onBill={setBill} />
            ))}
          </ol>
          {log.hasNextPage && (
            <Button
              variant="secondary"
              className={styles.more}
              loading={log.isFetchingNextPage}
              onClick={() => void log.fetchNextPage()}
            >
              {t('adminAudit.more')}
            </Button>
          )}
        </>
      );
  } else if (log.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminAudit.error')}
        actions={
          <Button iconStart="refresh" loading={log.isFetching} onClick={() => log.refetch()}>
            {t('adminHome.error.retry')}
          </Button>
        }
      />
    );
  } else {
    content = (
      <div role="status" aria-label={t('adminAudit.loading')} className={styles.loading}>
        <Skeleton shape="block" height={64} />
        <Skeleton shape="block" height={64} />
        <Skeleton shape="block" height={64} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{t('adminAudit.title')}</h1>
          <Button
            variant="secondary"
            size="sm"
            iconStart="list"
            loading={exporting}
            aria-label={t('adminAudit.exportLabel')}
            onClick={() => void download()}
          >
            {t('adminAudit.export')}
          </Button>
        </div>
        <p className="t-small c2">{t('adminAudit.subtitle')}</p>
      </div>
      <DateRangeFilter
        id="audit-days"
        range={days}
        today={today}
        limits={AUDIT_LIMITS}
        onChange={(range) => goTo(range)}
      />
      <div className={styles.filters} role="group" aria-label={t('adminAudit.areas.label')}>
        {AREAS.map((a) => (
          <Chip key={a} pressed={area === a} onClick={() => goTo(days, { area: a })}>
            {t(`adminAudit.areas.${a}`)}
          </Chip>
        ))}
      </div>
      <div className={styles.toolbar}>
        <label className={styles.who}>
          <span className={styles.whoLabel}>{t('adminAudit.staff')}</span>
          <select
            className={styles.select}
            value={staffId ?? ''}
            onChange={(event) => goTo(days, { staff: event.target.value || null })}
          >
            <option value="">{t('adminAudit.everyone')}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {log.data && (
          <span className="t-small c2">
            {t.plural('adminAudit.count', events.length)}
            {log.hasNextPage ? '+' : ''}
          </span>
        )}
      </div>
      {content}
      {bill && <AuditBill orderId={bill} onClose={() => setBill(null)} />}
    </div>
  );
}

/**
 * One entry: when, who, what happened (a sentence), why, the particulars (or each setting
 * changed), its table, and View bill when it's about an order.
 */
function AuditRow({ event, onBill }: { event: AuditEvent; onBill: (order: string) => void }) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const text = useAuditText()(event);
  const [allChanges, setAllChanges] = useState(false);
  const changes = text.changes ?? [];
  const shownChanges = allChanges ? changes : changes.slice(0, CHANGES_SHOWN);
  const area = areaOf(event.action);
  const table =
    event.target?.type === 'table'
      ? Number(event.target.id)
      : typeof event.details?.to === 'number'
        ? event.details.to
        : undefined;
  return (
    <li className={styles.row}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name={AREA_ICON[area]} size="sm" />
      </span>
      <span className={styles.what}>
        <span className={styles.title2}>{text.title}</span>
        {text.detail && <span className={styles.detail}>{text.detail}</span>}
        {event.reason && (
          <span className={styles.reason}>
            {t('adminAudit.reason', { reason: text.reason ?? event.reason })}
          </span>
        )}
        {changes.length > 0 && (
          <ul className={styles.changes}>
            {shownChanges.map((change, index) => (
              <li key={index} className={styles.change}>
                <span className={styles.changeLabel}>{change.label}</span>
                <span className={styles.changeValues}>
                  <span className={styles.changeBefore}>{change.before}</span>
                  <Icon name="arrow" size="xs" className={styles.changeArrow} />
                  <span className={styles.changeAfter}>{change.after}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {changes.length > CHANGES_SHOWN && (
          <button
            type="button"
            className={styles.changesToggle}
            aria-expanded={allChanges}
            onClick={() => setAllChanges((all) => !all)}
          >
            {allChanges
              ? t('adminAudit.changes.showFewer')
              : t('adminAudit.changes.showAll', { count: changes.length })}
          </button>
        )}
        {(text.order || (table !== undefined && Number.isFinite(table))) && (
          <span className={styles.links}>
            {text.order && (
              <button
                type="button"
                className={styles.billButton}
                aria-label={t('adminAudit.bill.viewLabel', { order: text.order })}
                onClick={() => onBill(text.order as string)}
              >
                <Icon name="receipt" size="xs" />
                {t('adminAudit.bill.view')}
              </button>
            )}
            {table !== undefined && Number.isFinite(table) && (
              <Link href={tablePath(table)} className={styles.tableLink}>
                {t('adminRequests.history.table', { table })}
              </Link>
            )}
          </span>
        )}
      </span>
      <span className={styles.when}>
        <span className={styles.by}>{event.by?.name ?? t('adminAudit.nobody')}</span>
        {event.by?.roles && event.by.roles.length > 0 && (
          <span className={styles.roles}>{event.by.roles.join(', ')}</span>
        )}
        <span className="t-small c3">
          {clock.date(event.at)} · {clock.time(event.at)}
        </span>
      </span>
    </li>
  );
}
