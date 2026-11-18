'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { InvoiceRow } from '@/api/contracts';
import { api } from '@/api/endpoints';
import { useContent, useInvoice, useInvoices } from '@/api/hooks';
import { Button, Chip, Dialog, EmptyState, Skeleton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { paymentHistoryPath } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import {
  fiscalYearRanges,
  isTodayOnly,
  parseDayRange,
  type DayLimits,
  type DayRange,
} from '@/lib/dayRange';
import { DateRangeFilter } from '../DateRangeFilter';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { InvoiceDoc } from './InvoiceDoc';
import { usePaymentPrint } from './PaymentPrint';
import styles from './InvoiceList.module.css';
import { downloadFile } from '@/lib/saveFile';

const KINDS = ['all', 'invoice', 'creditNote'] as const;
type KindFilter = (typeof KINDS)[number];
const isKind = (v: string | null): v is KindFilter => KINDS.some((k) => k === v);

/** The server's limits: seven years back (GST keeps six), 31 days at a time. */
const INVOICE_LIMITS: DayLimits = { historyDays: 7 * 366, rangeDays: 31 };

/** The sales register downloads up to a year at a time (a whole financial year). */
const REGISTER_LIMITS: DayLimits = { historyDays: 7 * 366, rangeDays: 366 };

export const INVOICES_PATH = '/admin/dashboard/payments/invoices/';

/**
 * Payments › Invoices (`payments.collect` or `reports.view`): the tax invoices and credit notes
 * issued on the days picked (today without any), all or one kind, newest first: number, order,
 * buyer, amounts, whether it's been printed, what's credited. View opens one exactly as issued,
 * to print: the first print is the original, later ones copies ("Copy of original – 2"), each
 * recorded. The sales register for the days downloads as CSV. The server's only.
 */
export function InvoiceList() {
  const t = useContent('common');
  const { branch, clock, money, can } = useAdminWorkspace();
  const token = useAdminToken();
  const { showToast } = useToast();
  const router = useRouter();
  const now = useNow(60_000);
  const today = clock.dayKey(now ?? new Date());
  const days = parseDayRange(useQueryParam('from'), useQueryParam('to'), today, INVOICE_LIMITS);
  const kindParam = useQueryParam('kind');
  const kind: KindFilter = isKind(kindParam) ? kindParam : 'all';
  const list = useInvoices(branch.id, {
    from: days.from,
    to: days.to,
    ...(kind !== 'all' ? { kind } : {}),
  });
  const [viewing, setViewing] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [choosing, setChoosing] = useState(false);
  // The register's financial years (This FY so far, Last FY), where the branch has them.
  const years = branch.fiscalYears
    ? fiscalYearRanges(branch.fiscalYears, today, REGISTER_LIMITS)
    : [];

  const goTo = (range: DayRange, nextKind: KindFilter = kind) => {
    const search = new URLSearchParams();
    if (!isTodayOnly(range, today)) {
      search.set('from', range.from);
      search.set('to', range.to);
    }
    if (nextKind !== 'all') search.set('kind', nextKind);
    const qs = search.toString();
    router.replace(qs ? `${INVOICES_PATH}?${qs}` : INVOICES_PATH, { scroll: false });
  };

  /** The sales register for these days (named for its financial year, when it's one). */
  const register = async (range: DayRange = days, fiscalYear?: string) => {
    if (!token || downloading) return;
    setChoosing(false);
    setDownloading(true);
    try {
      const blob = await api.salesRegister(token, branch.id, { from: range.from, to: range.to });
      downloadFile(
        new Blob([blob], { type: 'text/csv' }),
        fiscalYear
          ? `sales-register-${branch.id}-FY${fiscalYear}.csv`
          : `sales-register-${branch.id}-${range.from}-${range.to}.csv`,
      );
    } catch {
      showToast(t('adminPayments.history.registerFailed'), { tone: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const printedText = (n: number) =>
    n === 0 ? t('adminInvoices.printed.zero') : t.plural('adminInvoices.printed', n);

  let content;
  if (list.data) {
    const rows = list.data.invoices;
    content =
      rows.length === 0 ? (
        <p className={styles.empty}>{t('adminInvoices.empty')}</p>
      ) : (
        <ol className={styles.list}>
          {rows.map((row: InvoiceRow) => (
            <li key={row.id} className={styles.row}>
              <span className={styles.main}>
                <span className={styles.numberLine}>
                  <span className={styles.number}>{row.number}</span>
                  <span className={cx(styles.kind, row.kind === 'creditNote' && styles.credit)}>
                    {t(`adminInvoices.kind.${row.kind}`)}
                  </span>
                </span>
                <span className={styles.meta}>
                  {[
                    clock.date(row.issuedAt),
                    row.date.bs && `BS ${row.date.bs}`,
                    t('adminInvoices.order', { order: row.order }),
                    row.buyer.name,
                    row.buyer.taxId,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className={styles.meta}>
                  {[
                    row.invoice && t('adminInvoices.against', { number: row.invoice }),
                    row.creditNotes &&
                      (row.active
                        ? t('adminInvoices.credited', { notes: row.creditNotes.join(', ') })
                        : t('adminInvoices.fullyCredited')),
                    printedText(row.prints),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className={styles.side}>
                <span className={cx(styles.total, row.kind === 'creditNote' && styles.credit)}>
                  {row.kind === 'creditNote' ? money.format(-row.total) : money.format(row.total)}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  iconStart="receipt"
                  onClick={() => setViewing(row.id)}
                >
                  {t('adminInvoices.view')}
                </Button>
              </span>
            </li>
          ))}
        </ol>
      );
  } else if (list.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminInvoices.error')}
        actions={
          <Button iconStart="refresh" loading={list.isFetching} onClick={() => list.refetch()}>
            {t('adminHome.error.retry')}
          </Button>
        }
      />
    );
  } else {
    content = (
      <div role="status" aria-label={t('adminInvoices.loading')} className={styles.loading}>
        <Skeleton shape="block" height={72} />
        <Skeleton shape="block" height={72} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <Link href={paymentHistoryPath()} className={styles.back}>
          {t('adminInvoices.back')}
        </Link>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{t('adminInvoices.title')}</h1>
          {can('reports.view') && (
            <Button
              variant="secondary"
              size="sm"
              iconStart="list"
              loading={downloading}
              aria-haspopup={years.length > 0 ? 'dialog' : undefined}
              onClick={() => (years.length > 0 ? setChoosing(true) : void register())}
            >
              {t('adminInvoices.register')}
            </Button>
          )}
        </div>
        <p className="t-small c2">{t('adminInvoices.subtitle')}</p>
      </div>
      <DateRangeFilter
        id="invoice-days"
        range={days}
        today={today}
        limits={INVOICE_LIMITS}
        onChange={(range) => goTo(range)}
      />
      <div className={styles.filters} role="group" aria-label={t('adminInvoices.kinds.label')}>
        {KINDS.map((k) => (
          <Chip key={k} pressed={kind === k} onClick={() => goTo(days, k)}>
            {t(`adminInvoices.kinds.${k}`)}
          </Chip>
        ))}
      </div>
      {content}
      {viewing && <InvoiceDialog id={viewing} onClose={() => setViewing(null)} />}
      {/* Which days: those shown, or a whole financial year (for the year's returns). */}
      {choosing && (
        <Dialog
          open
          onClose={() => setChoosing(false)}
          presentation="adaptive"
          title={t('adminInvoices.registerDialog.title')}
          description={t('adminInvoices.registerDialog.hint')}
        >
          <div className={styles.registerChoices}>
            <Button variant="secondary" iconStart="list" onClick={() => void register()}>
              {t('adminInvoices.registerDialog.shown', {
                from: clock.day(days.from),
                to: clock.day(days.to),
              })}
            </Button>
            {years.map((y) => (
              <Button
                key={y.key}
                variant="secondary"
                iconStart="list"
                onClick={() => void register(y.range, y.label)}
              >
                {t(`adminInvoices.registerDialog.${y.key}`, {
                  label: y.label,
                  from: clock.day(y.range.from),
                  to: clock.day(y.range.to),
                })}
              </Button>
            ))}
          </div>
        </Dialog>
      )}
    </div>
  );
}

/**
 * One invoice or credit note as issued, with Print (the original, or copy n once printed
 * before) and when it was printed. Printing opens the print dialog from the tap itself.
 */
function InvoiceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const detail = useInvoice(branch.id, id);
  const print = usePaymentPrint();
  const data = detail.data;
  return (
    <>
      <Dialog
        open
        onClose={onClose}
        presentation="adaptive"
        title={data ? t('adminInvoices.dialog.title', { number: data.number }) : ''}
        description={
          data
            ? data.printLog.length > 0
              ? t('adminInvoices.dialog.log', {
                  list: data.printLog.map((p) => `${clock.dateTime(p.at)} (${p.by})`).join(', '),
                })
              : t('adminInvoices.dialog.never')
            : undefined
        }
        footer={
          <div className={styles.actions}>
            <Button variant="secondary" onClick={onClose}>
              {t('adminInvoices.dialog.close')}
            </Button>
            <Button
              iconStart="receipt"
              disabled={!data}
              onClick={() => data && print.invoice(data)}
            >
              {data && data.prints > 0
                ? t('adminInvoices.dialog.printCopy', { n: data.prints })
                : t('adminInvoices.dialog.print')}
            </Button>
          </div>
        }
      >
        <div className={styles.preview}>
          {data ? (
            <InvoiceDoc doc={data.document} />
          ) : detail.isError ? (
            <p className={styles.empty}>{t('adminInvoices.dialog.failed')}</p>
          ) : (
            <Skeleton shape="block" height={320} />
          )}
        </div>
      </Dialog>
      {print.sheet}
    </>
  );
}
