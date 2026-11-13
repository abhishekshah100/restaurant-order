import type {
  InventoryDashboard,
  PriceRise,
  RecipeSummary,
  StockItem,
  StockSummary,
} from '@/types/inventory';

/*
 * Inventory made easy to start and to run. Pure (data in, plain answers out), so it's
 * unit-tested; the screens word it.
 *
 * Get started: four steps. ① Add ingredients ② Enter what you have now ③ Set "order when
 * below" ④ Link dishes to ingredients. ① and ② are needed before stock means anything, so the
 * guide is the first screen until stock has started; ③ and ④ can be skipped (on this
 * device) and are offered from Today until then.
 *
 * Today: what needs someone, most urgent first, each with what to do about it.
 */

export const SETUP_STEPS = ['ingredients', 'opening', 'levels', 'recipes'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
export type StepState = 'done' | 'skipped' | 'todo';

export interface SetupState {
  steps: Record<SetupStep, StepState>;
  /** The first step still to do (none: set up). */
  current: SetupStep | null;
  /** Inventory hasn't started (no ingredients, or none has stock in): the guide comes first. */
  needed: boolean;
  /** Steps done or skipped, of four. */
  finished: number;
  tracked: number;
  /** Tracked items whose starting stock isn't in yet. */
  openingDue: number;
  /** Tracked items with an "order when below" level. */
  withLevel: number;
  /** Dishes with a recipe, of all dishes. */
  withRecipe: number;
  dishes: number;
}

export function setupState(
  items: readonly StockItem[],
  dishes: readonly RecipeSummary[] | undefined,
  skipped: ReadonlySet<SetupStep>,
): SetupState {
  const tracked = items.length;
  const openingDue = items.filter((i) => i.openingDue).length;
  const withLevel = items.filter((i) => i.reorderLevel > 0).length;
  const withRecipe = dishes?.filter((d) => d.lines > 0).length ?? 0;
  const state = (done: boolean, step: SetupStep): StepState =>
    done ? 'done' : skipped.has(step) ? 'skipped' : 'todo';
  const steps: Record<SetupStep, StepState> = {
    ingredients: tracked > 0 ? 'done' : 'todo',
    opening: tracked > 0 && openingDue === 0 ? 'done' : 'todo',
    levels: state(tracked > 0 && withLevel === tracked, 'levels'),
    recipes: state(withRecipe > 0, 'recipes'),
  };
  return {
    steps,
    current: SETUP_STEPS.find((s) => steps[s] === 'todo') ?? null,
    // Not started yet: nothing tracked, or nothing has a starting amount. (One new item
    // without one is Today's job, not a reason to show the guide again.)
    needed: tracked === 0 || openingDue === tracked,
    finished: SETUP_STEPS.filter((s) => steps[s] !== 'todo').length,
    tracked,
    openingDue,
    withLevel,
    withRecipe,
    dishes: dishes?.length ?? 0,
  };
}

/** The same name, however it's typed ("  Paneer" and "paneer"). */
export const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/* ---------- Today: what needs someone ---------- */

export type AttentionId =
  | 'out'
  | 'expired'
  | 'low'
  | 'runningOut'
  | 'priceUp'
  | 'opening'
  | 'expiring'
  | 'deliveriesDue'
  | 'pricesToConfirm'
  | 'ordersToApprove'
  | 'countsToApply'
  | 'transfersToReceive'
  | 'countDue';

export interface Attention {
  id: AttentionId;
  /** urgent: act today; soon: this week; info: worth a look. */
  tone: 'urgent' | 'soon' | 'info';
  count: number;
  /** Expired: what it's worth. */
  value?: number;
  /** Count due: days since the last count. */
  days?: number;
  /** Prices up: the dishes (plates) they touch, and how many are now over the food cost goal. */
  dishes?: number;
  overGoal?: number;
}

/** Dishes a price rise touches, and those whose food cost it takes over the goal. */
export function priceImpact(rises: readonly PriceRise[], goal: number | undefined) {
  const dishes = new Set<string>();
  const over = new Set<string>();
  for (const rise of rises) {
    for (const d of rise.dishes) {
      dishes.add(d.slug);
      if (goal !== undefined && (d.foodCostTo ?? 0) > goal) over.add(d.slug);
    }
  }
  return { dishes: dishes.size, overGoal: over.size };
}

/** Prices up: urgent when a dish's food cost is now over the goal. */
function priceLine(dashboard: InventoryDashboard | undefined): Attention[] {
  const rises = dashboard?.priceRises ?? [];
  if (rises.length === 0) return [];
  const { dishes, overGoal } = priceImpact(rises, dashboard?.foodCostTarget);
  return [
    {
      id: 'priceUp',
      tone: overGoal > 0 ? 'urgent' : 'soon',
      count: rises.length,
      dishes,
      overGoal,
    },
  ];
}

/** A stock count is due this many days after the last. */
export const COUNT_EVERY_DAYS = 7;
const DAY_MS = 86_400_000;

/**
 * What needs someone, most urgent first: out and expired stock, running low, starting stock
 * missing, use-first; purchasing's deliveries, prices and approvals (when `purchasing`); counts to
 * apply, transfers to receive; and a stock count when the last is a week old.
 */
export function attention(
  summary: StockSummary,
  openingDue: number,
  dashboard: InventoryDashboard | undefined,
  now: Date,
  purchasing: boolean,
  /** Items not low yet but running out within days, at the rate used (lib/inventoryPlanning). */
  runningOut = 0,
): Attention[] {
  const todo = dashboard?.todo;
  const lastCount = dashboard?.lastCount;
  const sinceCount = lastCount
    ? Math.floor((now.getTime() - Date.parse(lastCount.at)) / DAY_MS)
    : undefined;
  const list: (Attention | false)[] = [
    summary.out > 0 && { id: 'out', tone: 'urgent', count: summary.out },
    summary.expired > 0 && {
      id: 'expired',
      tone: 'urgent',
      count: summary.expired,
      ...(summary.expiredValue !== undefined ? { value: summary.expiredValue } : {}),
    },
    summary.low > 0 && { id: 'low', tone: 'soon', count: summary.low },
    runningOut > 0 && { id: 'runningOut', tone: 'soon', count: runningOut },
    ...priceLine(dashboard),
    openingDue > 0 && { id: 'opening', tone: 'soon', count: openingDue },
    summary.expiring > 0 && { id: 'expiring', tone: 'soon', count: summary.expiring },
    purchasing &&
      Boolean(todo?.deliveriesDue) && {
        id: 'deliveriesDue',
        tone: 'soon',
        count: todo?.deliveriesDue ?? 0,
      },
    purchasing &&
      Boolean(todo?.pricesToConfirm) && {
        id: 'pricesToConfirm',
        tone: 'info',
        count: todo?.pricesToConfirm ?? 0,
      },
    purchasing &&
      Boolean(todo?.ordersToApprove) && {
        id: 'ordersToApprove',
        tone: 'info',
        count: todo?.ordersToApprove ?? 0,
      },
    Boolean(todo?.countsToApply) && {
      id: 'countsToApply',
      tone: 'info',
      count: todo?.countsToApply ?? 0,
    },
    Boolean(todo?.transfersToReceive) && {
      id: 'transfersToReceive',
      tone: 'info',
      count: todo?.transfersToReceive ?? 0,
    },
    // A week since the last count. (Never counted isn't asked: entering what you have is the
    // first count, and asking right after setup would only nag.)
    summary.tracked > 0 &&
      sinceCount !== undefined &&
      sinceCount >= COUNT_EVERY_DAYS && {
        id: 'countDue',
        tone: 'info',
        count: 1,
        days: sinceCount,
      },
  ];
  return list.filter((a): a is Attention => Boolean(a));
}

/* ---------- Stock levels at a glance ---------- */

/**
 * How full an item is, 0–1, against what a full shelf holds (or, without one, twice its "order
 * when below" level); none when there's nothing to measure it against.
 */
export function fullness(item: Pick<StockItem, 'onHand' | 'reorderLevel' | 'parLevel'>) {
  const full = item.parLevel > 0 ? item.parLevel : item.reorderLevel * 2;
  if (full <= 0) return undefined;
  return Math.max(0, Math.min(1, item.onHand / full));
}
