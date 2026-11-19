'use client';

import type { BranchSales, BranchSalesReport } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { Button } from '@/components/ui';
import { cx } from '@/lib/cx';
import { dayCount } from '@/lib/dayRange';
import { createMoney, type Money, type MoneyRegion } from '@/lib/money';
import { changeOf, shareOf } from '@/lib/salesReport';
import { ChangeBadge } from './KpiTiles';
import styles from './Sales.module.css';

/** How a branch writes its money (only what formatting needs: its spoken name isn't). */
const moneyOf = (b: BranchSales): Money =>
  createMoney({
    locale: b.money.locale,
    localeFallback: b.money.localeFallback ?? undefined,
    currency: { code: b.money.code, symbol: b.money.symbol, minorUnit: b.money.minorUnit },
  } as MoneyRegion);

/**
 * The restaurant's branches side by side: a card each — net sales against the period before, its
 * share of the best branch in the same currency, orders, average bill, best seller — and a way
 * into its own report. Branches in another currency are grouped apart and never added together.
 */
export function BranchComparison({
  data,
  currentId,
  onOpen,
}: {
  data: BranchSalesReport;
  currentId: string;
  onOpen: (branchId: string) => void;
}) {
  const t = useContent('common');
  const span = t.plural('adminSales.periods.previous', dayCount(data));
  const groups = new Map<string, BranchSales[]>();
  for (const b of data.branches) groups.set(b.money.code, [...(groups.get(b.money.code) ?? []), b]);
  const mixed = groups.size > 1;

  return (
    <section className={cx(styles.card, styles.full)} aria-labelledby="sales-branches">
      <div className={styles.cardHead}>
        <div>
          <h2 id="sales-branches" className={styles.cardTitle}>
            {t('adminSales.branches.title')}
          </h2>
          <p className={styles.cardHint}>{t('adminSales.branches.hint')}</p>
        </div>
      </div>
      {data.branches.length === 0 ? (
        <p className={styles.empty}>{t('adminSales.branches.empty')}</p>
      ) : (
        [...groups.entries()].map(([code, branches]) => {
          const money = moneyOf(branches[0] as BranchSales);
          const best = Math.max(...branches.map((b) => b.totals.netSales));
          const net = branches.reduce((sum, b) => sum + b.totals.netSales, 0);
          const before = branches.reduce((sum, b) => sum + b.before.netSales, 0);
          const orders = branches.reduce((sum, b) => sum + b.totals.orders, 0);
          return (
            <div key={code} className={styles.branchGroup}>
              {(mixed || branches.length > 1) && (
                <div className={styles.groupHead}>
                  <h3 className={styles.subTitle}>
                    {t.plural('adminSales.branches.total', branches.length, { currency: code })}
                  </h3>
                  {branches.length > 1 && (
                    <p className={styles.groupTotal}>
                      <strong>{money.format(net)}</strong>
                      <ChangeBadge change={changeOf(net, before)} />
                      <span>{t.plural('adminSales.branches.orders', orders)}</span>
                    </p>
                  )}
                </div>
              )}
              <ul className={styles.branchCards}>
                {branches.map((b) => (
                  <BranchCard
                    key={b.id}
                    span={span}
                    branch={b}
                    money={moneyOf(b)}
                    share={shareOf(b.totals.netSales, best)}
                    here={b.id === currentId}
                    onOpen={() => onOpen(b.id)}
                  />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}

function BranchCard({
  span,
  branch,
  money,
  share,
  here,
  onOpen,
}: {
  /** What "before" is, in words. */
  span: string;
  branch: BranchSales;
  money: Money;
  share: number;
  here: boolean;
  onOpen: () => void;
}) {
  const t = useContent('common');
  const { totals, before } = branch;
  const amount = (value: number) => money.format(Math.round(value));
  return (
    <li className={cx(styles.branchCard, here && styles.branchHere)}>
      <div className={styles.branchTop}>
        <div className={styles.branchNames}>
          <h3 className={styles.branchName}>{branch.shortName}</h3>
          <span className={styles.rankCategory}>{branch.name}</span>
        </div>
        {here && (
          <span className={cx(styles.tag, styles.tagNew)}>{t('adminSales.branches.here')}</span>
        )}
      </div>
      <p className={styles.branchValue}>{amount(totals.netSales)}</p>
      <p className={styles.kpiChange}>
        {totals.orders === 0 && before.orders === 0 ? (
          <span className={styles.kpiBefore}>{t('adminSales.branches.noSales')}</span>
        ) : (
          <>
            <ChangeBadge change={changeOf(totals.netSales, before.netSales)} />
            <span className={styles.kpiBefore}>
              {before.netSales > 0
                ? t('adminSales.kpi.vs', { value: amount(before.netSales), span })
                : t('adminSales.kpi.nothingBefore', { span })}
            </span>
          </>
        )}
      </p>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${share}%` }} />
      </span>
      <dl className={styles.branchFacts}>
        <div>
          <dt>{t('adminSales.kpi.orders.label')}</dt>
          <dd>{totals.orders}</dd>
        </div>
        <div>
          <dt>{t('adminSales.branches.averageBill')}</dt>
          <dd>{amount(totals.averageBill)}</dd>
        </div>
        <div className={styles.branchBest}>
          <dt>{t('adminSales.branches.bestSeller')}</dt>
          <dd>{branch.topDish?.name ?? '—'}</dd>
        </div>
      </dl>
      {!here && (
        <Button
          variant="secondary"
          size="sm"
          iconStart="chart"
          className={styles.more}
          aria-label={t('adminSales.branches.openLabel', { branch: branch.shortName })}
          onClick={onOpen}
        >
          {t('adminSales.branches.open')}
        </Button>
      )}
    </li>
  );
}
