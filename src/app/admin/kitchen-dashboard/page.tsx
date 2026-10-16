import { KitchenBoard } from '@/components/kitchen/board/KitchenBoard';
import { kitchenMetadata } from './kitchenMetadata';

export const generateMetadata = () => kitchenMetadata('board');

export default function KitchenDashboardPage() {
  return <KitchenBoard />;
}
