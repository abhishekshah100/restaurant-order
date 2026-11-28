'use client';

import type { ClientSummary } from '@/api/contracts/platform';
import { useContent } from '@/api/hooks';
import { Button, Tag } from '@/components/ui';
import { SettingsCard } from '../admin/settings/shared/SettingsEditor';
import styles from './Platform.module.css';

/**
 * A client's branches, each by its own name ("Rooftop Cafe", set in its Settings › Restaurant
 * info) with its city, when it was added and what it has: tables, dishes, its own staff and the
 * orders it has taken. A branch with an empty menu says so, with the way to load one.
 */
export function ClientBranches({
  client,
  onLoadMenu,
}: {
  client: Pick<ClientSummary, 'branches'>;
  /** To the Dev setup tab, to load a menu into a branch. */
  onLoadMenu?: (() => void) | undefined;
}) {
  const t = useContent('common');
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  return (
    <SettingsCard
      title={t.plural('platform.branches.title', client.branches.length)}
      hint={t('platform.branches.hint')}
    >
      <ul className={styles.payments}>
        {client.branches.map((b) => (
          <li key={b.id} className={styles.payment}>
            <div className={styles.tight}>
              <strong>{b.name}</strong>
              <span className={styles.muted}>
                {t('platform.branches.where', { city: b.city, date: date(b.createdAt) })}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.usage}>
                <span>{t.plural('platform.branches.tables', b.tables)}</span>
                <span>{t.plural('platform.branches.dishes', b.dishes)}</span>
                <span>{t.plural('platform.branches.staff', b.staff)}</span>
                <span>{t.plural('platform.branches.orders', b.orders)}</span>
              </span>
              {b.dishes === 0 && (
                <>
                  <Tag variant="warn">{t('platform.branches.emptyMenu')}</Tag>
                  {onLoadMenu && (
                    <Button size="sm" variant="secondary" iconStart="menu" onClick={onLoadMenu}>
                      {t('platform.branches.loadMenu')}
                    </Button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}
