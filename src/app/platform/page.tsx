import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { PlatformConsole } from '@/components/platform/PlatformConsole';

/*
 * /platform/: the application owner's console for every client's package. Linked from nowhere
 * and kept out of search; what guards it is the platform key the server checks on every request
 * (restaurant-backend › ADR-051).
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('common');
  return {
    title: t('platform.meta.title'),
    robots: { index: false, follow: false },
  };
}

export default function PlatformPage() {
  return <PlatformConsole />;
}
