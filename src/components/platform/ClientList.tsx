'use client';

import { useState } from 'react';
import type { ClientSummary } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { Chip, EmptyState, SearchField, Tag } from '@/components/ui';
import { cx } from '@/lib/cx';
import { matchesFilter, matchesSearch, rupees, type ClientFilter } from '@/lib/platform';
import { StatusTag } from './StatusTag';
import styles from './Platform.module.css';

const FILTERS: ClientFilter[] = [
  'all',
  'trial',
  'active',
  'endingSoon',
  'grace',
  'expired',
  'suspended',
];

/** Every client: search, status filters, and each one's package, days left, usage and price. */
export function ClientList({
  clients,
  filter,
  onFilter,
  onOpen,
}: {
  clients: ClientSummary[];
  /** Kept by the console, so its home's tiles open the list filtered. */
  filter: ClientFilter;
  onFilter: (filter: ClientFilter) => void;
  onOpen: (id: string) => void;
}) {
  const t = useContent('common');
  const [query, setQuery] = useState('');
  const shown = clients.filter((c) => matchesFilter(c, filter) && matchesSearch(c, query));
  const count = (f: ClientFilter) => clients.filter((c) => matchesFilter(c, f)).length;

  const usage = (label: 'staff' | 'tables' | 'dishes', c: ClientSummary) => {
    const max = c.limits[label];
    const used = c.usage[label];
    return (
      <span className={cx(max !== null && used > max && styles.over)}>
        {t(`platform.list.${label}`, {
          used,
          max: max === null ? t('platform.limits.infinity') : max,
        })}
      </span>
    );
  };

  const ends = (c: ClientSummary) =>
    c.daysLeft === null
      ? t('platform.list.noEnd')
      : c.daysLeft > 1
        ? t('platform.list.daysLeft', { days: c.daysLeft })
        : c.daysLeft === 1
          ? t('platform.list.lastDay')
          : t('platform.list.ended', { days: -c.daysLeft });

  return (
    <div className={styles.stack}>
      <SearchField
        value={query}
        onChange={setQuery}
        label={t('platform.list.search')}
        placeholder={t('platform.list.search')}
      />
      <div className={styles.filters} role="group" aria-label={t('platform.filters.label')}>
        {FILTERS.map((f) => (
          <Chip key={f} pressed={filter === f} count={count(f)} onClick={() => onFilter(f)}>
            {t(`platform.filters.${f}`)}
          </Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState
          icon="store"
          title={clients.length === 0 ? t('platform.list.none') : t('platform.list.empty')}
        />
      ) : (
        <ul className={styles.clients}>
          {shown.map((c) => (
            <li key={c.id}>
              <button type="button" className={styles.client} onClick={() => onOpen(c.id)}>
                <span className={styles.tight}>
                  <span className={styles.clientName}>{c.name}</span>
                  <span className={styles.muted}>
                    {c.branches
                      .map((b) => t('platform.branches.named', { branch: b.name, city: b.city }))
                      .join(', ')}
                  </span>
                </span>
                <span className={styles.tight}>
                  <span className={styles.row}>
                    <strong>{c.plan.name}</strong>
                    <StatusTag
                      status={c.status}
                      suspension={c.suspension}
                      planChange={c.planChange}
                    />
                    {c.demo && <Tag variant="warn">{t('platform.demo.tag')}</Tag>}
                    <span className={styles.muted}>{ends(c)}</span>
                  </span>
                  <span className={styles.usage}>
                    {usage('staff', c)}
                    {usage('tables', c)}
                    {usage('dishes', c)}
                    <span>{t('platform.list.branches', { count: c.usage.branches })}</span>
                  </span>
                </span>
                <span className={styles.price}>
                  {c.price === null
                    ? t('platform.list.onRequest')
                    : t(
                        c.billingCycle === 'yearly'
                          ? 'platform.list.perYear'
                          : 'platform.list.perHalfYear',
                        { price: rupees(c.price) },
                      )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
