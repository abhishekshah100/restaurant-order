import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { makeQueryClient } from '@/api/queryClient';
import { prefetchHelp } from '@/api/server';

/** The Help topics are only read here, so they're built into these pages, not every page. */
export default async function HelpLayout({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = makeQueryClient();
  await prefetchHelp(queryClient);
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
