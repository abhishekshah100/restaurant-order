import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { AuditLog } from '@/components/admin/audit/AuditLog';

export const generateMetadata = () => adminMetadata('audit');

export default function AdminAuditPage() {
  return <AuditLog />;
}
