import type { ReactNode } from 'react';
import { OrderingGate } from '@/components/status/OrderingGate';

/** Checkout is only reachable while ordering is open and the device is online. */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <OrderingGate>{children}</OrderingGate>;
}
