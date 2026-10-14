import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { AdminSelectBranch } from '@/components/admin/AdminSelectBranch';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('common');
  return {
    title: t('adminSelectBranch.meta.title'),
    robots: { index: false, follow: false },
  };
}

export default function AdminSelectBranchPage() {
  return <AdminSelectBranch />;
}
