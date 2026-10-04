'use client';

import { useMemo } from 'react';
import { useBranch, useContent } from '@/api/hooks';
import { numberLocale } from '@/lib/money';

/**
 * Words that differ by region, for `{placeholders}` in global copy: the currency's spoken name
 * ("rupees"), the tax invoice ("GST invoice", "VAT invoice") and how the printed bill can be
 * paid, listed the branch's way ("card, UPI or cash").
 */
export type RegionCopy = {
  currencyName: string;
  taxInvoice: string;
  paymentMethods: string;
};

export function useRegionCopy(): RegionCopy {
  const branch = useBranch();
  const common = useContent('common');
  const t = useContent('service');
  return useMemo(() => {
    const list = new Intl.ListFormat(numberLocale(branch), { type: 'disjunction' });
    return {
      currencyName: common(`currencyNames.${branch.currency.nameKey}`),
      taxInvoice: t(`region.taxInvoice.${branch.tax.invoiceKey}`),
      paymentMethods: list.format(branch.payments.atTable.map((m) => t(`region.atTable.${m}`))),
    };
  }, [branch, common, t]);
}
