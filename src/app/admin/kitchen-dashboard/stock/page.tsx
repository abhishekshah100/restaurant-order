import { KitchenStock } from '@/components/kitchen/stock/KitchenStock';
import { kitchenMetadata } from '../kitchenMetadata';

export const generateMetadata = () => kitchenMetadata('stock');

export default function KitchenStockPage() {
  return <KitchenStock />;
}
