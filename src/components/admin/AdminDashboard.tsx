'use client';

import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { useAdminDashboardData, type DashboardSection } from '@/api/adminDashboard';
import { useBranches, useContent, useRestaurant } from '@/api/hooks';
import { Button, Dialog, Icon, MetricCard, StatusPill, VegMark } from '@/components/ui';
import { AdminDashboardHeader } from '@/components/admin/AdminDashboardHeader';
import { isAvailable, startingPrice } from '@/lib/menu';
import { createClock } from '@/lib/clock';
import { groupByVisit } from '@/lib/orders';
import { adminUsername, selectedAdminBranch } from '@/lib/adminAuth';
import type { Branch } from '@/types/branch';
import type { ChoiceSpec, Dish } from '@/types/menu';
import type { Order } from '@/types/order';
import styles from './AdminDashboard.module.css';

type Section = DashboardSection;
type AdminTranslator = ReturnType<typeof useContent<'common'>>;

const NAV: { id: Section; icon: 'olive' | 'table' | 'receipt' | 'menu' | 'bell' | 'card' }[] = [
  { id: 'dashboard', icon: 'olive' },
  { id: 'tables', icon: 'table' },
  { id: 'orders', icon: 'receipt' },
  { id: 'menu', icon: 'menu' },
  { id: 'requests', icon: 'bell' },
  { id: 'payments', icon: 'card' },
];

const subscribe = () => () => {};

function sectionHref(section: Section) {
  return section === 'dashboard' ? '/admin/dashboard/' : `/admin/dashboard/${section}/`;
}

interface DraftLine {
  dish: Dish;
  variant?: string;
  addOns: string[];
  choices: string[];
  total: number;
}

function choiceName(choice: string | ChoiceSpec) {
  return typeof choice === 'string' ? choice : choice.name;
}

function choicePrice(choice: string | ChoiceSpec | undefined) {
  return typeof choice === 'string' || !choice ? 0 : (choice.price ?? 0);
}

function formatMoney(branch: Branch, amount: number) {
  return `${branch.currency.symbol}${amount.toLocaleString()}`;
}

function statusLabel(status: Branch['status']) {
  return status;
}

function lastEvent(order: Order) {
  return order.timeline.at(-1);
}

