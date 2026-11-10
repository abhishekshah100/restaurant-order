'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { HistoryServiceRequest, RequestOutcome } from '@/api/contracts';
import { useContent, useRequestHistory } from '@/api/hooks';
import { Button, Chip, EmptyState, Icon, Skeleton } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { ADMIN_LINKS, tablePath } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import { isTodayOnly, parseDayRange, type DayRange } from '@/lib/dayRange';
import { DateRangeFilter } from '../DateRangeFilter';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useRequestText } from './useRequestText';
import styles from './RequestHistory.module.css';

const KINDS = ['all', 'waiter', 'bill', 'kitchen'] as const;
type Kind = (typeof KINDS)[number];
const isKind = (v: string | null): v is Kind => KINDS.some((k) => k === v);

const HISTORY_PATH = `${ADMIN_LINKS.requests}history/`;

const OUTCOME_ICON = { resolved: 'checkc', lapsed: 'alert', open: 'clock' } as const;

/**
 * /admin/dashboard/requests/history/: the branch's past requests (Requests › History). Pick the
 * days (today without any; up to 31, back a year) and the kind; a summary (how many, done, not
 * answered, the average answer time), then each request, newest first: when, where, what was
 * asked, who answered and how fast, and how it ended. The days and kind stay in the address.
 * Read from GET …/service-requests/history.
 */
export function RequestHistory() {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const router = useRouter();
  const now = useNow(60_000);
  const today = clock.dayKey(now ?? new Date());
  const days = parseDayRange(useQueryParam('from'), useQueryParam('to'), today);
  const kindParam = useQueryParam('kind');
  const kind: Kind = isKind(kindParam) ? kindParam : 'all';
  const history = useRequestHistory(
    branch.id,
    days.from,
    days.to,
    kind === 'all' ? undefined : kind,
  );

  const goTo = (range: DayRange, nextKind: Kind = kind) => {
    const search = new URLSearchParams();
    if (!isTodayOnly(range, today)) {
      search.set('from', range.from);
      search.set('to', range.to);
    }
    if (nextKind !== 'all') search.set('kind', nextKind);
    const query = search.toString();
    router.replace(query ? `${HISTORY_PATH}?${query}` : HISTORY_PATH, { scroll: false });
  };

  let content;
  if (history.data) {
    const { requests, summary } = history.data;
    content = (
      <>
        <dl className={styles.summary}>
          <Tile label={t('adminRequests.history.summary.total')} value={String(summary.total)} />
          <Tile
            label={t('adminRequests.history.summary.resolved')}
            value={String(summary.resolved)}
            tone="ok"
          />
          <Tile
            label={t('adminRequests.history.summary.lapsed')}
            value={String(summary.lapsed)}
            tone={summary.lapsed > 0 ? 'warn' : undefined}
          />
          <Tile
            label={t('adminRequests.history.summary.average')}
            value={
              summary.averageAnswerMinutes === null
                ? t('adminRequests.history.summary.averageNone')
                : t('adminRequests.history.summary.averageValue', {
                    count: summary.averageAnswerMinutes,
                  })
            }
          />
        </dl>
        {requests.length === 0 ? (
          <p className={styles.empty}>
            {kind === 'all'
              ? t('adminRequests.history.empty')
              : t('adminRequests.history.emptyKind')}
          </p>
        ) : (
          <ol className={styles.list}>
            {requests.map((request) => (
              <HistoryRow key={request.id} request={request} />
            ))}
          </ol>
        )}
        <p className={styles.note}>{t('adminRequests.history.cancelledNote')}</p>
      </>
    );
  } else if (history.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminRequests.history.error')}
        actions={
          <Button
            iconStart="refresh"
            loading={history.isFetching}
            onClick={() => history.refetch()}
          >
            {t('adminHome.error.retry')}
          </Button>
        }
      />
    );
  } else {
    content = (
      <div role="status" aria-label={t('adminRequests.history.loading')} className={styles.loading}>
        <Skeleton shape="block" height={84} />
        <Skeleton shape="block" height={240} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <Link href={ADMIN_LINKS.requests} className={styles.back}>
          <Icon name="back" size="sm" />
          {t('adminRequests.history.back')}
        </Link>
        <h1 className={styles.title}>{t('adminRequests.history.title')}</h1>
        <p className="t-small c2">{t('adminRequests.history.subtitle')}</p>
      </div>
      <DateRangeFilter
        id="request-history-days"
        range={days}
        today={today}
        onChange={(range) => goTo(range)}
      />
      <div className={styles.filters} role="group" aria-label={t('adminRequests.filters.label')}>
        {KINDS.map((k) => (
          <Chip key={k} pressed={kind === k} onClick={() => goTo(days, k)}>
            {t(`adminRequests.filters.${k}`)}
          </Chip>
        ))}
      </div>
      {content}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={styles.tile}>
      <dt>{label}</dt>
      <dd className={tone ? styles[tone] : undefined}>{value}</dd>
    </div>
  );
}

/** One request: when, where, what, who answered and how fast, and how it ended. */
function HistoryRow({ request }: { request: HistoryServiceRequest }) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const text = useRequestText()(request);
  const outcome: RequestOutcome = request.outcome;
  const answered =
    request.answeredInMinutes === undefined
      ? null
      : request.answeredInMinutes === 0
        ? t('adminRequests.history.answered.now')
        : t('adminRequests.history.answered.minutes', { count: request.answeredInMinutes });
  const who = request.resolvedBy ?? request.acknowledgedBy;
  return (
    <li className={styles.row}>
      <span className={styles.when}>
        <span className={styles.time}>{clock.time(request.requestedAt)}</span>
        <span className="t-small c3">{clock.date(request.requestedAt)}</span>
      </span>
      <span className={styles.where}>
        {request.table !== undefined ? (
          <Link href={tablePath(request.table)} className={styles.tableLink}>
            {t('adminRequests.history.table', { table: request.table })}
          </Link>
        ) : (
          <span className="t-small c2">{t('adminRequests.history.noTable')}</span>
        )}
      </span>
      <span className={styles.what}>
        <span className={styles.whatTitle}>{text.title}</span>
        {text.detail && <span className="t-small c2">{text.detail}</span>}
      </span>
      <span className={styles.outcome}>
        <span className={cx(styles.badge, styles[outcome])}>
          <Icon name={OUTCOME_ICON[outcome]} size="xs" />
          {t(`adminRequests.history.outcome.${outcome}`)}
        </span>
        {(answered || who) && (
          <span className="t-small c3">
            {[answered, who ? t('adminRequests.history.by', { name: who }) : null]
              .filter(Boolean)
              .join(' ')}
          </span>
        )}
      </span>
    </li>
  );
}
