'use client';

import { useContent } from '@/api/hooks';
import type { LedgerLine } from '@/lib/adminPayments';
import { downloadXlsx, toXlsx } from '@/lib/xlsx';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { usePaymentText } from './usePaymentText';

/**
 * The Excel export of payments and refunds (Payments today, and Payments › History): one row
 * each, oldest first. `days` names the file: "2026-11-10", or "2026-11-01_2026-11-10".
 */
export function useLedgerExport() {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const text = usePaymentText();
  return (entries: readonly LedgerLine[], days: string) => {
    const c = (key: Parameters<typeof t>[0]) => t(key);
    const workbook = toXlsx(
      t('adminPayments.title'),
      [...entries].reverse(),
      [
        c('adminPayments.report.columns.time'),
        c('adminPayments.report.columns.order'),
        c('adminPayments.report.columns.where'),
        c('adminPayments.report.columns.guest'),
        c('adminPayments.report.columns.kind'),
        c('adminPayments.report.columns.method'),
        c('adminPayments.report.columns.channel'),
        c('adminPayments.report.columns.amount'),
        c('adminPayments.report.columns.tip'),
        c('adminPayments.report.columns.left'),
        c('adminPayments.report.columns.leftReason'),
        c('adminPayments.report.columns.by'),
        c('adminPayments.report.columns.ref'),
        c('adminPayments.report.columns.reason'),
        c('adminPayments.report.columns.status'),
      ],
      (e: LedgerLine) => [
        clock.dateTime(e.at),
        e.order.id,
        text.where(e.order),
        e.order.customerName,
        t(e.kind === 'refund' ? 'adminPayments.entry.refund' : 'adminPayments.entry.payment'),
        text.methodName(e.method),
        t(e.channel === 'online' ? 'adminPayments.entry.online' : 'adminPayments.entry.inPerson'),
        e.kind === 'refund' ? -e.amount : e.amount,
        e.tip ?? '',
        e.waived ?? '',
        e.waiveReason ? t(`adminPayments.entry.waiveReasons.${e.waiveReason}`) : '',
        e.by ?? '',
        e.transactionRef ?? '',
        e.reason ? t(`adminPayments.entry.reasons.${e.reason}`) : '',
        e.kind === 'refund'
          ? t(
              e.status === 'started'
                ? 'adminPayments.entry.refundStarted'
                : 'adminPayments.entry.refundDone',
            )
          : '',
      ],
    );
    downloadXlsx(
      workbook,
      t('adminPayments.actions.exportFile', {
        branch: branch.id,
        date: days,
      }),
    );
  };
}
