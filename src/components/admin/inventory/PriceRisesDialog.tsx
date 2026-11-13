'use client';

import { useContent, useInventoryDashboard } from '@/api/hooks';
import { Button, Dialog, Icon } from '@/components/ui';
import { ADMIN_NAV } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { InfoTip } from './InfoTip';
import { useInventoryText } from './useInventoryText';
import styles from './PriceRises.module.css';

const MENU_PATH = ADMIN_NAV.find((item) => item.id === 'menu')?.href ?? '/admin/dashboard/';

/**
 * Price went up: each ingredient whose purchase price rose past the alert (first and last
 * delivery in 30 days), and every dish plate it touches — what a plate costs and its food cost,
 * before and now, red once it's over the goal — with Open recipe (to change the portion) and
 * Change price (the dish on Menu). What to do, in a line.
 */
export function PriceRisesDialog({
  onRecipe,
  onClose,
}: {
  onRecipe: (slug: string) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const text = useInventoryText();
  const data = useInventoryDashboard(branch.id, 'branch').data;
  const rises = data?.priceRises ?? [];
  const goal = data?.foodCostTarget;
  const pct = (n: number | undefined) =>
    n === undefined ? '' : t('adminInventory.prices.pct', { pct: n });

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminInventory.prices.title')}
      description={t('adminInventory.prices.body', { alert: data?.priceAlert ?? 10 })}
    >
      {!data ? (
        <p className={styles.muted} aria-busy="true">
          {t('adminInventory.loading')}
        </p>
      ) : rises.length === 0 ? (
        <p className={styles.none}>
          <Icon name="checkc" size="sm" />
          {t('adminInventory.prices.none')}
        </p>
      ) : (
        <div className={styles.body}>
          <p className={styles.options}>
            <Icon name="info" size="xs" />
            {t('adminInventory.prices.options')}
          </p>
          {rises.map((rise) => (
            <section key={rise.ingredientId} className={styles.rise}>
              <h3 className={styles.head}>
                <span className={styles.name}>{rise.name}</span>
                <span className={styles.change}>
                  {t('adminInventory.week.up', { pct: rise.change })}
                </span>
              </h3>
              <p className={styles.price}>
                {t('adminInventory.prices.price', {
                  from: text.cost(rise.from, rise.unit),
                  to: text.cost(rise.to, rise.unit),
                })}
                <InfoTip label={t('adminInventory.tips.label')}>
                  {t('adminInventory.tips.priceUp')}
                </InfoTip>
              </p>
              {rise.dishes.length === 0 ? (
                <p className={styles.muted}>{t('adminInventory.prices.noDishes')}</p>
              ) : (
                <ul className={styles.dishes}>
                  {rise.dishes.map((d) => {
                    const over = goal !== undefined && (d.foodCostTo ?? 0) > goal;
                    return (
                      <li
                        key={`${d.slug}-${d.size ?? ''}`}
                        className={cx(styles.dish, over && styles.over)}
                      >
                        <span className={styles.dishMain}>
                          <strong>
                            {d.size
                              ? t('adminInventory.prices.dishSize', { name: d.name, size: d.size })
                              : d.name}
                          </strong>
                          <span>
                            {t('adminInventory.prices.plate', {
                              from: text.value(d.costFrom),
                              to: text.value(d.costTo),
                            })}
                            {d.foodCostTo !== undefined &&
                              ` · ${t('adminInventory.prices.foodCost', {
                                from: pct(d.foodCostFrom),
                                to: pct(d.foodCostTo),
                              })}`}
                          </span>
                          {over && (
                            <span className={styles.overNote}>
                              {t('adminInventory.prices.overGoal', { goal: pct(goal) })}
                            </span>
                          )}
                        </span>
                        <span className={styles.dishActions}>
                          <Button size="sm" variant="secondary" onClick={() => onRecipe(d.slug)}>
                            {t('adminInventory.prices.openRecipe')}
                          </Button>
                          {can('menu.manage') && (
                            <Button size="sm" variant="ghost" href={`${MENU_PATH}?dish=${d.slug}`}>
                              {t('adminInventory.prices.changePrice')}
                            </Button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </Dialog>
  );
}
