import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { makeQueryClient } from '@/api/queryClient';
import { prefetchGuestData } from '@/api/server';
import { GuestProviders } from '@/context/GuestProviders';

/**
 * The guest app's pages (/, menu, cart, checkout, orders, help…): the guest's session, cart and
 * the rest (GuestProviders), with the default branch's menu and promotions built in. Staff pages
 * (/admin) sit outside this group, so they never load guest data. The group adds nothing to
 * the URLs.
 */
export default async function GuestLayout({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = makeQueryClient();
  await prefetchGuestData(queryClient);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <GuestProviders>{children}</GuestProviders>
    </HydrationBoundary>
  );
}
