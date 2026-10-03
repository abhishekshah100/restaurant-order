'use client';

import { useContent } from '@/api/hooks';
import { Dialog } from '@/components/ui';
import { CartPanel } from './CartPanel';

export interface CartSlideOverProps {
  open: boolean;
  onClose: () => void;
}

/** Tablet (768–1023px): the cart opens as a right-hand slide-over panel. */
export function CartSlideOver({ open, onClose }: CartSlideOverProps) {
  const t = useContent('cart');
  return (
    <Dialog open={open} onClose={onClose} presentation="panel" title={t('panel.title')} hideTitle>
      <CartPanel inDialog onNavigate={onClose} />
    </Dialog>
  );
}
