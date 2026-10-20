'use client';

import { useEffect } from 'react';
import { useContent, useMenu } from '@/api/hooks';
import { useHydrated } from '@/hooks/useHydrated';
import { useQueryParam } from '@/hooks/useQueryParam';
import { DishDetail } from './DishDetail';

/**
 * `/dish/?slug=…`: the dish is read from the guest's live menu on the client, so every dish
 * opens here, including ones staff add after the site was built. The page is titled with the
 * dish's name once it's known (the static page can't be).
 */
export function DishPage() {
  const hydrated = useHydrated();
  const slug = useQueryParam('slug') ?? '';
  const dish = useMenu().getDish(slug);
  const common = useContent('common');

  useEffect(() => {
    if (dish) document.title = common('meta.titleTemplate').replace('%s', dish.name);
  }, [common, dish]);

  // Nothing until the query string can be read (prerender and hydration).
  return hydrated ? <DishDetail slug={slug} /> : null;
}
