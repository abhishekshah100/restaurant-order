import type { BranchSales, SalesFigures, SalesReport } from '@/api/contracts';
import { changeOf, hourWindow, unlinkedRefunds } from './salesReport';
import type { Cell, XlsxSheet } from './xlsx';

/*
 * The sales report as an Excel workbook: what it covers, then one sheet per part of the page,
 * amounts as numbers (in the branch's currency) so they add up in Excel. The words come from the
 * page (content), so the file reads as the screen does.
 */

/** The words a workbook needs, from the page's content. */
export interface SalesExportWords {
  sheet: (key: SheetKey) => string;
  column: (key: ColumnKey) => string;
  figure: (key: FigureKey) => string;
  mode: (mode: string) => string;
  method: (method: string) => string;
  channel: (channel: 'online' | 'inPerson') => string;
  reason: (reason: string) => string;
  tax: (labelKey: string, rate: string) => string;
  money: (key: MoneyKey) => string;
  yes: string;
  no: string;
  removed: string;
}

export type SheetKey =
  | 'report'
  | 'summary'
  | 'days'
  | 'hours'
  | 'modes'
  | 'methods'
  | 'dishes'
  | 'categories'
  | 'money'
  | 'branches';

export type ColumnKey =
  | 'item'
  | 'value'
  | 'figure'
  | 'now'
  | 'before'
  | 'change'
  | 'day'
  | 'nepaliDay'
  | 'hour'
  | 'orders'
  | 'netSales'
  | 'billed'
  | 'share'
  | 'method'
  | 'channel'
  | 'payments'
  | 'amount'
  | 'refunds'
  | 'rank'
  | 'dish'
  | 'category'
  | 'veg'
  | 'sold'
  | 'sales'
  | 'dishes'
  | 'line'
  | 'branch'
  | 'currency'
  | 'averageBill'
  | 'bestSeller'
  | 'type';

export type FigureKey =
  keyof SalesFigures | 'branch' | 'period' | 'compared' | 'generated' | 'cancelled';

export type MoneyKey =
  | 'itemSales'
  | 'offers'
  | 'promoCodes'
  | 'staffDiscounts'
  | 'netSales'
  | 'serviceCharge'
  | 'deliveryFees'
  | 'roundOff'
  | 'other'
  | 'billed'
  | 'received'
  | 'refundFor'
  | 'waived'
  | 'netReceived'
  | 'refundsByDish'
  | 'unlinked';

/** "+12", "−3", "" (nothing before): a change as a number to sort and chart in Excel. */
const percentCell = (now: number, before: number): Cell => {
  const change = changeOf(now, before);
  return change.percent ?? '';
};

const FIGURES: readonly (keyof SalesFigures)[] = [
  'netSales',
  'orders',
  'averageBill',
  'discounts',
  'refunds',
  'itemSales',
  'serviceCharge',
  'tax',
  'billed',
];

const share = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

