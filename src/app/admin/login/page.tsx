import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { AdminLogin } from '@/components/admin/AdminLogin';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('common');
  return {
    title: t('adminLogin.meta.title'),
    robots: { index: false, follow: false },
  };
}

export default function AdminLoginPage() {
  return <AdminLogin />;
}
