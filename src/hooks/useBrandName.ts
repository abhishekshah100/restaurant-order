'use client';

import { useEffect } from 'react';
import { useBranchSummary, useContent } from '@/api/hooks';
import { brandName } from '@/lib/branchParts';

/**
 * The name the guest's branch goes by (Settings › Branch details); the default branch's before
 * a session, as on the staff sign-in.
 */
export function useBrandName(): string {
  return brandName(useBranchSummary().name);
}

/**
 * Puts `brand` in the browser tab's title in place of the name built into the pages' metadata,
 * on every page the title changes on.
 */
export function useBrandTitle(brand: string): void {
  const built = useContent('common')('meta.applicationName');
  useEffect(() => {
    if (brand === built) return;
    const rename = () => {
      if (document.title.includes(built)) document.title = document.title.replaceAll(built, brand);
    };
    rename();
    const observer = new MutationObserver(rename);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = document.title.replaceAll(brand, built);
    };
  }, [brand, built]);
}
