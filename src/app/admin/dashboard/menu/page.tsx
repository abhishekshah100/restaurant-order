import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { MenuBoard } from '@/components/admin/menu/MenuBoard';

export const generateMetadata = () => adminMetadata('menu');

export default function AdminMenuPage() {
  return <MenuBoard />;
}
