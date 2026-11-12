'use client';

import { useState } from 'react';
import type { CashSession } from '@/api/contracts';
import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useCloseRegister } from '@/api/mutations';
import { Button, Dialog, Icon, Textarea } from '@/components/ui';
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
 * Closing the drawer, blind, in short steps: 1. count the cash (note by note, or a total); 2.
 * the card machine's and UPI app's totals (optional: Skip); then the check. A count that matches
 * closes the drawer at once ("Everything matched"); one that doesn't shows what should have been
 * there, by how much it's short or extra, and closes with what happened (or is counted again).
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
  // Counting first, then card and UPI (when the branch takes them), then the check.
  const [step, setStep] = useState<'count' | 'cards'>('count');
  const steps = ways.length > 0 ? 3 : 2;

  const submit = (withMethods = true) => {
    if (cash.amount === null) return;
    const methods = withMethods ? checked : [];
    close.mutate(
      {
        branchId: branch.id,
        body: {
          counted: cash.amount,
          ...(cash.counted ? { count: cash.counted } : {}),
          ...(methods.length > 0 ? { methods } : {}),
          ...(differs && note.trim() ? { note: note.trim() } : {}),
        },
      },
      {
        onSuccess: (closed) => {
          showToast(
            t(differs ? 'adminCash.close.done' : 'adminCash.close.doneMatch', {
              number: closed.number,
            }),
            { tone: 'success' },
          );
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
                setStep('count');
                cash.reset();
              }}
            >
              {t('adminCash.close.recount')}
            </Button>
            <Button
              iconStart="lock"
              disabled={!ready}
              loading={close.isPending}
              onClick={() => submit()}
            >
              {t('adminCash.close.confirm')}
            </Button>
          </div>
        ) : step === 'count' ? (
          <Button
            block
            iconEnd={ways.length > 0 ? 'arrow' : undefined}
            iconStart={ways.length > 0 ? undefined : 'check'}
            disabled={cash.amount === null}
            loading={close.isPending}
            onClick={() => (ways.length > 0 ? setStep('cards') : submit())}
          >
            {ways.length > 0 ? t('adminCash.close.next') : t('adminCash.close.check')}
          </Button>
        ) : (
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => submit(false)} disabled={close.isPending}>
              {t('adminCash.close.skip')}
            </Button>
            <Button iconStart="check" loading={close.isPending} onClick={() => submit()}>
              {t('adminCash.close.check')}
            </Button>
          </div>
        )
      }
    >
      <div className={styles.form}>
        <ol className={styles.steps} aria-hidden="true">
          {[
            t('adminCash.close.stepCount'),
            ...(ways.length > 0 ? [t('adminCash.close.stepCards')] : []),
            t('adminCash.close.stepCheck'),
          ].map((label, i) => {
            const at = differs ? steps - 1 : step === 'count' ? 0 : 1;
            return (
              <li
                key={label}
                className={cx(styles.stepDot, i < at && styles.stepDone, i === at && styles.stepOn)}
              >
                <span>{i < at ? '✓' : i + 1}</span>
                {label}
              </li>
            );
          })}
        </ol>
        {differs ? (
          <>
            <div
              className={cx(
                styles.result,
                styles[kind === 'match' ? differenceKind(off[0]?.difference ?? 0) : kind],
              )}
              role="status"
            >
              <p className={styles.resultTitle}>
                <Icon name="alert" size="sm" />
                {t('adminCash.close.resultTitle')}
              </p>
              <ul className={styles.resultLines}>
                {kind !== 'match' && (
                  <li>
                    {t(
                      kind === 'short'
                        ? 'adminCash.close.resultShort'
                        : 'adminCash.close.resultOver',
                      {
                        way: t('adminCash.close.cashRow'),
                        amount: money.format(Math.abs(differs.difference)),
                      },
                    )}
                  </li>
                )}
                {off.map((m) => (
                  <li key={m.method}>
                    {t(
                      m.difference < 0
                        ? 'adminCash.close.resultShort'
                        : 'adminCash.close.resultOver',
                      {
                        way: methodName(m.method),
                        amount: format(Math.abs(m.difference)),
                      },
                    )}
                  </li>
                ))}
              </ul>
            </div>
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
              hint={t('adminCash.close.whyHint')}
              rows={2}
              maxLength={300}
              placeholder={t('adminCash.close.whyPlaceholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </>
        ) : step === 'count' ? (
          <>
            <p className={styles.muted}>{t('adminCash.close.countBody')}</p>
            <CashAmountField id="cash-close" label={t('adminCash.close.counted')} cash={cash} />
          </>
        ) : (
          <section className={styles.block} aria-labelledby="cash-close-ways">
            <button type="button" className={styles.linkButton} onClick={() => setStep('count')}>
              <Icon name="back" size="xs" />
              {t('adminCash.close.back')}
            </button>
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
      </div>
    </Dialog>
  );
}
