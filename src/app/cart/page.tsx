import type { Metadata } from 'next';
import { CartView } from '@/components/cart/CartView';

export const metadata: Metadata = {
  title: 'Your cart',
  description: 'Review your order, add a note for the kitchen and check out.',
};

export default function CartPage() {
  return <CartView />;
}
