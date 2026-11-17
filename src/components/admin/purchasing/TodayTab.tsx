'use client';

import { useState } from 'react';
import {
  useContent,
  useInventoryStock,
  usePriceChanges,
  usePurchaseOrders,
  useSuppliers,
} from '@/api/hooks';
import { useSavePurchaseOrder } from '@/api/mutations';
import { Button, Icon, type IconName } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { ADMIN_NAV, INVENTORY_READERS } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import { readyOrders } from '@/lib/inventoryPlanning';
import { setupProgress, todayWork, type SetupStep } from '@/lib/purchasingToday';
import type { PurchaseOrder } from '@/types/purchasing';
import { InfoTip } from '../inventory/InfoTip';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { docNumber, usePurchasingText } from './usePurchasingText';
import styles from './Purchasing.module.css';

const INVENTORY_PATH =
  ADMIN_NAV.find((item) => item.id === 'inventory')?.href ?? '/admin/dashboard/';

const STEP_ICON: Record<SetupStep, IconName> = {
  ingredients: 'leaf',
  supplier: 'store',
  items: 'list',
  order: 'receipt',
};

export interface TodayActions {
  onOpenOrder: (id: string | 'new') => void;
  onReceive: (orderId?: string) => void;
  onOpenReceipt: (id: string) => void;
  /** Suppliers, to add one or say what they sell. */
  onSuppliers: () => void;
}

/**
 * Purchasing › Today: where to start and what needs someone now. Until buying is set up, its four
 * steps (ingredients in Inventory, a supplier, what they sell, a first order) with the next one
 * to do. Then, as cards: what's running low by supplier (one tap makes the order, quantities
 * filled in), orders to approve, to send, arriving today or late (to receive) and delivered
 * prices to check; each opens where it's dealt with. "All caught up" when nothing waits.
 */
