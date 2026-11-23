'use client';

import { useState } from 'react';
import type { SetupRestaurant } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { useDeleteSetupRestaurant, useResetSetupRestaurant } from '@/api/mutations';
import { Banner, Button, Dialog, EmptyState } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import styles from './DevSetup.module.css';

type Pending = { action: 'reset' | 'delete'; restaurant: SetupRestaurant } | null;

/** The restaurants made on this page, each with Reset activity and Delete (both confirmed). */
export function SetupRestaurants({
  devKey,
  restaurants,
}: {
  devKey: string;
  restaurants: SetupRestaurant[];
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const reset = useResetSetupRestaurant(devKey);
  const remove = useDeleteSetupRestaurant(devKey);
  const [pending, setPending] = useState<Pending>(null);
  const working = reset.isPending || remove.isPending;
  const failed = reset.isError || remove.isError;

  const confirm = () => {
    if (!pending) return;
    const { action, restaurant } = pending;
    const mutation = action === 'reset' ? reset : remove;
    mutation.mutate(restaurant.id, {
      onSuccess: () => {
        setPending(null);
        showToast(
          action === 'reset'
            ? t('devSetup.list.resetDone', { name: restaurant.name })
            : t('devSetup.list.deleteDone', { name: restaurant.name }),
          action === 'delete' ? { icon: 'trash' } : undefined,
        );
      },
    });
  };

  return (
    <section className={styles.section} aria-labelledby="setup-list">
      <h2 id="setup-list" className={styles.sectionTitle}>
        {t('devSetup.list.title')}
      </h2>
      {restaurants.length === 0 ? (
        <EmptyState icon="store" title={t('devSetup.list.empty')} />
      ) : (
        <ul className={styles.cards}>
          {restaurants.map((r) => (
            <li key={r.id} className={styles.card}>
              <div className={styles.cardText}>
                <span className={styles.cardName}>{r.name}</span>
                <span className={styles.muted}>
                  {r.branches.map((b) => `${b.name} · ${b.country} · ${b.currency}`).join(', ')}
                </span>
                <span className={styles.muted}>
                  {t('devSetup.list.created', { date: new Date(r.createdAt).toLocaleString() })}
                  {' · '}
                  {t('devSetup.list.counts', {
                    dishes: r.dishes,
                    orders: r.orders,
                    tables: r.branches.reduce((n, b) => n + b.tables, 0),
                  })}
                </span>
                <span className={styles.muted}>
                  {r.staff.map((s) => `${s.name} (${s.role}) ${s.phoneNational}`).join(' · ')}
                </span>
              </div>
              <div className={styles.cardActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart="refresh"
                  onClick={() => setPending({ action: 'reset', restaurant: r })}
                >
                  {t('devSetup.list.reset')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconStart="trash"
                  onClick={() => setPending({ action: 'delete', restaurant: r })}
                >
                  {t('devSetup.list.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={pending !== null}
        onClose={() => {
          if (!working) setPending(null);
        }}
        presentation="modal"
        title={
          pending
            ? t(
                pending.action === 'reset'
                  ? 'devSetup.list.resetTitle'
                  : 'devSetup.list.deleteTitle',
                {
                  name: pending.restaurant.name,
                },
              )
            : ''
        }
        footer={
          <div className={styles.dialogActions}>
            <Button variant="secondary" disabled={working} onClick={() => setPending(null)}>
              {t('devSetup.list.cancel')}
            </Button>
            <Button
              variant={pending?.action === 'delete' ? 'dark' : 'primary'}
              loading={working}
              onClick={confirm}
            >
              {pending?.action === 'delete'
                ? t('devSetup.list.deleteConfirm')
                : t('devSetup.list.resetConfirm')}
            </Button>
          </div>
        }
      >
        <p className={styles.dialogBody}>
          {pending?.action === 'delete'
            ? t('devSetup.list.deleteBody')
            : t('devSetup.list.resetBody')}
        </p>
        {failed && (
          <Banner tone="err" icon="alert" live="assertive">
            {t('devSetup.list.failed')}
          </Banner>
        )}
      </Dialog>
    </section>
  );
}
