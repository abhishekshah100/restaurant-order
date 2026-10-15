import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { TableQrCodes } from '@/components/admin/tables/qr/TableQrCodes';

export const generateMetadata = () => adminMetadata('qrCodes');

export default function AdminTableQrCodesPage() {
  return <TableQrCodes />;
}
