import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { AdminHome } from '@/components/admin/home/AdminHome';

export const generateMetadata = () => adminMetadata('home');

/** /admin/dashboard/: the waiter home. */
export default function AdminHomePage() {
  return <AdminHome />;
}
