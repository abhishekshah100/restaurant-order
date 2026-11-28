'use client';

import type { ClientSummary } from '@/api/contracts';
import { useContent, usePlatformPayments } from '@/api/hooks';
import { SettingsCard } from '@/components/admin/settings/shared/SettingsEditor';
import { Button, Skeleton } from '@/components/ui';
import { ENDING_SOON_DAYS, matchesFilter, rupees, type ClientFilter } from '@/lib/platform';
import { RemindButton } from './RemindButton';
import { StatusTag } from './StatusTag';
import styles from './Platform.module.css';

const TILES: Exclude<ClientFilter, 'all'>[] = [
  'active',
  'trial',
  'endingSoon',
  'grace',
  'expired',
  'suspended',
];

/** Those to chase first: plans ended (grace, expired), then those ending soonest. */
function needingAttention(clients: readonly ClientSummary[]): ClientSummary[] {
  return clients
    .filter(
      (c) =>
        c.status === 'grace' ||
        c.status === 'expired' ||
        ((c.status === 'trial' || c.status === 'active') &&
          c.daysLeft !== null &&
          c.daysLeft <= ENDING_SOON_DAYS),
    )
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

/**
 * The console's home: clients by status (each opens the list filtered), who needs a reminder or a
 * renewal now (with WhatsApp in one tap), and the money received.
 */
export function PlatformOverview({
  platformKey,
  by,
  clients,
  onFilter,
  onOpen,
}: {
  platformKey: string;
  by: string;
  clients: ClientSummary[];
  onFilter: (filter: ClientFilter) => void;
  onOpen: (id: string) => void;
}) {
  const t = useContent('common');
  const payments = usePlatformPayments(platformKey).data;
  const attention = needingAttention(clients);

  const when = (c: ClientSummary) =>
    c.daysLeft === null
      ? ''
      : c.daysLeft > 1
        ? t('platform.list.daysLeft', { days: c.daysLeft })
        : c.daysLeft === 1
          ? t('platform.list.lastDay')
          : t('platform.list.ended', { days: -c.daysLeft });

  return (
    <div className={styles.stack}>
      <div className={styles.tiles}>
        {TILES.map((f) => (
          <button key={f} type="button" className={styles.tile} onClick={() => onFilter(f)}>
            <span className={styles.tileValue}>
              {clients.filter((c) => matchesFilter(c, f)).length}
            </span>
            <span className={styles.muted}>{t(`platform.filters.${f}`)}</span>
          </button>
        ))}
      </div>

      <SettingsCard
        title={t('platform.overview.attention')}
        hint={t('platform.overview.attentionHint')}
      >
        {attention.length === 0 ? (
          <p className={styles.muted}>{t('platform.overview.allGood')}</p>
        ) : (
          <ul className={styles.payments}>
            {attention.map((c) => (
              <li key={c.id} className={styles.payment}>
                <div className={styles.tight}>
                  <span className={styles.row}>
                    <strong>{c.name}</strong>
                    <StatusTag
                      status={c.status}
                      suspension={c.suspension}
                      planChange={c.planChange}
                    />
                  </span>
                  <span className={styles.muted}>
                    {c.plan.name} · {when(c)}
                    {c.remindedAt
                      ? ` · ${t('platform.overview.reminded', { date: day(c.remindedAt) })}`
                      : ''}
                  </span>
                </div>
                <div className={styles.row}>
                  <RemindButton platformKey={platformKey} by={by} client={c} />
                  <Button variant="ghost" size="sm" iconEnd="chev" onClick={() => onOpen(c.id)}>
                    {t('platform.overview.open')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      <SettingsCard title={t('platform.overview.money')}>
        {!payments ? (
          <Skeleton height={120} />
        ) : (
          <>
            <div className={styles.money}>
              <div className={styles.tile}>
                <span className={styles.tileValue}>{rupees(payments.thisMonth)}</span>
                <span className={styles.muted}>{t('platform.overview.thisMonth')}</span>
              </div>
              <div className={styles.tile}>
                <span className={styles.tileValue}>{rupees(payments.last12Months)}</span>
                <span className={styles.muted}>{t('platform.overview.last12Months')}</span>
              </div>
            </div>
            {payments.recent.length === 0 ? (
              <p className={styles.muted}>{t('platform.payments.none')}</p>
            ) : (
              <ul className={styles.payments}>
                {payments.recent.map((p) => (
                  <li key={p.id} className={styles.payment}>
                    <div className={styles.tight}>
                      <strong>{p.client.name}</strong>
                      <span className={styles.muted}>
                        {t('platform.payments.paidOn', { date: day(p.paidOn), by: p.by })}
                      </span>
                    </div>
                    <span className={styles.price}>
                      {t('platform.payments.line', {
                        amount: rupees(p.amount),
                        method: t(`platform.payments.methods.${p.method}`),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </SettingsCard>
    </div>
  );
}
