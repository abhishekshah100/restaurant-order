'use client';

import type { AuditEvent } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { settingsChanges, type SettingChange } from './settingsChanges';

export interface AuditText {
  /** What happened, in a sentence ("Refunded ₹100 on #BLR-001"). */
  title: string;
  /** The particulars ("Bill ₹1,200 → ₹1,080 · ₹100 refunded"), when there are any. */
  detail?: string;
  /** The reason in words ("Kitchen issue"), when one was given. */
  reason?: string;
  /** Settings: each field changed, before → after. */
  changes?: SettingChange[];
  /** The order whose bill the entry is about (View bill), when there's one. */
  order?: string;
}

/** "kitchenIssue" → "Kitchen issue": a recorded code in words. */
const words = (code: string) => {
  const spaced = code.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/**
 * Each audit entry in words: a sentence for what happened, from what the action recorded
 * (amounts in the branch's money), and a line of particulars. An action this screen doesn't
 * know yet reads as its code.
 */
export function useAuditText() {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  const { methodName } = usePaymentText();
  const settingsWords = {
    section: (key: string) => known('adminAudit.settings.sections', key),
    field: (key: string) => known('adminAudit.settings.fields', key),
    day: (key: string) => known('adminSettings.hours.days', key),
    method: methodName,
    money: (n: number) => money.format(n),
    minutes: (count: number) => t('adminAudit.settings.minutes', { count }),
    km: (count: number) => t('adminAudit.settings.km', { count }),
    on: t('adminAudit.settings.on'),
    off: t('adminAudit.settings.off'),
    empty: t('adminAudit.settings.empty'),
    closed: t('adminAudit.settings.closed'),
    added: t('adminAudit.settings.added'),
    removed: t('adminAudit.settings.removed'),
    changed: t('adminAudit.settings.changed'),
    oldPhoto: t('adminAudit.settings.oldPhoto'),
    newPhoto: t('adminAudit.settings.newPhoto'),
  };
  /** A word from a content group by key, or undefined when the group has none for it. */
  function known(group: string, key: string): string | undefined {
    const said: unknown = t.get(`${group}.${key}` as Parameters<typeof t.get>[0]);
    return typeof said === 'string' ? said : undefined;
  }
  return (event: AuditEvent): AuditText => {
    const text = describe(event);
    const orderId =
      event.target?.type === 'order'
        ? event.target.id
        : typeof event.details?.order === 'string'
          ? event.details.order
          : undefined;
    return orderId ? { ...text, order: orderId } : text;
  };

  function describe(event: AuditEvent): AuditText {
    const d = event.details ?? {};
    const num = (key: string) => (typeof d[key] === 'number' ? (d[key] as number) : undefined);
    const str = (key: string) => (typeof d[key] === 'string' ? (d[key] as string) : '');
    const cash = (key: string) => {
      const n = num(key);
      return n === undefined ? '–' : money.format(n);
    };
    const target = event.target?.id ?? '';
    const order = target;
    const join = (...parts: (string | false | undefined)[]) =>
      parts.filter((p): p is string => Boolean(p)).join(' · ') || undefined;
    /** "Bill ₹1,200 → ₹1,080", when the entry recorded both. */
    const bill =
      num('previousTotal') !== undefined && num('total') !== undefined
        ? t('adminAudit.details.bill', { before: cash('previousTotal'), after: cash('total') })
        : undefined;
    const refunded =
      (num('refunded') ?? 0) > 0
        ? t('adminAudit.details.refunded', { amount: cash('refunded') })
        : undefined;
    const reason = event.reason ? words(event.reason) : undefined;
    const say = (key: string, vars: Record<string, string | number> = {}) =>
      t(`adminAudit.actions.${key}` as Parameters<typeof t>[0], vars);

    switch (event.action) {
      case 'order.cancelled':
        return {
          title: say('order_cancelled', { order }),
          detail: join(t('adminAudit.details.total', { amount: cash('total') }), refunded),
          reason,
        };
      case 'order.roundCancelled':
      case 'order.roundChanged':
        return {
          title: say(event.action.replace('.', '_'), { round: num('round') ?? '', order }),
          detail: join(bill, refunded),
          reason,
        };
      case 'order.itemUnavailable':
        return {
          title: say('order_itemUnavailable', {
            quantity: num('quantity') ?? '',
            item: str('item'),
            order,
          }),
          detail: join(bill, refunded),
          reason,
        };
      case 'order.refunded':
        return {
          title: say('order_refunded', { amount: cash('amount'), order }),
          detail: join(str('method') && words(str('method')), str('note')),
          reason,
        };
      case 'order.refundReceived':
        return { title: say('order_refundReceived', { order }), detail: join(str('transaction')) };
      case 'order.discountGiven':
        return {
          title: say('order_discountGiven', { amount: cash('amount'), order }),
          detail: join(
            str('item') && t('adminAudit.details.on', { item: str('item') }),
            num('percent') !== undefined && `${num('percent')}%`,
            bill,
            str('note'),
          ),
          reason,
        };
      case 'order.discountRemoved':
        return {
          title: say('order_discountRemoved', { amount: cash('amount'), order }),
          detail: join(
            str('given') && t('adminAudit.details.givenBy', { name: str('given') }),
            bill,
          ),
          reason,
        };
      case 'bill.waived':
        return {
          title: say('bill_waived', { waived: cash('waived'), order }),
          detail: join(
            num('due') !== undefined && t('adminAudit.details.total', { amount: cash('due') }),
          ),
          reason,
        };
      case 'table.freed':
        return { title: say('table_freed', { table: target }) };
      case 'table.qrShown':
        return { title: say('table_qrShown', { table: target }) };
      case 'table.moved': {
        const why = event.reason && known('adminTables.detail.move.reasons', event.reason);
        return {
          title: say('table_moved', { table: target, to: num('to') ?? '' }),
          detail: join(
            str('note') && t('adminAudit.details.moveNote', { note: str('note') }),
            Array.isArray(d.orders) &&
              (d.orders as string[]).length > 0 &&
              t('adminAudit.details.movedOrders', {
                orders: (d.orders as string[]).map((o) => `#${o}`).join(', '),
              }),
          ),
          reason: why || reason,
        };
      }
      case 'invoice.issued':
        return {
          title: say('invoice_issued', { number: target, order: str('order') }),
          detail: join(t('adminAudit.details.total', { amount: cash('total') }), str('buyer')),
        };
      case 'invoice.creditNoteIssued':
        return {
          title: say('invoice_creditNoteIssued', { number: target, invoice: str('invoice') }),
          detail: join(t('adminAudit.details.total', { amount: cash('total') })),
          reason,
        };
      case 'invoice.printed':
        return {
          title:
            (num('copy') ?? 0) > 0
              ? say('invoice_printedCopy', { copy: num('copy') ?? 0, number: target })
              : say('invoice_printed', { number: target }),
          detail: join(str('channel') && words(str('channel'))),
        };
      case 'order.buyerSet':
        return {
          title: say('order_buyerSet', { name: str('name'), order }),
          detail: join(str('taxId')),
        };
      case 'order.buyerCleared':
        return { title: say('order_buyerCleared', { order }) };
      case 'cash.opened':
        return { title: say('cash_opened', { float: cash('float') }) };
      case 'cash.moved':
        return {
          title: say(str('kind') === 'out' ? 'cash_movedOut' : 'cash_movedIn', {
            amount: cash('amount'),
          }),
          detail: join(str('note')),
          reason,
        };
      case 'cash.closed':
        return {
          title: say('cash_closed'),
          detail: t('adminAudit.details.counted', {
            expected: cash('expected'),
            counted: cash('counted'),
            difference: cash('difference'),
          }),
          reason,
        };
      case 'cash.checked':
        return { title: say('cash_checked'), reason };
      case 'cash.signedOff':
        return { title: say('cash_signedOff', { day: target }), reason };
      case 'cash.limitChanged':
        return {
          title: say('cash_limitChanged', { before: cash('before'), after: cash('after') }),
        };
      case 'menu.priceChanged': {
        const priceOf = (side: unknown) =>
          side &&
          typeof side === 'object' &&
          typeof (side as { price?: unknown }).price === 'number'
            ? money.format((side as { price: number }).price)
            : '–';
        return {
          title: say('menu_priceChanged', {
            dish: str('dish'),
            before: priceOf(d.before),
            after: priceOf(d.after),
          }),
        };
      }
      case 'menu.availabilityChanged': {
        const stateOf = (side: unknown) => {
          const v = (side ?? {}) as {
            availability?: { status?: string };
            sizesOff?: string[];
          };
          const status = v.availability?.status;
          const known = (['available', 'sold-out', 'unavailable-today'] as const).find(
            (k) => k === status,
          );
          const words2 = known ? t(`adminAudit.details.availability.${known}`) : (status ?? '');
          return v.sizesOff && v.sizesOff.length > 0
            ? `${words2} (${t('adminAudit.details.sizesOff', { sizes: v.sizesOff.join(', ') })})`
            : words2;
        };
        return {
          title: say('menu_availabilityChanged', {
            dish: str('dish'),
            before: stateOf(d.before),
            after: stateOf(d.after),
          }),
        };
      }
      case 'menu.dishRemoved':
        return { title: say('menu_dishRemoved', { dish: str('dish') }) };
      case 'settings.changed': {
        // Each field that changed, before → after, in words (what every bill prints or charges).
        const sections = Array.isArray(d.sections) ? (d.sections as string[]) : [];
        const changes = settingsChanges(
          (d.before ?? {}) as Record<string, unknown>,
          (d.after ?? {}) as Record<string, unknown>,
          settingsWords,
        );
        return {
          title: say('settings_changed', {
            sections: sections.map((s) => settingsWords.section(s) ?? words(s)).join(', '),
          }),
          ...(changes.length > 0 ? { changes } : {}),
        };
      }
      case 'staff.added':
      case 'staff.removed':
      case 'staff.restored':
        return {
          title: say(event.action.replace('.', '_'), { name: str('name'), role: str('role') }),
          reason,
        };
      case 'staff.changed':
        return {
          title: say('staff_changed', {
            name: str('name'),
            changes: Object.keys(d)
              .filter((k) => k !== 'name')
              .map(words)
              .join(', '),
          }),
          reason,
        };
      case 'staff.passwordReset':
        return { title: say('staff_passwordReset', { name: str('name') }) };
      case 'role.created':
      case 'role.removed':
        return { title: say(event.action.replace('.', '_'), { name: str('name') }) };
      case 'role.changed': {
        const list = (key: string) =>
          Array.isArray(d[key]) && (d[key] as string[]).length > 0
            ? (d[key] as string[]).join(', ')
            : t('adminAudit.details.none');
        const limit = d.discountLimit as { before?: number; after?: number } | undefined;
        return {
          title: say('role_changed', { name: str('name') }),
          detail: join(
            t('adminAudit.details.permissions', { added: list('added'), removed: list('removed') }),
            limit &&
              t('adminAudit.details.limit', { before: limit.before ?? 0, after: limit.after ?? 0 }),
          ),
        };
      }
      case 'session.signedIn':
      case 'session.signedOut':
        return { title: say(event.action.replace('.', '_')) };
      default:
        return { title: words(String(event.action)), reason };
    }
  }
}
