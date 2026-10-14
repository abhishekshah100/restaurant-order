import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { MenuSection } from '@/components/admin/sections/MenuSection';

export const generateMetadata = () => adminMetadata('menu');

export default function AdminMenuPage() {
  return <MenuSection />;
}
