'use client';

import type { BranchSales, SalesReport } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { salesSheets, type SalesExportWords } from '@/lib/salesExport';
import { downloadXlsx, toXlsxBook } from '@/lib/xlsx';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/**
 * Downloads the sales report as an Excel workbook, in the screen's words: call the function it
 * returns with the report, its period and comparison as read, and the branches side by side when
 * they're shown.
 */
export function useSalesExport() {
  const t = useContent('common');
  const cart = useContent('cart');
  const { branch, clock, region, filePrefix } = useAdminWorkspace();
  const { methodName } = usePaymentText();

  const words: SalesExportWords = {
    sheet: (key) => t(`adminSales.export.sheets.${key}`),
    column: (key) => t(`adminSales.export.columns.${key}`),
    figure: (key) => t(`adminSales.export.figures.${key}`),
    mode: (mode) => t(`adminSales.modes.${mode as 'dineIn' | 'takeaway' | 'delivery'}`),
    method: methodName,
    channel: (channel) => t(`adminSales.export.channels.${channel}`),
    reason: (reason) => t(`adminPayments.entry.reasons.${reason}` as Parameters<typeof t>[0]),
    tax: (labelKey, rate) =>
      cart(`priceSummary.lines.${labelKey}` as Parameters<typeof cart>[0], { rate }),
    // Line labels: the statement's own words ("Refunds:" takes the reason after it).
    money: (key) =>
      key === 'waived'
        ? t('adminSales.export.waived')
        : t(`adminSales.money.${key}` as Parameters<typeof t>[0], { reason: '' }).trim(),
    yes: t('adminSales.export.yes'),
    no: t('adminSales.export.no'),
    removed: t('adminSales.dishes.removed'),
  };

  return (
    report: SalesReport,
    text: { period: string; compared: string },
    branches?: readonly BranchSales[],
  ) => {
    const sheets = salesSheets(
      report,
      {
        branch: branch.name,
        period: text.period,
        compared: text.compared,
        generated: clock.dateTime(report.generatedAt),
        nepal: region.country === 'NP',
      },
      words,
      branches,
    );
    downloadXlsx(
      toXlsxBook(sheets),
      t('adminSales.export.file', { branch: filePrefix, from: report.from, to: report.to }),
    );
  };
}
