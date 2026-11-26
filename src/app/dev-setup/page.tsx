import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { PlatformConsole } from '@/components/platform/PlatformConsole';

/*
 * /dev-setup/: the platform console opened on its Dev setup tab (old links keep working). Linked
 * from nowhere and kept out of search; what guards it is the platform owner's key the server
 * checks on every request (restaurant-backend › ADR-047, ADR-051).
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('common');
  return {
    title: t('devSetup.meta.title'),
    robots: { index: false, follow: false },
  };
}

export default function DevSetupPage() {
  return <PlatformConsole initialTab="devSetup" />;
}
