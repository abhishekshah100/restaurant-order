import { kitchenStage } from '@/lib/kitchenBoard';
import type { KitchenMarks, Order } from '@/types/order';
import type { KitchenStep } from '../../contracts';
import { fail, isObject, type Handler } from '../context';
import { liveOrder } from '../kitchen';
import { liveRoundStatus, saveOrder, storedOrder } from './adminOrders';
import { adminBranch, signedInAccount } from './adminSessions';

/*
 * The kitchen's endpoint: moving a round on — started cooking, or ready (handed to the rider,
 * for delivery). The mark goes on the round (`kitchen.started` / `kitchen.ready`, when and who),
 * and the mock kitchen (api/mock/kitchen) takes it over its own timing from then on. The board
 * itself reads today's orders (GET /admin/branches/:branchId/orders), like the Orders page.
 */

const KITCHEN_STEPS: readonly KitchenStep[] = ['preparing', 'ready'];

/** The round's marks with this step added; a step already marked keeps who did it first. */
function marked(marks: KitchenMarks | undefined, step: KitchenStep, at: string, by: string) {
  const key = step === 'preparing' ? 'started' : 'ready';
  return { ...marks, [key]: marks?.[key] ?? { at, by } };
}

/** PATCH /admin/branches/:branchId/orders/:id/rounds/:round/status */
export const setKitchenStatus: Handler = async (ctx, { params, body, headers }) => {
  const account = signedInAccount(ctx, headers);
  const branch = await adminBranch(ctx, headers, params.branchId);
  const step = KITCHEN_STEPS.find((s) => isObject(body) && body.status === s);
  if (!step) fail(400, 'invalid_request');
  const number = Number(params.round);
  const order = await storedOrder(ctx, branch, params.id);
  const now = new Date(ctx.now());
  const live = liveOrder(order, now.getTime(), branch);
  if (live.status === 'cancelled') fail(409, 'order_closed');
  const status = liveRoundStatus(live, number);
  if (!status) fail(404, 'not_found');
  const stage = kitchenStage(status);
  if (stage === 'cancelled' || stage === 'done') fail(409, 'order_closed');
  // Already there (or further along): nothing to change.
  if (stage === 'ready' || (step === 'preparing' && stage === 'cooking'))
    return saveOrder(ctx, branch, order, now);

  const at = now.toISOString();
  const updated: Order = order.rounds
    ? {
        ...order,
        rounds: order.rounds.map((r) =>
          r.number === number ? { ...r, kitchen: marked(r.kitchen, step, at, account.name) } : r,
        ),
      }
    : { ...order, kitchen: marked(order.kitchen, step, at, account.name) };
  return saveOrder(ctx, branch, updated, now);
};
