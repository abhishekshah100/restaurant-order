import type { IconName } from '@/components/ui';
import type { PaymentMethodId } from '@/types/branch';
import type { PaymentMethod } from '@/types/order';

/**
 * Every payment method the app knows. Branches list the ones they offer (GET /branches ›
 * payments); this says how each looks and behaves. Names are in content (common › paymentMethods).
 */
type PaymentMethodSpec =
  | {
      icon: IconName;
      /** Paid now, in the app. */
      settlement: Extract<PaymentMethod, 'online'>;
      /** What the guest does while it's processing: approve in an app, or complete a bank page. */
      approval: 'app' | 'bank';
    }
  /** Paid in person: at the counter, when collecting, or cash to the rider. */
  | { icon: IconName; settlement: Exclude<PaymentMethod, 'online'> };

export const PAYMENT_METHODS: Record<PaymentMethodId, PaymentMethodSpec> = {
  online: { icon: 'mobile', settlement: 'online', approval: 'app' },
  upi: { icon: 'mobile', settlement: 'online', approval: 'app' },
  card: { icon: 'card', settlement: 'online', approval: 'bank' },
  esewa: { icon: 'mobile', settlement: 'online', approval: 'app' },
  khalti: { icon: 'mobile', settlement: 'online', approval: 'app' },
  fonepay: { icon: 'qr', settlement: 'online', approval: 'app' },
  counter: { icon: 'cash', settlement: 'counter' },
  pickup: { icon: 'cash', settlement: 'pickup' },
  cod: { icon: 'cash', settlement: 'cod' },
};

/** Paid now, in the app (otherwise in person, later). */
export const isOnlineMethod = (method: PaymentMethodId) =>
  PAYMENT_METHODS[method].settlement === 'online';

export const isPaymentMethodId = (v: unknown): v is PaymentMethodId =>
  typeof v === 'string' && Object.hasOwn(PAYMENT_METHODS, v);

/** The chosen method if the list offers it, else the list's first (the default choice). */
export function pickMethod<T extends { id: PaymentMethodId }>(
  options: readonly T[],
  chosen: PaymentMethodId | null,
): PaymentMethodId {
  return options.find((o) => o.id === chosen)?.id ?? options[0].id;
}

/** What the guest does while a payment is processing (an in-person payment never processes). */
export function approvalKind(method: PaymentMethodId): 'app' | 'bank' {
  const spec = PAYMENT_METHODS[method];
  return spec.settlement === 'online' ? spec.approval : 'app';
}

/** An online payment request: the method and how the guest approves it. */
export interface Approval {
  kind: 'app' | 'bank';
  /** The method's id, for its name (common › paymentMethods). */
  method: PaymentMethodId;
}

/**
 * The online method a payment request is for: the chosen one if it's paid online and
 * offered, else the first online method offered.
 */
export function onlineMethod<T extends { id: PaymentMethodId }>(
  options: readonly T[],
  chosen: PaymentMethodId | null,
): Approval {
  const online = options.filter((o) => PAYMENT_METHODS[o.id].settlement === 'online');
  const method = pickMethod(online, chosen);
  return { kind: approvalKind(method), method };
}
