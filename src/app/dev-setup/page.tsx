import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { DevSetup } from '@/components/devSetup/DevSetup';

/*
 * /dev-setup/: the developer setup page. Linked from nowhere and kept out of search; what guards
 * it is the developer key the server checks on every request (restaurant-backend › ADR-047).
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('common');
  return {
    title: t('devSetup.meta.title'),
    robots: { index: false, follow: false },
  };
}

export default function DevSetupPage() {
  return <DevSetup />;
}