export function AdminDashboard({
  section,
  initialOrderFilter = 'all',
}: {
  section: Section;
  initialOrderFilter?: 'all' | 'ready' | 'unpaid';
}) {
  const branches = useBranches();
  const t = useContent('common');
  const restaurant = useRestaurant();
  const branch = useSyncExternalStore(
    subscribe,
    () => selectedAdminBranch(branches),
    () => undefined,
  );
  const [search, setSearch] = useState('');
  const [menuCategory, setMenuCategory] = useState('all');
  const [orderFilter, setOrderFilter] = useState(initialOrderFilter);
  const [selectedTable, setSelectedTable] = useState<number>();
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order>();
  const [customising, setCustomising] = useState<Dish>();
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [variantId, setVariantId] = useState('');
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [optionChoices, setOptionChoices] = useState<Record<string, string>>({});

  const dashboardData = useAdminDashboardData(branch, selectedTable, section);
  const { menu, orders, tables } = dashboardData;
  const todayOrders = branch ? groupByVisit(orders, new Date(), createClock(branch)).today : [];
  const todayOrderIds = new Set(todayOrders.map((order) => order.id));
  const readyTodayOrders = todayOrders.filter((order) => order.status === 'ready');
  const readyOrders = orders.filter((order) => order.status === 'ready');
  const unpaidOrders = orders.filter(
    (order) => order.status !== 'cancelled' && order.payment.status === 'unpaid',
  );
  const menuDishes = useMemo(() => {
    if (!menu) return [];
    const matchingSearch = search ? menu.searchDishes(search) : menu.dishes;
    const filtered = matchingSearch.filter(
      (dish) => menuCategory === 'all' || dish.categoryId === menuCategory,
    );
    return filtered.slice(0, 12);
  }, [menu, menuCategory, search]);

  if (!branch) return null;
  if (section === 'dashboard' || section === 'menu') {
    if (dashboardData.menuError)
      return <div className={styles.loading}>{dashboardData.menuError.message}</div>;
    if (dashboardData.menuLoading || !menu)
      return <div className={styles.loading}>{t('adminDashboard.empty.loadingMenu')}</div>;
  }
  const openCustomiser = (dish: Dish) => {
    setCustomising(dish);
    const initialVariantId =
      dish.variants?.find((variant) => variant.available !== false)?.id ?? '';
    setVariantId(initialVariantId);
    setAddOnIds([]);
    setOptionChoices(
      Object.fromEntries(
        (dish.optionGroups ?? [])
          .filter((group) => !group.availableFor || group.availableFor.includes(initialVariantId))
          .map((group) => [
            group.id,
            choiceName(
              group.choices.find(
                (choice) =>
                  typeof choice === 'string' ||
                  !choice.availableFor ||
                  choice.availableFor.includes(initialVariantId),
              ) ?? '',
            ),
          ]),
      ),
    );
  };

  const addDraftItem = () => {
    if (!customising) return;
    const variant = customising.variants?.find((item) => item.id === variantId);
    const selectedAddOns = (customising.addOns ?? []).filter((addOn) =>
      addOnIds.includes(addOn.id),
    );
    const selectedChoices = (customising.optionGroups ?? [])
      .filter((group) => !group.availableFor || group.availableFor.includes(variantId))
      .flatMap((group) =>
        group.choices.filter(
          (choice) =>
            choiceName(choice) === optionChoices[group.id] &&
            (typeof choice === 'string' ||
              !choice.availableFor ||
              choice.availableFor.includes(variantId)),
        ),
      );
    setDraft((items) => [
      ...items,
      {
        dish: customising,
        variant: variant?.name,
        addOns: selectedAddOns.map((addOn) => addOn.name),
        choices: selectedChoices.map(choiceName),
        total:
          (variant?.price ?? customising.price) +
          selectedAddOns.reduce(
            (total, addOn) => total + (addOn.priceByVariant?.[variantId] ?? addOn.price),
            0,
          ) +
          selectedChoices.reduce((total, choice) => total + choicePrice(choice), 0),
      },
    ]);
    setCustomising(undefined);
  };

  const visibleOrders = orders.filter((order) => {
    if (orderFilter === 'ready' && order.status !== 'ready') return false;
    if (
      orderFilter === 'unpaid' &&
      (order.status === 'cancelled' || order.payment.status !== 'unpaid')
    )
      return false;
    return true;
  });
  const navLabels: Record<Section, string> = {
    dashboard: t('adminDashboard.nav.dashboard'),
    tables: t('adminDashboard.nav.tables'),
    orders: t('adminDashboard.nav.orders'),
    menu: t('adminDashboard.nav.menu'),
    requests: t('adminDashboard.nav.requests'),
    payments: t('adminDashboard.nav.payments'),
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/admin/dashboard/">
          <span className={styles.brandMark}>
            <Icon name="olive" size="md" />
          </span>
          <span>
            <b>{restaurant.name}</b>
            <small>{t('adminDashboard.waiterWorkspace')}</small>
          </span>
        </Link>
        <nav className={styles.navigation} aria-label={t('adminDashboard.mainNavigation')}>
          <span className={styles.navHeading}>{t('adminDashboard.workspace')}</span>
          {NAV.map((item) => (
            <Link
              key={item.id}
              href={sectionHref(item.id)}
              className={`${styles.navItem} ${section === item.id ? styles.navActive : ''}`}
              aria-current={section === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size="sm" />
              <span>{navLabels[item.id]}</span>
              {item.id === 'orders' && readyOrders.length > 0 && (
                <span className={styles.navCount}>{readyOrders.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <div className={styles.profileMark}>
            <Icon name="user" size="sm" />
          </div>
          <div className={styles.profileCopy}>
            <strong>{t('adminDashboard.waiter')}</strong>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <AdminDashboardHeader
          branchName={branch.name}
          sectionLabel={navLabels[section]}
          branchStatus={
            <span className={`${styles.status} ${styles[branch.status]}`}>
              <i />
              {t(`adminDashboard.status.${statusLabel(branch.status)}`)}
            </span>
          }
          notificationsLabel={t('adminDashboard.notificationsUnavailable')}
        />

        <div className={styles.content}>
          {section === 'dashboard' && menu && (
            <>
              <div className={styles.welcome}>
                <div>
                  <h1>
                    {t('adminDashboard.greeting', {
                      username: adminUsername() ?? t('adminDashboard.greetingFallback'),
                    })}
                  </h1>
                  <p>{t('adminDashboard.serviceOverview')}</p>
                </div>
              </div>
              {dashboardData.ordersError && (
                <div className={styles.errorNotice}>
                  {t('adminDashboard.ordersError', { error: dashboardData.ordersError.message })}
                </div>
              )}
              <section className={styles.metrics} aria-label={t('adminDashboard.dataSummary')}>
                <MetricCard
                  icon="receipt"
                  label={t('adminDashboard.metrics.orders')}
                  value={
                    dashboardData.ordersLoading || dashboardData.ordersError
                      ? '—'
                      : todayOrders.length.toString()
                  }
                  detail=""
                />
                <MetricCard
                  icon="cloche"
                  label={t('adminDashboard.metrics.ready')}
                  value={
                    dashboardData.ordersLoading || dashboardData.ordersError
                      ? '—'
                      : readyTodayOrders.length.toString()
                  }
                  tone="success"
                  detail=""
                />
                <MetricCard
                  icon="table"
                  label={t('adminDashboard.metrics.tables')}
                  value={`${branch.tables.first}–${branch.tables.last}`}
                  tone="gold"
                  detail=""
                />
                <MetricCard
                  icon="menu"
                  label={t('adminDashboard.metrics.menu')}
                  value={menu.dishes.length.toString()}
                  tone="rose"
                  detail=""
                />
                <MetricCard
                  icon="menu"
                  label={t('adminDashboard.metrics.newOrder')}
                  value={menu.dishes.length.toString()}
                  tone="rose"
                  detail=""
                />
                <MetricCard
                  icon="menu"
                  label={t('adminDashboard.metrics.requestBill')}
                  value={menu.dishes.length.toString()}
                  tone="rose"
                  detail=""
                />
                <MetricCard
                  icon="menu"
                  label={t('adminDashboard.metrics.delayed')}
                  value={menu.dishes.length.toString()}
                  tone="rose"
                  detail=""
                />
                <MetricCard
                  icon="menu"
                  label={t('adminDashboard.metrics.test')}
                  value={menu.dishes.length.toString()}
                  tone="rose"
                  detail=""
                />
              </section>
              <div className={styles.dashboardGrid}>
                <section className={`${styles.panel} ${styles.activityPanel}`}>
                  <PanelHeading
                    title={t('adminDashboard.recentOrders')}
                    description={t('adminDashboard.recentOrdersDetail')}
                    action={t('adminDashboard.viewAll')}
                    actionHref={sectionHref('orders')}
                  />
                  {dashboardData.ordersLoading ? (
                    <Empty label={t('adminDashboard.empty.loadingOrders')} />
                  ) : todayOrders.length === 0 ? (
                    <Empty label={t('adminDashboard.empty.noActivity')} />
                  ) : (
                    <div className={styles.activityList}>
                      {dashboardData.activity
                        .filter((event) => todayOrderIds.has(event.order.id))
                        .slice(0, 6)
                        .map((event) => (
                          <button
                            className={styles.activityRow}
                            key={event.id}
                            onClick={() => setSelectedOrder(event.order)}
                          >
                            <span className={styles.activityDot}>
                              <Icon
                                name={event.status === 'ready' ? 'check' : 'receipt'}
                                size="xs"
                              />
                            </span>
                            <span>
                              <strong>{event.note ?? t(`orderStatus.${event.status}`)}</strong>
                              <small>
                                {t('adminDashboard.orderNumber', { order: event.order.id })} ·{' '}
                                {event.order.customerName}
                              </small>
                            </span>
                            <time>{event.time}</time>
                          </button>
                        ))}
                    </div>
                  )}
                </section>
                <section className={`${styles.panel} ${styles.quickPanel}`}>
                  <PanelHeading
                    title={t('adminDashboard.quickActions')}
                    description={t('adminDashboard.quickActionsDetail')}
                  />
                  <div className={styles.quickActions}>
                    <QuickAction
                      icon="table"
                      title={t('adminDashboard.reviewTables')}
                      detail={t('adminDashboard.tableReferences')}
                      href={sectionHref('tables')}
                    />
                    <QuickAction
                      icon="cloche"
                      title={t('adminDashboard.readyOrders')}
                      detail={t('adminDashboard.readyInHistory', { count: readyOrders.length })}
                      href="/admin/dashboard/orders/ready/"
                    />
                    <QuickAction
                      icon="menu"
                      title={t('adminDashboard.findMenu')}
                      detail={t('adminDashboard.browseDraft')}
                      href={sectionHref('menu')}
                    />
                    <QuickAction
                      icon="card"
                      title={t('adminDashboard.unpaidOrders')}
                      detail={t('adminDashboard.readyInHistory', { count: unpaidOrders.length })}
                      href="/admin/dashboard/orders/unpaid/"
                    />
                  </div>
                </section>
                <section className={`${styles.panel} ${styles.tablePanel}`}>
                  <PanelHeading
                    title={t('adminDashboard.tableOverview')}
                    description={t('adminDashboard.tableOverviewDetail')}
                    action={t('adminDashboard.seeTables')}
                    actionHref={sectionHref('tables')}
                  />
                  {tables.length === 0 ? (
                    <Empty label={t('adminDashboard.empty.noTables')} />
                  ) : (
                    <div className={styles.tableGrid}>
                      {tables.slice(0, 8).map((number) => (
                        <Link
                          key={number}
                          className={styles.tableTile}
                          href={sectionHref('tables')}
                        >
                          <Icon name="table" size="sm" />
                          <span>{t('adminDashboard.tableNumber', { table: number })}</span>
                          <small>{t('adminDashboard.tableHistory')}</small>
                        </Link>
                      ))}
                    </div>
                  )}
                  <p className={styles.dataNote}>{t('adminDashboard.liveTablesUnavailable')}</p>
                </section>
                <section className={`${styles.panel} ${styles.menuPanel}`}>
                  <PanelHeading
                    title={t('adminDashboard.menuPreview')}
                    description={t('adminDashboard.menuPreviewDetail')}
                    action={t('adminDashboard.browseMenu')}
                    actionHref={sectionHref('menu')}
                  />
                  <div className={styles.dishPreview}>
                    {menu
                      .featuredDishes()
                      .filter(isAvailable)
                      .slice(0, 3)
                      .map((dish) => (
                        <Link key={dish.slug} className={styles.dishRow} href={sectionHref('menu')}>
                          <VegMark veg={dish.veg} />
                          <span>
                            <strong>{dish.name}</strong>
                            <small>
                              {menu.getCategory(dish.categoryId)?.name ??
                                t('adminDashboard.menuItemFallback')}
                            </small>
                          </span>
                          <b>{formatMoney(branch, startingPrice(dish))}</b>
                        </Link>
                      ))}
                  </div>
                </section>
              </div>
            </>
          )}

          {section === 'tables' && selectedTable !== undefined && (
            <SectionPage
              t={t}
              title={t('adminDashboard.tableNumber', { table: selectedTable })}
              subtitle={t('adminDashboard.tableDetailSubtitle')}
              note={t('adminDashboard.tableSessionLimitation')}
            >
              <button className={styles.backToTables} onClick={() => setSelectedTable(undefined)}>
                <Icon name="back" size="xs" />
                {t('adminDashboard.backToTables')}
              </button>
              {dashboardData.tableOrdersError && (
                <div className={styles.errorNotice}>{dashboardData.tableOrdersError.message}</div>
              )}
              {dashboardData.tableOrdersLoading ? (
                <Empty label={t('adminDashboard.empty.loadingOrders')} />
              ) : dashboardData.tableOrders.length ? (
                <div className={styles.orderList}>
                  {dashboardData.tableOrders.map((order) => (
                    <OrderRow
                      t={t}
                      key={order.id}
                      order={order}
                      branch={branch}
                      onClick={() => setSelectedOrder(order)}
                    />
                  ))}
                </div>
              ) : (
                <Empty label={t('adminDashboard.empty.noTableOrders')} />
              )}
              {dashboardData.sessionIds.length > 0 && (
                <section className={styles.panel}>
                  <h2 className={styles.detailHeading}>{t('adminDashboard.sessionReferences')}</h2>
                  <p className={styles.dataNote}>{t('adminDashboard.sessionStatusUnavailable')}</p>
                  {dashboardData.sessionIds.map((sessionId) => {
                    const sessionOrders = dashboardData.tableOrders.filter(
                      (order) => order.sessionId === sessionId,
                    );
                    return (
                      <div className={styles.sessionRow} key={sessionId}>
                        <strong>{t('adminDashboard.sessionNumber', { session: sessionId })}</strong>
                        <span>
                          {t('adminDashboard.sessionOrders', {
                            orders: sessionOrders.map((order) => order.id).join(', '),
                          })}
                        </span>
                      </div>
                    );
                  })}
                  {dashboardData.requestsError && (
                    <div className={styles.errorNotice}>{dashboardData.requestsError.message}</div>
                  )}
                  {dashboardData.requestsLoading && (
                    <p className={styles.dataNote}>{t('adminDashboard.loadingRequests')}</p>
                  )}
                  {dashboardData.tableRequests.map((request) => (
                    <div className={styles.sessionRow} key={request.id}>
                      <strong>
                        {request.kind === 'bill'
                          ? t('adminDashboard.billRequest')
                          : t('adminDashboard.waiterRequest', { reason: request.reason })}
                      </strong>
                      <span>
                        {request.kind === 'bill'
                          ? formatMoney(branch, request.balance)
                          : (request.note ?? t('adminDashboard.noRequestNote'))}
                      </span>
                    </div>
                  ))}
                  {!dashboardData.requestsLoading && dashboardData.tableRequests.length === 0 && (
                    <p className={styles.dataNote}>{t('adminDashboard.noSessionRequests')}</p>
                  )}
                </section>
              )}
            </SectionPage>
          )}

          {section === 'tables' && selectedTable === undefined && (
            <SectionPage
              t={t}
              title={t('adminDashboard.tableRecords')}
              subtitle={t('adminDashboard.sections.tablesSubtitle')}
              note={t('adminDashboard.tableUnavailable')}
            >
              {tables.length ? (
                <div className={styles.tableGridLarge}>
                  {tables.map((table) => {
                    const tableOrderCount = orders.filter((order) => order.table === table).length;
                    return (
                      <button
                        key={table}
                        className={styles.tableCard}
                        onClick={() => setSelectedTable(table)}
                      >
                        <span className={styles.tableCardIcon}>
                          <Icon name="table" />
                        </span>
                        <span>
                          <strong>{t('adminDashboard.tableNumber', { table })}</strong>
                          <small>{t.plural('adminDashboard.sampleOrders', tableOrderCount)}</small>
                        </span>
                        <Icon name="chev" size="xs" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Empty label={t('adminDashboard.empty.noTableReferences')} />
              )}
            </SectionPage>
          )}

          {section === 'orders' && (
            <SectionPage
              t={t}
              title={navLabels.orders}
              subtitle={t('adminDashboard.sections.ordersSubtitle')}
            >
              <div className={styles.filterRow}>
                {(['all', 'ready', 'unpaid'] as const).map((filter) => (
                  <button
                    key={filter}
                    className={`${styles.filter} ${orderFilter === filter ? styles.filterActive : ''}`}
                    onClick={() => setOrderFilter(filter)}
                  >
                    {filter === 'all'
                      ? t('adminDashboard.allRecords')
                      : filter === 'ready'
                        ? t('adminDashboard.readyStatus')
                        : t('adminDashboard.unpaid')}
                  </button>
                ))}
              </div>
              {dashboardData.ordersError ? (
                <div className={styles.errorNotice}>{dashboardData.ordersError.message}</div>
              ) : dashboardData.ordersLoading ? (
                <Empty label={t('adminDashboard.empty.loadingOrders')} />
              ) : visibleOrders.length ? (
                <div className={styles.orderList}>
                  {visibleOrders.map((order) => (
                    <OrderRow
                      t={t}
                      key={order.id}
                      order={order}
                      branch={branch}
                      onClick={() => setSelectedOrder(order)}
                    />
                  ))}
                </div>
              ) : (
                <Empty label={t('adminDashboard.empty.noFilterMatch')} />
              )}
            </SectionPage>
          )}

          {section === 'menu' && menu && (
            <SectionPage
              t={t}
              title={navLabels.menu}
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
                <kbd>{t('adminDashboard.search.shortcut')}</kbd>
              </label>
              <label className={styles.categoryFilter}>
                {t('adminDashboard.categoryFilter')}
                <select
                  value={menuCategory}
                  onChange={(event) => setMenuCategory(event.target.value)}
                >
                  <option value="all">{t('adminDashboard.allCategories')}</option>
                  {menu.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.menuWorkspace}>
                <div className={styles.menuResults}>
                  {menuDishes.map((dish) => (
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
                        <strong>{formatMoney(branch, startingPrice(dish))}</strong>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!isAvailable(dish)}
                          onClick={() => openCustomiser(dish)}
                          iconStart="plus"
                        >
                          {t('adminDashboard.addToDraft')}
                        </Button>
                      </div>
                    </article>
                  ))}
                  {menuDishes.length === 0 && (
                    <Empty label={t('adminDashboard.empty.noMenuMatch')} />
                  )}
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
                            <small>{formatMoney(branch, line.total)}</small>
                          </span>
                          <button
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
            </SectionPage>
          )}

          {section === 'requests' && (
            <SectionPage
              t={t}
              title={navLabels.requests}
              subtitle={t('adminDashboard.sections.requestsSubtitle')}
            >
              <div className={styles.unavailable}>
                <span>
                  <Icon name="info" size="md" />
                </span>
                <h2>{t('adminDashboard.requestQueueTitle')}</h2>
                <p>{t('adminDashboard.requestQueueDescription')}</p>
              </div>
            </SectionPage>
          )}

          {section === 'payments' && (
            <SectionPage
              t={t}
              title={navLabels.payments}
              subtitle={t('adminDashboard.sections.paymentsSubtitle')}
            >
              <div className={styles.dataBanner}>
                <Icon name="info" size="xs" />
                {t('adminDashboard.paymentsDisclaimer')}
              </div>
              {dashboardData.ordersError ? (
                <div className={styles.errorNotice}>{dashboardData.ordersError.message}</div>
              ) : orders.length ? (
                <div className={styles.paymentList}>
                  {orders.map((order) => (
                    <button
                      key={order.id}
                      className={styles.paymentRow}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <span className={styles.paymentIcon}>
                        <Icon name="card" size="sm" />
                      </span>
                      <span>
                        <strong>{t('adminDashboard.orderNumber', { order: order.id })}</strong>
                        <small>
                          {order.customerName} · {order.payment.method}
                        </small>
                      </span>
                      <strong>{formatMoney(branch, order.total)}</strong>
                      <span
                        className={`${styles.paymentStatus} ${styles[`payment-${order.payment.status}`]}`}
                      >
                        {t(`adminDashboard.paymentStatus.${order.payment.status}`)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <Empty label={t('adminDashboard.empty.noPayments')} />
              )}
            </SectionPage>
          )}
        </div>
        <footer className={styles.footer}>
          {restaurant.name} <span>·</span> {t('adminDashboard.footer')}
        </footer>
      </main>

      <nav className={styles.bottomNav} aria-label={t('adminDashboard.mobileNavigation')}>
        {NAV.filter((item) => ['dashboard', 'tables', 'orders', 'menu'].includes(item.id)).map(
          (item) => (
            <Link
              key={item.id}
              href={sectionHref(item.id)}
              className={section === item.id ? styles.bottomActive : ''}
              aria-current={section === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size="sm" />
              <span>
                {item.id === 'dashboard' ? t('adminDashboard.bottomNav.home') : navLabels[item.id]}
              </span>
            </Link>
          ),
        )}
        <div className={styles.moreWrap}>
          {moreOpen && (
            <div
              className={styles.moreMenu}
              role="menu"
              aria-label={t('adminDashboard.moreOptions')}
            >
              {NAV.filter((item) => item.id === 'requests' || item.id === 'payments').map(
                (item) => (
                  <Link
                    key={item.id}
                    href={sectionHref(item.id)}
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                    }}
                  >
                    <Icon name={item.icon} size="xs" />
                    {navLabels[item.id]}
                  </Link>
                ),
              )}
            </div>
          )}
          <button
            className={['requests', 'payments'].includes(section) ? styles.bottomActive : ''}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <Icon name="dots" size="sm" />
            <span>{t('adminDashboard.bottomNav.more')}</span>
          </button>
        </div>
      </nav>

      <Dialog
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(undefined)}
        title={
          selectedOrder
            ? t('adminDashboard.orderNumber', { order: selectedOrder.id })
            : t('adminDashboard.orderDetails')
        }
        description={
          selectedOrder
            ? `${selectedOrder.customerName} · ${selectedOrder.mode === 'dineIn' ? t('adminDashboard.tableNumber', { table: selectedOrder.table ?? '—' }) : selectedOrder.mode}`
            : undefined
        }
      >
        {selectedOrder && (
          <div className={styles.orderDetail}>
            <div className={styles.detailStatuses}>
              <StatusPill status={selectedOrder.status} />
              <span
                className={`${styles.paymentStatus} ${styles[`payment-${selectedOrder.payment.status}`]}`}
              >
                {t('adminDashboard.payment')}:{' '}
                {t(`adminDashboard.paymentStatus.${selectedOrder.payment.status}`)}
              </span>
            </div>
            <h3>{t('adminDashboard.items')}</h3>
            {selectedOrder.items.map((item, index) => (
              <div className={styles.detailItem} key={`${item.dishSlug}-${index}`}>
                <div>
                  <strong>
                    {item.quantity} × {item.name}
                  </strong>
                  <small>
                    {[item.variant, ...item.details].filter(Boolean).join(' · ') ||
                      t('adminDashboard.noModifiers')}
                  </small>
                  {item.note && <small>{t('adminDashboard.itemNote', { note: item.note })}</small>}
                </div>
                {item.status && <span className={styles.itemStatus}>{item.status}</span>}
              </div>
            ))}
            {selectedOrder.kitchenNote && (
              <p className={styles.kitchenNote}>
                {t('adminDashboard.kitchenNote', { note: selectedOrder.kitchenNote })}
              </p>
            )}
            <div className={styles.totalLine}>
              <span>{t('adminDashboard.orderTotal')}</span>
              <strong>{formatMoney(branch, selectedOrder.total)}</strong>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(customising)}
        onClose={() => setCustomising(undefined)}
        title={customising?.name ?? t('adminDashboard.configureItem')}
        description={t('adminDashboard.addItemDescription')}
      >
        {customising && (
          <div className={styles.customiser}>
            {customising.variants && customising.variants.length > 0 && (
              <label className={styles.formLabel}>
                {t('adminDashboard.chooseVariant', {
                  variant: customising.variantLabel ?? t('adminDashboard.variant'),
                })}
                <select
                  value={variantId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setVariantId(next);
                    setAddOnIds((ids) =>
                      ids.filter((id) =>
                        customising.addOns?.some(
                          (addOn) =>
                            addOn.id === id &&
                            (!addOn.availableFor || addOn.availableFor.includes(next)),
                        ),
                      ),
                    );
                    setOptionChoices(
                      Object.fromEntries(
                        (customising.optionGroups ?? [])
                          .filter(
                            (group) => !group.availableFor || group.availableFor.includes(next),
                          )
                          .map((group) => {
                            const choices = group.choices.filter(
                              (choice) =>
                                typeof choice === 'string' ||
                                !choice.availableFor ||
                                choice.availableFor.includes(next),
                            );
                            return [
                              group.id,
                              choices.some(
                                (choice) => choiceName(choice) === optionChoices[group.id],
                              )
                                ? optionChoices[group.id]
                                : choiceName(choices[0] ?? ''),
                            ];
                          }),
                      ),
                    );
                  }}
                  required
                >
                  {customising.variants
                    .filter((variant) => variant.available !== false)
                    .map((variant) => (
                      <option value={variant.id} key={variant.id}>
                        {variant.name} · {formatMoney(branch, variant.price)}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {(customising.addOns ?? [])
              .filter((addOn) => !addOn.availableFor || addOn.availableFor.includes(variantId))
              .map((addOn) => {
                const limitReached =
                  customising.maxAddOns !== undefined && addOnIds.length >= customising.maxAddOns;
                return (
                  <label key={addOn.id} className={styles.checkOption}>
                    <input
                      type="checkbox"
                      checked={addOnIds.includes(addOn.id)}
                      disabled={!addOnIds.includes(addOn.id) && limitReached}
                      onChange={(event) =>
                        setAddOnIds((ids) =>
                          event.target.checked
                            ? [...ids, addOn.id]
                            : ids.filter((id) => id !== addOn.id),
                        )
                      }
                    />
                    <span>{addOn.name}</span>
                    <small>
                      {formatMoney(branch, addOn.priceByVariant?.[variantId] ?? addOn.price)}
                    </small>
                  </label>
                );
              })}
            {(customising.optionGroups ?? [])
              .filter(
                (group) =>
                  (!group.availableFor || group.availableFor.includes(variantId)) &&
                  group.choices.some(
                    (choice) =>
                      typeof choice === 'string' ||
                      !choice.availableFor ||
                      choice.availableFor.includes(variantId),
                  ),
              )
              .map((group) => {
                const choices = group.choices.filter(
                  (choice) =>
                    typeof choice === 'string' ||
                    !choice.availableFor ||
                    choice.availableFor.includes(variantId),
                );
                return (
                  <label className={styles.formLabel} key={group.id}>
                    {group.name}
                    <select
                      value={optionChoices[group.id] ?? choiceName(choices[0] ?? '')}
                      onChange={(event) =>
                        setOptionChoices((current) => ({
                          ...current,
                          [group.id]: event.target.value,
                        }))
                      }
                    >
                      {choices.map((choice) => (
                        <option key={choiceName(choice)} value={choiceName(choice)}>
                          {choiceName(choice)}
                          {choicePrice(choice) > 0
                            ? ` · ${formatMoney(branch, choicePrice(choice))}`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            <Button block onClick={addDraftItem} iconStart="plus">
              {t('adminDashboard.addToUnsentDraft')}
            </Button>
            <p className={styles.dataNote}>{t('adminDashboard.draftActionDisclaimer')}</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function PanelHeading({
  title,
  description,
  action,
  actionHref,
}: {
  title: string;
  description: string;
  action?: string;
  actionHref?: string;
}) {
  return (
    <div className={styles.panelHeading}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && actionHref && (
        <Link href={actionHref}>
          {action}
          <Icon name="chev" size="xs" />
        </Link>
      )}
    </div>
  );
}

function OrderRow({
  t,
  order,
  branch,
  onClick,
}: {
  t: AdminTranslator;
  order: Order;
  branch: Branch;
  onClick: () => void;
}) {
  const event = lastEvent(order);
  const mode =
    order.mode === 'dineIn'
      ? t('adminDashboard.tableNumber', { table: order.table ?? '—' })
      : t(`modes.${order.mode}`);
  return (
    <button className={styles.orderRow} onClick={onClick}>
      <span className={styles.orderIcon}>
        <Icon name={order.mode === 'dineIn' ? 'table' : 'bag'} size="sm" />
      </span>
      <span className={styles.orderCopy}>
        <strong>
          {order.customerName} <small>· {mode}</small>
        </strong>
        <span>
          {t('adminDashboard.itemCount', { count: order.items.length })} <i>·</i>{' '}
          {event?.time ??
            new Date(order.placedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </span>
      <span className={styles.orderAmount}>
        {formatMoney(branch, order.total)}
        <small>{t(`orderStatus.${order.status}`)}</small>
      </span>
      <Icon name="chev" size="xs" />
    </button>
  );
}

function QuickAction({
  icon,
  title,
  detail,
  href,
}: {
  icon: 'table' | 'cloche' | 'menu' | 'card';
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link className={styles.quickAction} href={href}>
      <span>
        <Icon name={icon} size="sm" />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <Icon name="chev" size="xs" />
    </Link>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className={styles.emptyState}>
      <span>
        <Icon name="receipt" size="sm" />
      </span>
      <p>{label}</p>
    </div>
  );
}

function SectionPage({
  t,
  title,
  subtitle,
  note,
  children,
}: {
  t: AdminTranslator;
  title: string;
  subtitle: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.sectionPage}>
      <div className={styles.sectionTitle}>
        <span className={styles.eyebrow}>{t('adminDashboard.branchWorkspace')}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {note && (
          <div className={styles.dataBanner}>
            <Icon name="info" size="xs" />
            {note}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
