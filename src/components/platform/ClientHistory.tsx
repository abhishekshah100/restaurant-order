'use client';

import type {
  ClientPaymentMethod,
  PackagePlan,
  FeatureInfo,
  PlanHistoryEntry,
} from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { rupees, SUSPEND_NOTICES } from '@/lib/platform';
import styles from './Platform.module.css';

type T = ReturnType<typeof useContent<'common'>>;

/** The server's field names (dotted) and their words. */
const FIELDS = {
  plan: 'plan',
  billingCycle: 'billingCycle',
  'limits.staff': 'limitsStaff',
  'limits.branches': 'limitsBranches',
  'limits.floors': 'limitsFloors',
  'limits.tables': 'limitsTables',
  'limits.dishes': 'limitsDishes',
  'limits.reportDays': 'limitsReportDays',
  features: 'features',
  'features.inventory': 'featuresInventory',
  trialEndsAt: 'trialEndsAt',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  graceDays: 'graceDays',
  price: 'price',
  priceNote: 'priceNote',
  'contact.name': 'contactName',
  'contact.phone': 'contactPhone',
  'contact.email': 'contactEmail',
  'contact.taxNumber': 'contactTaxNumber',
  notes: 'notes',
  'suspension.startsAt': 'suspensionStartsAt',
  'suspension.finishHours': 'suspensionFinishHours',
  'suspension.notice': 'suspensionNotice',
  nextPlan: 'nextPlan',
  nextPlanAt: 'nextPlanAt',
} as const;

const ACTIONS = {
  'plan.changed': 'changed',
  'plan.suspended': 'suspended',
  'plan.resumed': 'resumed',
  'plan.suspensionPlanned': 'suspensionPlanned',
  'plan.suspensionCancelled': 'suspensionCancelled',
  'plan.changePlanned': 'changePlanned',
  'plan.changeCancelled': 'changeCancelled',
  'plan.changeApplied': 'changeApplied',
  'plan.keepChosen': 'keepChosen',
  'plan.paymentRecorded': 'paymentRecorded',
  'plan.paymentRemoved': 'paymentRemoved',
  'plan.reminded': 'reminded',
  'plan.wentLive': 'wentLive',
  'plan.clientCreated': 'clientCreated',
  'plan.addonAdded': 'addonAdded',
  'plan.addonRemoved': 'addonRemoved',
  'plan.menuLoaded': 'menuLoaded',
} as const;

const METHODS: readonly string[] = ['esewa', 'khalti', 'fonepay', 'bank', 'cash', 'other'];

const DATE_FIELDS = new Set(['trialEndsAt', 'startsAt', 'endsAt', 'nextPlanAt']);

/** A history value in words: dates as dates, lists as names, null as "none" / "unlimited". */
function valueOf(t: T, field: string, value: unknown, packages: PackagePlan[]): string {
  if (value === null || value === undefined || value === '') {
    return field.startsWith('limits.')
      ? t('platform.history.unlimited')
      : t('platform.history.none');
  }
  if (typeof value === 'boolean')
    return value ? t('platform.history.on') : t('platform.history.off');
  if (DATE_FIELDS.has(field) && typeof value === 'string') {
    return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
  }
  if (field === 'suspension.startsAt' && typeof value === 'string') {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  if (field === 'suspension.notice' && typeof value === 'string') {
    const notice = SUSPEND_NOTICES.find((n) => n === value);
    return notice ? t(`platform.suspend.notices.${notice}`) : value;
  }
  if ((field === 'plan' || field === 'nextPlan') && typeof value === 'string') {
    return packages.find((p) => p.code === value)?.name ?? value;
  }
  if (field === 'billingCycle' && (value === 'yearly' || value === 'halfYearly')) {
    return t(`platform.term.cycles.${value}`);
  }
  return String(value as string | number);
}

/** Feature keys as the catalog names them (one it no longer has: its key). */
const featureNames = (catalog: readonly FeatureInfo[], list: unknown) =>
  Array.isArray(list)
    ? list.map((f) => String(f)).map((f) => catalog.find((c) => c.key === f)?.name ?? f)
    : [];

/** One change as a line: "Staff logins: 5 → 8", "Features: + Inventory", "Notes edited". */
function lines(
  t: T,
  change: PlanHistoryEntry['changes'][number],
  packages: PackagePlan[],
  catalog: readonly FeatureInfo[],
): string[] {
  const key = FIELDS[change.field as keyof typeof FIELDS] as
    (typeof FIELDS)[keyof typeof FIELDS] | undefined;
  const field = key ? t(`platform.history.fields.${key}`) : change.field;
  if (change.field === 'notes') return [t('platform.history.edited', { field })];
  if (change.field === 'features') {
    const from = featureNames(catalog, change.from);
    const to = featureNames(catalog, change.to);
    const added = to.filter((f) => !from.includes(f));
    const removed = from.filter((f) => !to.includes(f));
    return [
      ...(added.length ? [t('platform.history.added', { field, list: added.join(', ') })] : []),
      ...(removed.length
        ? [t('platform.history.removedList', { field, list: removed.join(', ') })]
        : []),
    ];
  }
  return [
    t('platform.history.change', {
      field,
      from: valueOf(t, change.field, change.from, packages),
      to: valueOf(t, change.field, change.to, packages),
    }),
  ];
}

/** A client's changes, newest first: what, who and when, and the reason for a suspension. */
export function ClientHistory({
  history,
  packages,
  catalog,
}: {
  history: PlanHistoryEntry[];
  packages: PackagePlan[];
  catalog: readonly FeatureInfo[];
}) {
  const t = useContent('common');
  if (!history.length) return <p className={styles.muted}>{t('platform.history.empty')}</p>;
  return (
    <ol className={styles.history}>
      {history.map((entry, index) => {
        const action = ACTIONS[entry.action as keyof typeof ACTIONS] ?? 'changed';
        return (
          <li key={`${entry.at}-${String(index)}`} className={styles.entry}>
            <span className={styles.entryHead}>
              {t(`platform.history.actions.${action}`)}
              {entry.reason ? `: ${entry.reason}` : ''}
            </span>
            <span className={styles.entryMeta}>
              {t('platform.history.meta', {
                by: entry.by,
                when: new Date(entry.at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </span>
            {entry.payment && (
              <span className={styles.entryMeta}>
                {t('platform.payments.line', {
                  amount: rupees(entry.payment.amount),
                  method: METHODS.includes(entry.payment.method)
                    ? t(`platform.payments.methods.${entry.payment.method as ClientPaymentMethod}`)
                    : entry.payment.method,
                })}
              </span>
            )}
            {entry.changes.length > 0 && (
              <ul className={styles.changes}>
                {entry.changes
                  .flatMap((c) => lines(t, c, packages, catalog))
                  .map((line) => (
                    <li key={line}>{line}</li>
                  ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
