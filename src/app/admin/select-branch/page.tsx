import type { Metadata } from 'next';
import { AdminSelectBranch } from '@/components/admin/AdminSelectBranch';

export const metadata: Metadata = {
  title: 'Select branch',
  robots: { index: false, follow: false },
};

export default function AdminSelectBranchPage() {
  return <AdminSelectBranch />;
}
