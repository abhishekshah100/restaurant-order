'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCheckout } from '@/context/CheckoutContext';
import { useCart } from './useCart';

export type GuardStep = 'details' | 'verify' | 'pay';

/**
 * Sends the guest back to the right step if they land mid-checkout:
 * empty cart → /cart, no number yet → details, not verified → verify.
 * Returns true once it's safe to render the step.
 */
export function useCheckoutGuard(step: GuardStep): boolean {
  const router = useRouter();
  const cart = useCart();
  const { session, hydrated } = useCheckout();
  const ready = cart.hydrated && hydrated;

  let redirect: string | null = null;
  if (ready) {
    if (cart.lines.length === 0) redirect = '/cart/';
    else if (step !== 'details' && !session.phone) redirect = '/checkout/details/';
    else if (step === 'pay' && !session.verified) redirect = '/checkout/verify/';
  }

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  return ready && redirect === null;
}