/** The workbook's sheets for a branch's report (and the branches side by side, when given). */
export function salesSheets(
  report: SalesReport,
  about: { branch: string; period: string; compared: string; generated: string; nepal: boolean },
  words: SalesExportWords,
  branches?: readonly BranchSales[],
): XlsxSheet[] {
  const { column: c, sheet } = words;
  const modesTotal = report.byMode.reduce((sum, m) => sum + m.netSales, 0);
  const received = report.byMethod.reduce((sum, m) => sum + m.amount, 0);
  const m = report.money;

  const sheets: XlsxSheet[] = [
    {
      name: sheet('report'),
      columns: [c('item'), c('value')],
      rows: [
        [words.figure('branch'), about.branch],
        [words.figure('period'), about.period],
        [words.figure('compared'), about.compared],
        [words.figure('generated'), about.generated],
      ],
    },
    {
      name: sheet('summary'),
      columns: [c('figure'), c('now'), c('before'), c('change')],
      rows: [
        ...FIGURES.map((key) => [
          words.figure(key),
          report.totals[key],
          report.before[key],
          percentCell(report.totals[key], report.before[key]),
        ]),
        [words.figure('cancelled'), report.cancelled.orders, '', ''],
      ],
    },
    {
      name: sheet('days'),
      columns: [c('day'), ...(about.nepal ? [c('nepaliDay')] : []), c('orders'), c('netSales')],
      rows: report.days.map((d) => [
        d.day,
        ...(about.nepal ? [d.bs ?? ''] : []),
        d.orders,
        d.netSales,
      ]),
    },
    {
      name: sheet('hours'),
      columns: [c('hour'), c('orders'), c('netSales')],
      rows: report.hours
        .filter((h) => h.orders > 0)
        .map((h) => [hourWindow(h.hour), h.orders, h.netSales]),
    },
    {
      name: sheet('modes'),
      columns: [c('type'), c('orders'), c('netSales'), c('billed'), c('share')],
      rows: report.byMode.map((mode) => [
        words.mode(mode.mode),
        mode.orders,
        mode.netSales,
        mode.billed,
        share(mode.netSales, modesTotal),
      ]),
    },
    {
      name: sheet('methods'),
      columns: [c('method'), c('channel'), c('payments'), c('amount'), c('refunds'), c('share')],
      rows: report.byMethod.map((method) => [
        words.method(method.method),
        words.channel(method.channel),
        method.count,
        method.amount,
        method.refunds,
        share(method.amount, received),
      ]),
    },
    {
      name: sheet('dishes'),
      columns: [c('rank'), c('dish'), c('category'), c('veg'), c('sold'), c('sales')],
      rows: report.dishes.map((d, i) => [
        i + 1,
        d.name,
        d.category ?? words.removed,
        d.veg ? words.yes : words.no,
        d.quantity,
        d.sales,
      ]),
    },
    {
      name: sheet('categories'),
      columns: [c('category'), c('sold'), c('dishes'), c('sales'), c('share')],
      rows: report.categories.map((cat) => [
        cat.name ?? words.removed,
        cat.quantity,
        cat.dishes,
        cat.sales,
        share(cat.sales, report.totals.itemSales),
      ]),
    },
    {
      name: sheet('money'),
      columns: [c('line'), c('amount')],
      rows: [
        [words.money('itemSales'), m.itemSales],
        [words.money('offers'), -m.offers],
        [words.money('promoCodes'), -m.promoCodes],
        [words.money('staffDiscounts'), -m.staffDiscounts],
        [words.money('netSales'), m.netSales],
        [words.money('serviceCharge'), m.serviceCharge],
        ...m.taxes.map((tax): Cell[] => [words.tax(tax.labelKey, tax.rate), tax.amount]),
        [words.money('deliveryFees'), m.deliveryFees],
        [words.money('roundOff'), m.roundOff],
        ...(m.other !== 0 ? [[words.money('other'), m.other]] : []),
        [words.money('billed'), m.billed],
        ['', ''],
        [words.money('received'), m.received],
        ...m.refundsByReason.map((r): Cell[] => [
          `${words.money('refundFor')} ${words.reason(r.reason)}`,
          -r.amount,
        ]),
        [words.money('netReceived'), m.netReceived],
        [words.money('waived'), m.waived],
        ['', ''],
        [words.money('refundsByDish'), ''],
        ...m.refundsByDish.map((r): Cell[] => [`${r.quantity}× ${r.name}`, r.amount]),
        [words.money('unlinked'), unlinkedRefunds(report.totals.refunds, m.refundsByDish)],
      ],
    },
  ];

  if (branches && branches.length > 0) {
    sheets.push({
      name: sheet('branches'),
      columns: [
        c('branch'),
        c('currency'),
        c('netSales'),
        c('before'),
        c('change'),
        c('orders'),
        c('averageBill'),
        c('bestSeller'),
      ],
      rows: branches.map((b) => [
        b.name,
        b.money.code,
        b.totals.netSales,
        b.before.netSales,
        percentCell(b.totals.netSales, b.before.netSales),
        b.totals.orders,
        b.totals.averageBill,
        b.topDish?.name ?? '',
      ]),
    });
  }
  return sheets;
}
