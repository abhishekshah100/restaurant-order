import type { PromoQuote } from '../../contracts';
import {
  fail,
  liveSession,
  objectBody,
  ok,
  stringField,
  type Handler,
  type MockContext,
} from '../context';
import { guestSessionIds, promoUses, quotePromo, type PromoCheck } from '../promos';
import { offerLines } from './orderPricing';

/** How often the session's guest has used each code (POST /orders, payments and quotes). */
export function guestPromoUses(ctx: MockContext, sessionId: string): PromoCheck['uses'] {
  const sessions = guestSessionIds(ctx.db.otp.read(), sessionId);
  const orders = ctx.db.orders.read();
  return (code) => promoUses(orders, code, sessions);
}

/** POST /promos/validate */
export const validatePromo: Handler = async (ctx, { body: raw }) => {
  const body = objectBody(raw);
  const code = stringField(body, 'code');
  const { session, branch } = await liveSession(ctx, stringField(body, 'sessionId'));
  const [menu, promotions] = await Promise.all([
    ctx.seed.menu(branch.id),
    ctx.seed.promotions(branch.id),
  ]);
  const at = new Date(ctx.now());
  // A quote for the cart: the order itself says if something's sold out.
  const lines = offerLines(body, branch, { menu, promotions, pricedAt: at }, { orderable: false });
  const { promo, discount, offerDiscount } = quotePromo(
    promotions.codes,
    code,
    lines,
    { mode: session.mode, at, uses: guestPromoUses(ctx, session.id) },
    branch.currency.minorUnit,
  );
  const response: PromoQuote = {
    code: promo.code,
    descriptionKey: promo.descriptionKey,
    discount,
    offerDiscount,
  };
  return ok(response);
};

/** GET /branches/:branchId/promotions */
export const branchPromotions: Handler = async (ctx, { params }) => {
  const branch = (await ctx.seed.branches()).find((b) => b.id === params.branchId);
  if (!branch) fail(404, 'not_found');
  return ok(await ctx.seed.promotions(branch.id));
};
