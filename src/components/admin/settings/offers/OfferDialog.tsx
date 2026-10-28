'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useBranchMenu } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';
import { Button, Chip, Dialog, Icon, Input, VegMark } from '@/components/ui';
import {
  OFFER_DAYS,
  OFFER_MODES,
  OFFER_NAME_MAX,
  draftOf,
  offerErrors,
  type OfferDraft,
  type OfferField,
} from '@/lib/adminOffers';
import { startingPrice } from '@/lib/menu';
import type { AutoOffer } from '@/types/promotion';
import { RadioTiles } from '../../payments/PaymentFields';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import styles from './OffersManager.module.css';

const TYPES: readonly AutoOffer['type'][] = ['percent', 'flat', 'priceOverride'];

/** Dishes listed under the search box at most. */
const MAX_MATCHES = 6;

/** Toggles one item in a list. */
const toggle = <T,>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/**
 * Adding or changing an offer: its name, switched on or paused, days and hours (branch time),
 * optional first and last day, the ways of ordering, what it covers (whole categories and single
 * dishes) and the discount (a percentage, an amount off each item, or a fixed price each).
 */
export function OfferDialog({
  offer,
  saving,
  onClose,
  onSave,
}: {
  /** The offer to change; a new one when absent. */
  offer?: AutoOffer;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: OfferDraft) => void;
}) {
  const t = useContent('common');
  const { region, money } = useAdminWorkspace();
  const { menu } = useBranchMenu(region);
  const enabledModes = OFFER_MODES.filter((m) => region.modes[m].enabled);
  const [draft, setDraft] = useState<OfferDraft>(() => draftOf(offer, enabledModes));
  const [tried, setTried] = useState(false);
  const [dishQuery, setDishQuery] = useState('');
  const set = (patch: Partial<OfferDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const errors = offerErrors(draft);
  const errorFor = (field: OfferField) => {
    const problem = errors[field];
    return tried && problem ? t(`adminSettings.offers.errors.${problem}`) : undefined;
  };
  const symbol = region.currency.symbol;

  // Single dishes to add: those not already covered by a category picked, matching what's typed.
  // (A search list, not a native dropdown: the sheet's swipe-to-close would close that.)
  const matches = useMemo(() => {
    if (!menu || dishQuery.trim() === '') return [];
    const addable = menu.dishes.filter(
      (d) => !draft.dishes.includes(d.slug) && !draft.categories.includes(d.categoryId),
    );
    return menu.searchDishes(dishQuery, addable).slice(0, MAX_MATCHES);
  }, [menu, dishQuery, draft.dishes, draft.categories]);

  // The matches stay in view as they change: no scrolling the dialog to find them.
  const matchesRef = useRef<HTMLDivElement>(null);
  const searching = dishQuery.trim() !== '';
  useEffect(() => {
    if (searching) matchesRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [searching, matches]);

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={
        offer
          ? t('adminSettings.offers.dialog.editTitle', { name: offer.name })
          : t('adminSettings.offers.dialog.addTitle')
      }
      description={t('adminSettings.offers.dialog.description')}
      className={styles.dialog}
      footer={
        <Button
          block
          iconStart="check"
          loading={saving}
          onClick={() => {
            setTried(true);
            if (Object.keys(errors).length === 0) onSave(draft);
          }}
        >
          {offer
            ? t('adminSettings.offers.dialog.save')
            : t('adminSettings.offers.dialog.addSubmit')}
        </Button>
      }
    >
      <div className={styles.form}>
        <Input
          id="offer-name"
          label={t('adminSettings.offers.dialog.name')}
          placeholder={t('adminSettings.offers.dialog.namePlaceholder')}
          hint={t('adminSettings.offers.dialog.nameHint')}
          value={draft.name}
          maxLength={OFFER_NAME_MAX}
          error={errorFor('name')}
          onChange={(event) => set({ name: event.target.value })}
        />

        <label className={styles.switchRow}>
          <input
            type="checkbox"
            className={styles.switch}
            checked={draft.active}
            onChange={(event) => set({ active: event.target.checked })}
          />
          <span>
            <span className={styles.switchLabel}>{t('adminSettings.offers.dialog.active')}</span>
            <span className={styles.hint}>{t('adminSettings.offers.dialog.activeHint')}</span>
          </span>
        </label>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t('adminSettings.offers.dialog.covers')}</legend>
          <p className={styles.hint}>{t('adminSettings.offers.dialog.coversHint')}</p>
          <p className={styles.subLegend}>{t('adminSettings.offers.dialog.categories')}</p>
          <div className={styles.chips}>
            {(menu?.categories ?? []).map((category) => (
              <Chip
                key={category.id}
                pressed={draft.categories.includes(category.id)}
                onClick={() =>
                  set({
                    categories: toggle(draft.categories, category.id),
                    // A dish its category now covers needn't be listed on its own.
                    dishes: draft.dishes.filter(
                      (slug) => menu?.getDish(slug)?.categoryId !== category.id,
                    ),
                  })
                }
              >
                {category.name}
              </Chip>
            ))}
          </div>
          {draft.dishes.length > 0 && (
            <ul className={styles.picked}>
              {draft.dishes.map((slug) => {
                const name = menu?.getDish(slug)?.name ?? slug;
                return (
                  <li key={slug}>
                    <button
                      type="button"
                      className={styles.pickedDish}
                      aria-label={t('adminSettings.offers.dialog.removeDish', { dish: name })}
                      onClick={() => set({ dishes: draft.dishes.filter((d) => d !== slug) })}
                    >
                      {name}
                      <Icon name="x" size="xs" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Input
            id="offer-dish-search"
            type="search"
            label={t('adminSettings.offers.dialog.addDish')}
            placeholder={t('adminSettings.offers.dialog.dishSearchPlaceholder')}
            autoComplete="off"
            value={dishQuery}
            onChange={(event) => setDishQuery(event.target.value)}
          />
          <div ref={matchesRef} className={styles.matchArea}>
            {searching &&
              (matches.length === 0 ? (
                <p className={styles.noMatch}>{t('adminSettings.offers.dialog.noMatches')}</p>
              ) : (
                <ul
                  className={styles.matches}
                  aria-label={t('adminSettings.offers.dialog.matches')}
                >
                  {matches.map((dish) => (
                    <li key={dish.slug}>
                      <button
                        type="button"
                        className={styles.match}
                        onClick={() => {
                          set({ dishes: [...draft.dishes, dish.slug] });
                          setDishQuery('');
                        }}
                      >
                        <VegMark veg={dish.veg} />
                        <span className={styles.matchText}>
                          <span className={styles.matchName}>{dish.name}</span>
                          <span className={styles.matchCategory}>
                            {menu?.getCategory(dish.categoryId)?.name}
                          </span>
                        </span>
                        <span className={styles.matchPrice}>
                          {money.format(startingPrice(dish))}
                        </span>
                        <span className={styles.matchAdd} aria-hidden="true">
                          <Icon name="plus" size="xs" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
          {errorFor('scope') && <p className={styles.error}>{errorFor('scope')}</p>}
        </fieldset>

        <RadioTiles<AutoOffer['type']>
          name="offer-type"
          legend={t('adminSettings.offers.dialog.discount')}
          value={draft.type}
          onChange={(type) => set({ type })}
          columns={3}
          choices={TYPES.map((type) => ({
            id: type,
            label: t(`adminSettings.offers.dialog.types.${type}`),
          }))}
        />
        <Input
          id="offer-value"
          inputMode="decimal"
          label={t(`adminSettings.offers.dialog.value.${draft.type}`, { symbol })}
          value={draft.value}
          error={errorFor('value')}
          onChange={(event) => set({ value: event.target.value })}
        />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t('adminSettings.offers.dialog.days')}</legend>
          <div className={styles.chips}>
            {OFFER_DAYS.map((day) => (
              <Chip
                key={day}
                pressed={draft.days.includes(day)}
                onClick={() => set({ days: toggle(draft.days, day) })}
              >
                {t(`adminSettings.hours.days.${day}`).slice(0, 3)}
              </Chip>
            ))}
          </div>
          {errorFor('days') && <p className={styles.error}>{errorFor('days')}</p>}
        </fieldset>

        <div className={styles.row}>
          <Input
            id="offer-from"
            type="time"
            label={t('adminSettings.offers.dialog.from')}
            value={draft.from}
            onChange={(event) => set({ from: event.target.value })}
          />
          <Input
            id="offer-to"
            type="time"
            label={t('adminSettings.offers.dialog.to')}
            hint={t('adminSettings.offers.dialog.timeHint')}
            value={draft.to}
            error={errorFor('to')}
            onChange={(event) => set({ to: event.target.value })}
          />
          <Input
            id="offer-starts"
            type="date"
            optional
            label={t('adminSettings.offers.dialog.startsOn')}
            hint={t('adminSettings.offers.dialog.datesHint')}
            value={draft.startsOn}
            onChange={(event) => set({ startsOn: event.target.value })}
          />
          <Input
            id="offer-ends"
            type="date"
            optional
            label={t('adminSettings.offers.dialog.endsOn')}
            value={draft.endsOn}
            min={draft.startsOn || undefined}
            error={errorFor('endsOn')}
            onChange={(event) => set({ endsOn: event.target.value })}
          />
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t('adminSettings.offers.dialog.modes')}</legend>
          <div className={styles.chips}>
            {OFFER_MODES.map((mode) => (
              <Chip
                key={mode}
                pressed={draft.modes.includes(mode)}
                onClick={() => set({ modes: toggle(draft.modes, mode) })}
              >
                {t(`modes.${mode}`)}
              </Chip>
            ))}
          </div>
          {errorFor('modes') && <p className={styles.error}>{errorFor('modes')}</p>}
        </fieldset>
      </div>
    </Dialog>
  );
}
