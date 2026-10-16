import { KitchenActivity } from '@/components/kitchen/activity/KitchenActivity';
import { kitchenMetadata } from '../kitchenMetadata';

export const generateMetadata = () => kitchenMetadata('activity');

export default function KitchenActivityPage() {
  return <KitchenActivity />;
}
