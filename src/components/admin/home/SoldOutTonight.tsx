'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { useBranchMenu } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { Icon, VegMark } from '@/components/ui';
import { soldOutTonight } from '@/lib/adminHome';
import { ADMIN_LINKS } from '@/lib/adminNav';
import type { Dish } from '@/types/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './HomePanels.module.css';

const AvailabilityDialog = dynamic(
  () => import('../menu/AvailabilityDialog').then((m) => m.AvailabilityDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);

/**
 * Not available tonight: the dishes sold out or off today, so waiters can tell guests before
 * they order. Each says until when; those who may change it tap a dish to bring it back (the
 * menu's own availability dialog). Hidden when everything is on.
 */
export function SoldOutTonight() {
  const t = useContent('common');
  const { region, can } = useAdminWorkspace();
  const { menu } = useBranchMenu(region);
  const [changing, setChanging] = useState<Dish | null>(null);
  if (!menu) return null;
  const off = soldOutTonight(menu.dishes);
  if (off.length === 0) return null;
  const canChange = can('menu.availability.update');

  const until = (dish: Dish) => {
    const a = dish.availability;
    if (a.status === 'sold-out')
      return a.backAt
        ? t('adminHome.soldOut.backAt', { time: a.backAt })
        : t('adminHome.soldOut.soldOut');
    return t('adminHome.soldOut.today');
  };

  return (
    <section className={styles.panel} aria-labelledby="soldout-title">
      <header className={styles.head}>
        <div>
          <h2 id="soldout-title" className={styles.title}>
            {t('adminHome.soldOut.title')}
            <span className={styles.count}>{off.length}</span>
          </h2>
          <p className={styles.subtitle}>{t('adminHome.soldOut.subtitle')}</p>
        </div>
        <Link href={ADMIN_LINKS.menu} className={styles.all}>
          {t('adminHome.soldOut.manage')}
          <Icon name="chev" size="xs" />
        </Link>
      </header>
      <ul className={styles.chips}>
        {off.map((dish) => {
          const content = (
            <>
              <VegMark veg={dish.veg} />
              <span className={styles.dish}>{dish.name}</span>
              <span className={styles.until}>{until(dish)}</span>
            </>
          );
          return (
            <li key={dish.slug}>
              {canChange ? (
                <button
                  type="button"
                  className={styles.dishChip}
                  aria-label={t('adminHome.soldOut.change', { dish: dish.name })}
                  onClick={() => setChanging(dish)}
                >
                  {content}
                </button>
              ) : (
                <span className={styles.dishChip}>{content}</span>
              )}
            </li>
          );
        })}
      </ul>
      {changing && <AvailabilityDialog dish={changing} onClose={() => setChanging(null)} />}
    </section>
  );
}
