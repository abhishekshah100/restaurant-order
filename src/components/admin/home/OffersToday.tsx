'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useBranchMenu } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';

import { branchPromotionsQuery, type ContentMap } from '@/api/queries';
import type { Translator } from '@/api/translator';
import { Icon } from '@/components/ui';
import { settingsPath } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import type { MenuCatalog } from '@/lib/menu';
import { offersToday } from '@/lib/promotions';
import type { AutoOffer } from '@/types/promotion';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './HomePanels.module.css';

/** How many dishes or categories an offer names before "+2 more". */
const NAMED = 3;

/**
 * Offers today: the automatic offers (happy hour) on now and those starting later today, branch
 * time, so waiters can tell guests: when (Now, or its start), its name, what it takes off what
 * ("20% off Beverages"), the ways of ordering it's for, and until when. Hidden when there are
 * none today. Read from GET /branches/:id/promotions (the offers guests get, switched on).
 */
export function OffersToday({ now }: { now: Date | null }) {
  const t = useContent('common');
  const { region, money, clock, can } = useAdminWorkspace();
  const promotions = useQuery(branchPromotionsQuery(region.id)).data;
  const { menu } = useBranchMenu(region);
  if (!now || !promotions || !menu) return null;
  const today = offersToday(promotions.offers, now, region.timezone);
  if (today.length === 0) return null;

  const at = (time: string) => clock.time(clock.localTimestamp(0, time, now));
  const deal = (offer: AutoOffer) => {
    const what = scopeWords(offer, menu, t);
    if (offer.type === 'priceOverride')
      return t('adminHome.offers.priceOverride', { what, price: money.format(offer.value) });
    const amount = offer.type === 'percent' ? `${offer.value}%` : money.format(offer.value);
    return t('adminHome.offers.off', { amount, what });
  };

  return (
    <section className={styles.panel} aria-labelledby="offers-title">
      <header className={styles.head}>
        <div>
          <h2 id="offers-title" className={styles.title}>
            {t('adminHome.offers.title')}
            <span className={cx(styles.count, styles.offerCount)}>{today.length}</span>
          </h2>
          <p className={styles.subtitle}>{t('adminHome.offers.subtitle')}</p>
        </div>
        {can('branch.settings.manage') && (
          <Link href={settingsPath('offers')} className={styles.all}>
            {t('adminHome.offers.manage')}
            <Icon name="chev" size="xs" />
          </Link>
        )}
      </header>
      <ul className={styles.list}>
        {today.map(({ offer, on }) => (
          <li key={offer.id} className={styles.row}>
            <span className={cx(styles.time, on && styles.offerOn)}>
              {on ? t('adminHome.offers.now') : at(offer.from)}
            </span>
            <span className={styles.main}>
              <span className={styles.name}>{offer.name}</span>
              <span className={styles.meta}>{deal(offer)}</span>
              <span className={styles.note}>
                {offer.modes.map((mode) => t(`modes.${mode}`)).join(' · ')}
              </span>
              <span className={styles.when}>
                {on
                  ? t('adminHome.offers.till', { time: at(offer.to) })
                  : t('adminHome.offers.window', { from: at(offer.from), to: at(offer.to) })}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What an offer covers, by name: "Beverages", "Beverages, Mojito", "A, B, C +2 more". */
function scopeWords({ scope }: AutoOffer, menu: MenuCatalog, t: Translator<ContentMap['common']>) {
  const names = [
    ...(scope.categories ?? []).map((id) => menu.categories.find((c) => c.id === id)?.name),
    ...(scope.dishes ?? []).map((slug) => menu.getDish(slug)?.name),
  ].filter((name): name is string => Boolean(name));
  if (names.length === 0) return t('adminHome.offers.selected');
  const shown = names.slice(0, NAMED).join(', ');
  return names.length > NAMED
    ? t('adminHome.offers.more', { names: shown, count: names.length - NAMED })
    : shown;
}
