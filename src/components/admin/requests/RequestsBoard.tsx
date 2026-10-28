'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useBranchService, useContent } from '@/api/hooks';
import { useAcknowledgeRequest, useResolveRequest } from '@/api/mutations';
import { Button, Chip, EmptyState, Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminName } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { tablePath } from '@/lib/adminNav';
import {
  REQUEST_FILTERS,
  handledInMinutes,
  requestCounts,
  requestGroups,
  type RequestFilter,
} from '@/lib/adminRequests';
import type { AdminServiceRequest } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { RequestCard } from './RequestCard';
import { useRequestText } from './useRequestText';
import styles from './RequestsBoard.module.css';

/** Waits ("3 min ago") move on this often. */
const AGE_REFRESH_MS = 20_000;

/**
 * /admin/dashboard/requests/: every waiter call and bill request at the branch. Filter by kind;
 * Waiting (oldest first) with On my way and Done; On the way (who has it) with Done; and what
 * was done in the last 30 minutes, by whom and how fast. On my way tells the guest who's coming.
 * Read from GET /admin/branches/:branchId/service, polled every 15 s.
 */
export function RequestsBoard() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const service = useBranchService(branch.id);
  const now = useNow(AGE_REFRESH_MS);
  const me = useAdminName();
  const [filter, setFilter] = useState<RequestFilter>('all');
  const { showToast } = useToast();
  const acknowledge = useAcknowledgeRequest();
  const resolve = useResolveRequest();
  const failed = () => showToast(t('adminRequests.failed'), { tone: 'error' });

  const card = (request: AdminServiceRequest) => (
    <RequestCard
      key={request.id}
      request={request}
      now={now}
      me={me}
      onAcknowledge={() =>
        acknowledge.mutate(
          { branchId: branch.id, request, by: me ?? '', at: new Date().toISOString() },
          { onError: failed },
        )
      }
      onResolve={() => resolve.mutate({ branchId: branch.id, request }, { onError: failed })}
    />
  );

  let content;
  if (service.data) {
    const counts = requestCounts(service.data.requests);
    const { waiting, coming, done } = requestGroups(service.data, filter);
    content = (
      <>
        <div className={styles.filters} role="group" aria-label={t('adminRequests.filters.label')}>
          {REQUEST_FILTERS.map((f) => (
            <Chip key={f} pressed={filter === f} count={counts[f]} onClick={() => setFilter(f)}>
              {t(`adminRequests.filters.${f}`)}
            </Chip>
          ))}
        </div>

        {waiting.length + coming.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <Icon name="check" size="md" />
            </span>
            <p className={styles.emptyTitle}>{t('adminRequests.empty.title')}</p>
            <p className={styles.emptyBody}>
              {filter === 'all'
                ? t('adminRequests.empty.body')
                : t(`adminRequests.emptyFilter.${filter}`)}
            </p>
          </div>
        ) : (
          <>
            {waiting.length > 0 && (
              <section className={styles.section} aria-labelledby="waiting-title">
                <SectionHead
                  id="waiting-title"
                  title={t('adminRequests.waiting.title')}
                  subtitle={t('adminRequests.waiting.subtitle')}
                  count={waiting.length}
                />
                <ol className={styles.list}>{waiting.map(card)}</ol>
              </section>
            )}
            {coming.length > 0 && (
              <section className={styles.section} aria-labelledby="coming-title">
                <SectionHead
                  id="coming-title"
                  title={t('adminRequests.coming.title')}
                  subtitle={t('adminRequests.coming.subtitle')}
                  count={coming.length}
                />
                <ol className={styles.list}>{coming.map(card)}</ol>
              </section>
            )}
          </>
        )}

        <DoneList done={done} />
      </>
    );
  } else if (service.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminHome.error.title')}
        className={styles.state}
        actions={
          <Button
            iconStart="refresh"
            loading={service.isFetching}
            onClick={() => service.refetch()}
          >
            {t('adminHome.error.retry')}
          </Button>
        }
      >
        {t('adminHome.error.body')}
      </EmptyState>
    );
  } else {
    content = (
      <div className={styles.skeleton} role="status" aria-label={t('adminRequests.loading')} />
    );
  }

  return (
    <div className={styles.page}>
      {/* The bar above already names the page; the heading is for screen readers. */}
      <h1 className="visually-hidden">{t('adminRequests.title')}</h1>
      {content}
    </div>
  );
}

function SectionHead({
  id,
  title,
  subtitle,
  count,
}: {
  id: string;
  title: string;
  subtitle: string;
  count: number;
}) {
  return (
    <header className={styles.sectionHead}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
        <span className={styles.sectionCount}>{count}</span>
      </h2>
      <p className={styles.sectionSubtitle}>{subtitle}</p>
    </header>
  );
}

/** Requests done in the last 30 minutes: the table, what, who and how long it took. */
function DoneList({ done }: { done: readonly AdminServiceRequest[] }) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const text = useRequestText();
  return (
    <details className={styles.done}>
      <summary className={styles.doneSummary}>
        <Icon name="history" size="sm" />
        <span className={styles.doneTitle}>{t('adminRequests.done.title')}</span>
        <span className={styles.sectionCount}>{done.length}</span>
        <Icon name="chevd" size="xs" className={styles.doneChevron} />
      </summary>
      {done.length > 0 ? (
        <ul className={styles.doneList}>
          {done.map((request) => {
            const minutes = handledInMinutes(request) ?? 0;
            return (
              <li key={request.id} className={styles.doneRow}>
                {request.table !== undefined ? (
                  <Link href={tablePath(request.table)} className={styles.doneTable}>
                    {request.table}
                  </Link>
                ) : (
                  <span className={styles.doneTable}>
                    <Icon name="chef" size="xs" />
                  </span>
                )}
                <span className={styles.doneText}>
                  <span className={styles.doneWhat}>{text(request).title}</span>
                  <span className={styles.doneMeta}>
                    {[
                      request.resolvedBy &&
                        request.resolvedAt &&
                        t('adminRequests.doneBy', {
                          name: request.resolvedBy,
                          time: clock.dateTime(request.resolvedAt),
                        }),
                      minutes < 1
                        ? t('adminRequests.handledIn.now')
                        : t('adminRequests.handledIn.minutes', { count: minutes }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.doneEmpty}>{t('adminRequests.done.empty')}</p>
      )}
    </details>
  );
}
