'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Chip, Icon, QuantityStepper, SearchField, VegMark } from '@/components/ui';
import { useMinute } from '@/hooks/useOffers';
import { isAvailable, type MenuCatalog } from '@/lib/menu';
import { dishCount, hasChoices, plainKey, type PadLines } from '@/lib/orderPad';
import { bestOffer } from '@/lib/promotions';
import type { CategoryId, Dish, Price } from '@/types/menu';
import type { AutoOffer } from '@/types/promotion';
import bannerStyles from '../../menu/OfferBanner.module.css';
import offerStyles from '../../menu/OfferPrice.module.css';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './OrderPad.module.css';

/**
 * The pad's menu: search, a chip per category, and the dishes by category. A dish without
 * choices adds with one tap and then shows a stepper; a dish with choices opens them. A dish
 * with an offer on (happy hour) shows the offer price and the menu price struck through, and
 * a banner above the search says what's on, so the waiter can tell the guest.
 */
export function PadMenu({
  menu,
  offers,
  lines,
  onAdd,
  onChoose,
  onQuantity,
}: {
  menu: MenuCatalog;
  /** The dine-in offers on now. */
  offers: readonly AutoOffer[];
  lines: PadLines;
  onAdd: (dish: Dish) => void;
  onChoose: (dish: Dish) => void;
  onQuantity: (key: string, quantity: number) => void;
}) {
  const t = useContent('common');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const searching = query.trim().length > 0;

  const sections = searching
    ? [{ id: 'results', name: '', dishes: menu.searchDishes(query) }]
    : menu.categories
        .filter((c) => category === 'all' || c.id === category)
        .map((c) => ({ id: c.id, name: c.name, dishes: menu.dishesIn(c.id) }))
        .filter((section) => section.dishes.length > 0);

  return (
    <div className={styles.menu}>
      <div className={styles.filters}>
        <PadOfferBanners
          menu={menu}
          offers={offers}
          onShow={(id) => {
            setQuery('');
            setCategory(id);
          }}
        />
        <SearchField
          value={query}
          onChange={setQuery}
          label={t('adminOrderPad.search')}
          placeholder={t('adminOrderPad.search')}
        />
        {!searching && (
          <div className={styles.chips} role="group" aria-label={t('adminOrderPad.categories')}>
            <Chip pressed={category === 'all'} onClick={() => setCategory('all')}>
              {t('adminOrderPad.all')}
            </Chip>
            {menu.categories.map((c) => (
              <Chip key={c.id} pressed={category === c.id} onClick={() => setCategory(c.id)}>
                {c.shortName ?? c.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {sections.map((section) => (
        <section key={section.id} className={styles.section} aria-label={section.name || undefined}>
          {section.name && <h3 className={styles.sectionTitle}>{section.name}</h3>}
          {section.dishes.length > 0 ? (
            <ul className={styles.dishes}>
              {section.dishes.map((dish) => (
                <PadDishRow
                  key={dish.slug}
                  dish={dish}
                  offers={offers}
                  lines={lines}
                  onAdd={onAdd}
                  onChoose={onChoose}
                  onQuantity={onQuantity}
                />
              ))}
            </ul>
          ) : (
            <p className={styles.none}>{t('adminOrderPad.noMatch', { query: query.trim() })}</p>
          )}
        </section>
      ))}
    </div>
  );
}

function PadDishRow({
  dish,
  offers,
  lines,
  onAdd,
  onChoose,
  onQuantity,
}: {
  dish: Dish;
  offers: readonly AutoOffer[];
  lines: PadLines;
  onAdd: (dish: Dish) => void;
  onChoose: (dish: Dish) => void;
  onQuantity: (key: string, quantity: number) => void;
}) {
  const t = useContent('common');
  const offer = bestOffer(offers, dish, dish.price);
  const choices = hasChoices(dish);
  const count = dishCount(lines, dish.slug);
  const available = isAvailable(dish);

  let action;
  if (!available) {
    action = <span className={styles.unavailable}>{t('adminOrderPad.unavailable')}</span>;
  } else if (!choices && count > 0) {
    action = (
      <QuantityStepper
        value={count}
        min={0}
        size="sm"
        itemName={dish.name}
        onChange={(next) => onQuantity(plainKey(dish), next)}
      />
    );
  } else {
    action = (
      <button
        type="button"
        className={styles.add}
        onClick={() => (choices ? onChoose(dish) : onAdd(dish))}
        aria-label={t(choices ? 'adminOrderPad.chooseLabel' : 'adminOrderPad.addLabel', {
          dish: dish.name,
        })}
      >
        {t('adminOrderPad.add')}
      </button>
    );
  }

  return (
    <li className={styles.dish} data-off={!available || undefined}>
      <VegMark veg={dish.veg} className={styles.veg} />
      <span className={styles.dishText}>
        <span className={styles.dishName}>{dish.name}</span>
        <span className={styles.dishMeta}>
          <PadPrice price={offer ? dish.price - offer.unitDiscount : dish.price} was={dish.price} />
          {choices && count > 0 && (
            <span className={styles.added}>{t.plural('adminOrderPad.added', count)}</span>
          )}
        </span>
      </span>
      {action}
    </li>
  );
}

/**
 * A price on the pad. With an offer on (happy hour) the offer price comes first and the menu
 * price follows struck through, as the guest's menu shows it; screen readers hear "₹159, was
 * ₹199".
 */
export function PadPrice({ price, was }: { price: Price; was: Price }) {
  const t = useContent('menu');
  const { money } = useAdminWorkspace();
  if (was <= price) return <>{money.format(price)}</>;
  const now = money.format(price);
  const before = money.format(was);
  return (
    <span className={offerStyles.offer}>
      <span aria-hidden="true">{now}</span>
      <s className={offerStyles.was} aria-hidden="true">
        {before}
      </s>
      <span className="visually-hidden">{t('dish.offerPrice', { price: now, was: before })}</span>
    </span>
  );
}

/**
 * What's on now, as the guest's menu says it: "Happy hour · 20% off Beverages till 7:00 PM"
 * (branch time), with a button to show that category. Nothing when no offer is on.
 */
function PadOfferBanners({
  menu,
  offers,
  onShow,
}: {
  menu: MenuCatalog;
  offers: readonly AutoOffer[];
  onShow: (category: CategoryId) => void;
}) {
  const t = useContent('menu');
  const { money, clock } = useAdminWorkspace();
  const minute = useMinute();
  if (offers.length === 0 || minute === null) return null;
  const now = new Date(minute);
  return offers.map((offer) => {
    // One category: named, with a button to show it. Anything else: "selected dishes".
    const only =
      offer.scope.categories?.length === 1 && !offer.scope.dishes?.length
        ? menu.categories.find((c) => c.id === offer.scope.categories?.[0])
        : undefined;
    const words = {
      name: offer.name,
      what: only?.name ?? t('offers.selected'),
      time: clock.time(clock.localTimestamp(0, offer.to, now)),
    };
    const bold = { b: (chunk: React.ReactNode) => <b>{chunk}</b> };
    return (
      <p key={offer.id} className={bannerStyles.banner} role="status">
        <Icon name="tag" size="sm" />
        <span className={bannerStyles.text}>
          {offer.type === 'priceOverride'
            ? t.rich('offers.bannerPrice', bold, { ...words, price: money.format(offer.value) })
            : t.rich('offers.banner', bold, {
                ...words,
                discount: offer.type === 'percent' ? `${offer.value}%` : money.format(offer.value),
              })}
        </span>
        {only && (
          <button
            type="button"
            className={`${bannerStyles.link} ${styles.offerShow}`}
            onClick={() => onShow(only.id)}
          >
            {t('offers.link', { category: only.name })}
            <Icon name="chev" size="xs" />
          </button>
        )}
      </p>
    );
  });
}