export function TodayTab(actions: TodayActions) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = usePurchasingText();
  const { showToast } = useToast();
  const seesStock = can(...INVENTORY_READERS);
  const buys = can('purchase.manage');
  const orders = usePurchaseOrders(branch.id, {}).data;
  const suppliers = useSuppliers(branch.id).data;
  const stock = useInventoryStock(branch.id, seesStock).data;
  const prices = usePriceChanges(branch.id).data;
  const create = useSavePurchaseOrder();
  const [making, setMaking] = useState<string | null>(null);
  const today = useTodayKey();

  if (!orders || !suppliers || (seesStock && !stock)) {
    return (
      <p className={styles.muted} aria-busy="true">
        {t('adminInventory.loading')}
      </p>
    );
  }

  const setup = setupProgress({
    ingredients: seesStock ? (stock?.items.length ?? 0) : null,
    suppliers: suppliers.suppliers,
    orders: orders.orders,
  });
  const work = todayWork(orders.orders, prices?.changes ?? [], today);
  const ready = stock && buys ? readyOrders(stock.items, suppliers.suppliers) : null;

  const makeOrder = (supplierId: string) => {
    const order = ready?.orders.find((o) => o.supplier.id === supplierId);
    if (!order) return;
    setMaking(supplierId);
    create.mutate(
      {
        branchId: branch.id,
        body: {
          supplierId,
          lines: order.lines.map((l) => ({ ingredientId: l.item.ingredientId, quantity: l.packs })),
        },
      },
      {
        onSuccess: (made) => actions.onOpenOrder(made.id),
        onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
        onSettled: () => setMaking(null),
      },
    );
  };

  const stepAction = (step: SetupStep) => {
    switch (step) {
      case 'ingredients':
        return (
          <Button size="sm" iconEnd="arrow" href={INVENTORY_PATH}>
            {t('adminPurchasing.today.setup.ingredients.action')}
          </Button>
        );
      case 'supplier':
      case 'items':
        return (
          <Button size="sm" iconEnd="arrow" onClick={actions.onSuppliers}>
            {t(`adminPurchasing.today.setup.${step}.action`)}
          </Button>
        );
      case 'order':
        return buys ? (
          <Button size="sm" iconStart="plus" onClick={() => actions.onOpenOrder('new')}>
            {t('adminPurchasing.today.setup.order.action')}
          </Button>
        ) : null;
    }
  };

  const orderRow = (order: PurchaseOrder, action: React.ReactNode, tone?: 'late') => (
    <li key={order.id} className={cx(styles.row, tone === 'late' && styles.rowLate)}>
      <button
        type="button"
        className={styles.rowMain}
        onClick={() => actions.onOpenOrder(order.id)}
      >
        <span className={styles.rowTitle}>{order.supplier.name}</span>
        <span className={styles.rowMeta}>
          {[
            docNumber('PO', order.number),
            t.plural('adminPurchasing.orders.lineCount', order.lines.length),
            order.total !== undefined && text.money(order.total),
            order.expectedOn &&
              (tone === 'late'
                ? t('adminPurchasing.today.lateSince', {
                    date: clock.date(`${order.expectedOn}T12:00:00Z`),
                  })
                : t('adminPurchasing.today.dueToday')),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </button>
      {action}
    </li>
  );

  const cards: React.ReactNode[] = [];
  if (ready && ready.orders.length > 0) {
    cards.push(
      <Card
        key="low"
        icon="alert"
        tone="warn"
        title={t('adminPurchasing.today.low.title')}
        tip={t('adminPurchasing.tips.low')}
        count={ready.orders.reduce((n, o) => n + o.lines.length, 0)}
        hint={t('adminPurchasing.today.low.hint')}
      >
        <ul className={styles.rows}>
          {ready.orders.map((o) => (
            <li key={o.supplier.id} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{o.supplier.name}</span>
                <span className={styles.rowMeta}>
                  {[
                    o.lines
                      .slice(0, 3)
                      .map((l) => l.item.name)
                      .join(', ') + (o.lines.length > 3 ? ` +${o.lines.length - 3}` : ''),
                    o.total > 0 && text.money(o.total),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <Button
                size="sm"
                iconStart="plus"
                loading={making === o.supplier.id}
                disabled={making !== null && making !== o.supplier.id}
                onClick={() => makeOrder(o.supplier.id)}
              >
                {t('adminPurchasing.today.low.make')}
              </Button>
            </li>
          ))}
        </ul>
        {ready.noSupplier.length > 0 && (
          <p className={styles.note}>
            <Icon name="info" size="xs" />
            {t('adminPurchasing.today.low.noSupplier', {
              names: ready.noSupplier.map((i) => i.name).join(', '),
            })}
          </p>
        )}
      </Card>,
    );
  }
  if (work.arriving.length > 0 && can('purchase.receive', 'purchase.manage')) {
    cards.push(
      <Card
        key="arriving"
        icon="bag"
        tone={work.late > 0 ? 'err' : 'info'}
        title={t('adminPurchasing.today.arriving.title')}
        count={work.arriving.length}
        hint={
          work.late > 0
            ? t.plural('adminPurchasing.today.arriving.late', work.late)
            : t('adminPurchasing.today.arriving.hint')
        }
      >
        <ul className={styles.rows}>
          {work.arriving.map((o) =>
            orderRow(
              o,
              <Button size="sm" iconStart="check" onClick={() => actions.onReceive(o.id)}>
                {t('adminPurchasing.today.arriving.receive')}
              </Button>,
              (o.expectedOn ?? today) < today ? 'late' : undefined,
            ),
          )}
        </ul>
      </Card>,
    );
  }
  if (work.toApprove.length > 0 && can('purchase.approve')) {
    cards.push(
      <Card
        key="approve"
        icon="shield"
        tone="warn"
        title={t('adminPurchasing.today.approve.title')}
        count={work.toApprove.length}
        hint={t('adminPurchasing.today.approve.hint')}
      >
        <ul className={styles.rows}>
          {work.toApprove.map((o) =>
            orderRow(
              o,
              <Button size="sm" variant="secondary" onClick={() => actions.onOpenOrder(o.id)}>
                {t('adminPurchasing.today.approve.open')}
              </Button>,
            ),
          )}
        </ul>
      </Card>,
    );
  }
  if (work.toSend.length > 0 && buys) {
    cards.push(
      <Card
        key="send"
        icon="whatsapp"
        tone="info"
        title={t('adminPurchasing.today.send.title')}
        count={work.toSend.length}
        hint={t('adminPurchasing.today.send.hint')}
      >
        <ul className={styles.rows}>
          {work.toSend.map((o) =>
            orderRow(
              o,
              <Button size="sm" variant="secondary" onClick={() => actions.onOpenOrder(o.id)}>
                {t('adminPurchasing.today.send.open')}
              </Button>,
            ),
          )}
        </ul>
      </Card>,
    );
  }
  if (work.pricesToCheck.length > 0 && buys) {
    cards.push(
      <Card
        key="prices"
        icon="tag"
        tone="warn"
        title={t('adminPurchasing.today.prices.title')}
        tip={t('adminPurchasing.tips.prices')}
        count={work.pricesToCheck.length}
        hint={t('adminPurchasing.today.prices.hint')}
      >
        <ul className={styles.rows}>
          {work.pricesToCheck.slice(0, 5).map((p) => (
            <li key={p.lineId} className={styles.row}>
              <button
                type="button"
                className={styles.rowMain}
                onClick={() => actions.onOpenReceipt(p.receiptId)}
              >
                <span className={styles.rowTitle}>{p.name}</span>
                <span className={styles.rowMeta}>
                  {[
                    p.supplier,
                    p.pricePending
                      ? t('adminPurchasing.receipts.toConfirm')
                      : p.expectedPrice !== undefined &&
                        t('adminPurchasing.today.prices.was', {
                          price: text.perPack(p.price, p.pack),
                          expected: text.money(p.expectedPrice),
                        }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
              <Icon name="chev" size="sm" className={styles.rowChev} />
            </li>
          ))}
        </ul>
      </Card>,
    );
  }

  return (
    <div className={styles.today}>
      {/* The usual jobs, always one tap away. */}
      <div className={styles.quick}>
        {buys && (
          <Button iconStart="plus" onClick={() => actions.onOpenOrder('new')}>
            {t('adminPurchasing.orders.new')}
          </Button>
        )}
        {can('purchase.receive', 'purchase.manage') && (
          <Button variant="secondary" iconStart="bag" onClick={() => actions.onReceive()}>
            {t('adminPurchasing.receive.title')}
          </Button>
        )}
        {buys && (
          <Button variant="secondary" iconStart="store" onClick={actions.onSuppliers}>
            {t('adminPurchasing.today.suppliers')}
          </Button>
        )}
      </div>

      {setup.next && (
        <section className={styles.setup} aria-labelledby="po-setup">
          <div className={styles.setupHead}>
            <h2 id="po-setup" className={styles.setupTitle}>
              {t('adminPurchasing.today.setup.title')}
            </h2>
            <p className={styles.muted}>{t('adminPurchasing.today.setup.intro')}</p>
            <div
              className={styles.progress}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={setup.steps.length}
              aria-valuenow={setup.doneCount}
              aria-label={t('adminPurchasing.today.setup.progress', {
                done: setup.doneCount,
                total: setup.steps.length,
              })}
            >
              <span style={{ width: `${(setup.doneCount / setup.steps.length) * 100}%` }} />
            </div>
          </div>
          <ol className={styles.steps}>
            {setup.steps.map((step, index) => (
              <li
                key={step.id}
                className={styles.step}
                data-state={step.done ? 'done' : step.id === setup.next ? 'next' : 'later'}
              >
                <span className={styles.stepMark} aria-hidden="true">
                  {step.done ? <Icon name="check" size="sm" /> : index + 1}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>
                    <Icon name={STEP_ICON[step.id]} size="xs" />
                    {t(`adminPurchasing.today.setup.${step.id}.title`)}
                  </span>
                  <span className={styles.stepHint}>
                    {t(`adminPurchasing.today.setup.${step.id}.hint`)}
                  </span>
                </span>
                {step.id === setup.next && stepAction(step.id)}
              </li>
            ))}
          </ol>
        </section>
      )}

      {cards.length > 0 ? (
        <div className={styles.cards}>{cards}</div>
      ) : (
        !setup.next && (
          <p className={styles.allGood}>
            <Icon name="checkc" size="sm" />
            <span>
              <strong>{t('adminPurchasing.today.allGood.title')}</strong>
              <span className={styles.muted}>{t('adminPurchasing.today.allGood.hint')}</span>
            </span>
          </p>
        )
      )}
    </div>
  );
}

/** One "needs you" card: its icon and colour, what it is, how many, a line of help, the rows. */
function Card({
  icon,
  tone,
  title,
  count,
  hint,
  tip,
  children,
}: {
  icon: IconName;
  tone: 'warn' | 'err' | 'info';
  title: string;
  count: number;
  hint: string;
  /** One more sentence, behind an ⓘ. */
  tip?: string;
  children: React.ReactNode;
}) {
  const t = useContent('common');
  return (
    <section className={styles.actionCard} data-tone={tone}>
      <header className={styles.cardHead}>
        <span className={styles.cardIcon} aria-hidden="true">
          <Icon name={icon} size="sm" />
        </span>
        <span className={styles.cardText}>
          <h2 className={styles.cardTitle}>
            {title}
            <span className={styles.cardCount}>{count}</span>
            {tip && <InfoTip label={t('adminInventory.tips.label')}>{tip}</InfoTip>}
          </h2>
          <span className={styles.muted}>{hint}</span>
        </span>
      </header>
      {children}
    </section>
  );
}

/** The branch's today ("2026-11-17"). */
function useTodayKey() {
  const { clock } = useAdminWorkspace();
  return clock.dayKey(new Date());
}
