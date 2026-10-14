'use client';

import { useMemo, useState } from 'react';
import { useBranchMenu } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';
import { Button, Icon, VegMark } from '@/components/ui';
import { isAvailable, startingPrice } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { DraftItemDialog } from './DraftItemDialog';
import type { DraftLine } from './draft';
import { ErrorNotice, SectionEmpty, SectionPage } from './SectionPage';
import styles from './MenuSection.module.css';

/** Dishes shown at once. */
const RESULTS_MAX = 12;

/** /admin/dashboard/menu/: search the branch's menu and build a local, unsent draft. */
export function MenuSection() {
  const t = useContent('common');
  const { region, money } = useAdminWorkspace();
  const { menu, loading, error } = useBranchMenu(region);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [customising, setCustomising] = useState<Dish>();
  const [draft, setDraft] = useState<DraftLine[]>([]);

  const dishes = useMemo(() => {
    if (!menu) return [];
    const found = search ? menu.searchDishes(search) : menu.dishes;
    return found
      .filter((dish) => category === 'all' || dish.categoryId === category)
      .slice(0, RESULTS_MAX);
  }, [menu, category, search]);

  if (error) return <ErrorNotice>{error.message}</ErrorNotice>;
  if (loading || !menu) return <SectionEmpty label={t('adminDashboard.empty.loadingMenu')} />;

  return (
    <SectionPage
      title={t('adminShell.nav.menu')}
      subtitle={t('adminDashboard.sections.menuSubtitle')}
    >
      <label className={styles.searchField}>
        <Icon name="search" size="sm" />
        <input
          aria-label={t('adminDashboard.search.label')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('adminDashboard.searchPlaceholder')}
        />
      </label>
      <label className={styles.categoryFilter}>
        {t('adminDashboard.categoryFilter')}
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">{t('adminDashboard.allCategories')}</option>
          {menu.categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.menuWorkspace}>
        <div className={styles.menuResults}>
          {dishes.map((dish) => (
            <article className={styles.menuDish} key={dish.slug}>
              <div className={styles.menuDishTop}>
                <VegMark veg={dish.veg} />
                <span className={styles.categoryLabel}>
                  {menu.getCategory(dish.categoryId)?.name}
                </span>
                {!isAvailable(dish) && (
                  <span className={styles.soldOut}>{t('adminDashboard.unavailable')}</span>
                )}
              </div>
              <h3>{dish.name}</h3>
              <p>{dish.cardDescription ?? dish.description}</p>
              <div className={styles.menuDishFoot}>
                <strong>{money.format(startingPrice(dish))}</strong>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!isAvailable(dish)}
                  onClick={() => setCustomising(dish)}
                  iconStart="plus"
                >
                  {t('adminDashboard.addToDraft')}
                </Button>
              </div>
            </article>
          ))}
          {dishes.length === 0 && <SectionEmpty label={t('adminDashboard.empty.noMenuMatch')} />}
        </div>
        <aside className={styles.draftPanel}>
          <span className={styles.eyebrow}>{t('adminDashboard.localOnly')}</span>
          <h2>{t('adminDashboard.unsentDraft')}</h2>
          <p>{t('adminDashboard.draftDisclaimer')}</p>
          {draft.length ? (
            <div className={styles.draftItems}>
              {draft.map((line, index) => (
                <div key={`${line.dish.slug}-${index}`}>
                  <span>
                    <strong>{line.dish.name}</strong>
                    <small>
                      {[line.variant, ...line.addOns, ...line.choices]
                        .filter(Boolean)
                        .join(' · ') || t('adminDashboard.standard')}
                    </small>
                    <small>{money.format(line.total)}</small>
                  </span>
                  <button
                    type="button"
                    aria-label={t('adminDashboard.removeItem', { item: line.dish.name })}
                    onClick={() => setDraft((items) => items.filter((_, i) => i !== index))}
                  >
                    <Icon name="x" size="xs" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.draftEmpty}>{t('adminDashboard.draftEmpty')}</div>
          )}
          <Button size="sm" block disabled>
            {t('adminDashboard.submitUnavailable')}
          </Button>
        </aside>
      </div>
      <DraftItemDialog
        dish={customising}
        money={money}
        onAdd={(line) => {
          setDraft((items) => [...items, line]);
          setCustomising(undefined);
        }}
        onClose={() => setCustomising(undefined)}
      />
    </SectionPage>
  );
}
