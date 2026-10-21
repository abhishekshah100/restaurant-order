import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { CartView } from '@/components/cart/CartView';
import { BranchStatusWatch } from '@/components/status/BranchStatusWatch';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('cart');
  return { title: t('meta.title'), description: t('meta.description') };
}

export default function CartPage() {
  return (
    <>
      <CartView />
      <BranchStatusWatch />
    </>
  );
}
