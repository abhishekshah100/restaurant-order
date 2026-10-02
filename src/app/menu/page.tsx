import type { Metadata } from 'next';
import { MenuHome } from '@/components/menu/MenuHome';

export const metadata: Metadata = {
  title: 'Menu',
  description:
    "Chef's picks, starters, mains, pizza, breads, desserts and drinks — order from your table.",
};

export default function MenuPage() {
  return <MenuHome />;
}
