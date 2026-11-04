'use client';

import { useState } from 'react';
import type { CashSession } from '@/api/contracts';
import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useCloseRegister } from '@/api/mutations';
import { Button, Dialog, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { differenceKind } from '@/lib/cashRegister';
import { cx } from '@/lib/cx';
import type { Price } from '@/types/menu';
import { AmountInput, parseAmount } from '../payments/PaymentFields';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CashAmountField, useCashAmount } from './CashAmountField';
import styles from './CashRegister.module.css';

/**
 * Closing the drawer, blind: staff count first (a total, or note by note), and may enter the
 * card machine's and the UPI app's totals; only then do they see what was expected. Counts that
 * match close it; any that differ show by how much and close with a reason (or are counted
 * again).
 */
export function CloseRegisterDialog({
  session,
  onClose,
}: {
  session: CashSession;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, money, region } = useAdminWorkspace();
  const { amount: format, methodName } = usePaymentText();
  // The other ways staff take in person, each checked against its own total (optional).
  const ways = region.payments.atTable.filter((m) => m !== 'cash');
  const [totals, setTotals] = useState<Readonly<Record<string, string>>>({});
  const checked = ways.flatMap((method) => {
    const counted = parseAmount(totals[method] ?? '');
    return counted === null ? [] : [{ method, counted }];
  });
  const { showToast } = useToast();
  const close = useCloseRegister();
  const cash = useCashAmount();
  // The server's answer to a count that differs: what was expected, and by how much.
  const [differs, setDiffers] = useState<{
    expected: Price;
    difference: Price;
    methods: { method: string; expected: Price; difference: Price }[];
  } | null>(null);
  const [note, setNote] = useState('');

  const submit = () => {
    if (cash.amount === null) return;
    close.mutate(
      {
        branchId: branch.id,
        body: {
          counted: cash.amount,
          ...(cash.counted ? { count: cash.counted } : {}),
          ...(checked.length > 0 ? { methods: checked } : {}),
          ...(differs && note.trim() ? { note: note.trim() } : {}),
        },
      },
      {
        onSuccess: (closed) => {
          showToast(t('adminCash.close.done', { number: closed.number }), { tone: 'success' });
          onClose();
        },
        onError: (error) => {
          if (isApiError(error, 'count_differs')) {
            setDiffers({
              expected: error.body?.expected ?? 0,
              difference: error.body?.difference ?? 0,
              methods: error.body?.methods ?? [],
            });
            return;
          }
          showToast(
            isApiError(error, 'register_closed')
              ? t('adminCash.errors.closed')
              : t('adminCash.errors.failed'),
            { tone: 'error' },
          );
        },
      },
    );
  };

  const kind = differs ? differenceKind(differs.difference) : 'match';
  // How each way came out, for the verdict: the cash first, then any way that's off.
  const off = differs ? differs.methods.filter((m) => m.difference !== 0) : [];
  const ready = cash.amount !== null && (!differs || note.trim() !== '');

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminCash.close.title', { number: session.number })}
      footer={
        differs ? (
          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => {
                setDiffers(null);
                setNote('');
                cash.reset();
              }}
            >
              {t('adminCash.close.recount')}
            </Button>
            <Button iconStart="lock" disabled={!ready} loading={close.isPending} onClick={submit}>
              {t('adminCash.close.confirm')}
            </Button>
          </div>
        ) : (
          <Button
            block
            iconStart="check"
            disabled={cash.amount === null}
            loading={close.isPending}
            onClick={submit}
          >
            {t('adminCash.close.check')}
          </Button>
        )
      }
    >
      <div className={styles.form}>
        {differs ? (
          <>
            <p
              className={cx(
                styles.verdict,
                styles[kind === 'match' ? differenceKind(off[0]?.difference ?? 0) : kind],
              )}
              role="status"
            >
              {[
                ...(kind === 'match'
                  ? []
                  : [
                      `${t('adminCash.close.cashRow')}: ${
                        kind === 'short'
                          ? t('adminCash.close.short', {
                              amount: money.format(-differs.difference),
                            })
                          : t('adminCash.close.over', { amount: money.format(differs.difference) })
                      }`,
                    ]),
                ...off.map(
                  (m) =>
                    `${methodName(m.method)}: ${
                      m.difference < 0
                        ? t('adminCash.close.short', { amount: format(-m.difference) })
                        : t('adminCash.close.over', { amount: format(m.difference) })
                    }`,
                ),
              ].join(' · ')}
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('adminCash.day.way')}</th>
                  <th scope="col">{t('adminCash.close.expected')}</th>
                  <th scope="col">{t('adminCash.close.countedRow')}</th>
                  <th scope="col">{t('adminCash.close.difference')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{t('adminCash.close.cashRow')}</th>
                  <td>{money.format(differs.expected)}</td>
                  <td>{money.format(cash.amount ?? 0)}</td>
                  <td className={styles[differenceKind(differs.difference)]}>
                    {money.format(differs.difference)}
                  </td>
                </tr>
                {differs.methods.map((m) => (
                  <tr key={m.method}>
                    <th scope="row">{methodName(m.method)}</th>
                    <td>{format(m.expected)}</td>
                    <td>{format(m.expected + m.difference)}</td>
                    <td className={styles[differenceKind(m.difference)]}>{format(m.difference)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Textarea
              id="cash-close-why"
              label={t('adminCash.close.why')}
              rows={2}
              maxLength={300}
              placeholder={t('adminCash.close.whyPlaceholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </>
        ) : (
          <>
            <p className={styles.muted}>{t('adminCash.close.countBody')}</p>
            <CashAmountField id="cash-close" label={t('adminCash.close.counted')} cash={cash} />
            {ways.length > 0 && (
              <section className={styles.block} aria-labelledby="cash-close-ways">
                <h3 id="cash-close-ways" className={styles.blockTitle}>
                  {t('adminCash.close.methodsTitle')}
                </h3>
                <p className={styles.muted}>{t('adminCash.close.methodsBody')}</p>
                {ways.map((method) => (
                  <AmountInput
                    key={method}
                    id={`cash-close-${method}`}
                    label={t('adminCash.close.methodTotal', { method: methodName(method) })}
                    symbol={region.currency.symbol}
                    value={totals[method] ?? ''}
                    onChange={(value) => setTotals({ ...totals, [method]: value })}
                    compact
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
