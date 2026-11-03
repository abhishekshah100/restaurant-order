'use client';

import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { rowAmount, takesProof } from '@/lib/paymentParts';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import type { CollectChoice } from './CollectFields';
import { AmountInput } from './PaymentFields';
import { ProofPicker } from './ProofPicker';
import { methodIcon, usePaymentText } from './usePaymentText';
import styles from './PaymentDialogs.module.css';

/**
 * A split payment (part cash, part UPI or card): a row for each payment (how, and how much), the
 * last taking the remaining balance so they always add up to the bill, and the sum under them;
 * payments other than cash take proof photos. Another payment can be added (up to MAX_PARTS);
 * taking all but one off goes back to a single payment.
 */
export function PaymentPartsFields({ choice }: { choice: CollectChoice }) {
  const t = useContent('common');
  const { region } = useAdminWorkspace();
  const { amount: format, methodName } = usePaymentText();
  const rows = choice.rows ?? [];
  const covered = choice.rest <= 0;
  // "Cash ₹500 + Card ₹128": what each payment comes to, for the sum under them.
  const sum = rows
    .map((r) => {
      const value = rowAmount(r.amount);
      return value === null ? null : `${methodName(r.method)} ${format(value)}`;
    })
    .filter(Boolean)
    .join(' + ');

  return (
    <section className={styles.block} aria-labelledby="collect-parts-title">
      <h3 id="collect-parts-title" className={styles.blockTitle}>
        {t('adminPayments.parts.title')}
      </h3>
      <ol className={styles.parts}>
        {rows.map((row, index) => {
          const isRest = index === rows.length - 1;
          const id = `collect-part-${row.id}`;
          return (
            <li key={row.id} className={styles.part}>
              <div className={styles.partHead}>
                <span className={styles.partTitle}>
                  {t('adminPayments.parts.way', { n: index + 1 })}
                  {isRest && (
                    <span className={styles.partBadge}>{t('adminPayments.parts.restBadge')}</span>
                  )}
                </span>
                <button
                  type="button"
                  className={styles.partRemove}
                  aria-label={t('adminPayments.parts.remove', { n: index + 1 })}
                  onClick={() => choice.parts.remove(row.id)}
                >
                  <Icon name="x" size="xs" />
                </button>
              </div>
              <div
                className={styles.quick}
                role="radiogroup"
                aria-label={t('adminPayments.parts.method', { n: index + 1 })}
              >
                {choice.methods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={row.method === m}
                    className={styles.quickButton}
                    onClick={() => choice.parts.setMethod(row.id, m)}
                  >
                    <Icon name={methodIcon(m)} size="xs" />
                    {methodName(m)}
                  </button>
                ))}
              </div>
              {isRest ? (
                <p className={styles.partRest} aria-live="polite">
                  <span>{t('adminPayments.parts.amount', { method: methodName(row.method) })}</span>
                  <strong>{covered ? format(0) : format(choice.rest)}</strong>
                </p>
              ) : (
                <AmountInput
                  id={`${id}-amount`}
                  label={t('adminPayments.parts.amount', { method: methodName(row.method) })}
                  symbol={region.currency.symbol}
                  value={row.amount}
                  onChange={(value) => choice.parts.setAmount(row.id, value)}
                  compact
                />
              )}
              {takesProof(row.method) && (
                <ProofPicker
                  id={`${id}-proofs`}
                  photos={choice.proofs.photosOf(row.id)}
                  onAdd={(files) => choice.proofs.add(row.id, files)}
                  onRemove={(photo) => choice.proofs.remove(row.id, photo)}
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className={cx(styles.partsSum, choice.ready && styles.partsSumOk)} aria-live="polite">
        <span>{sum}</span>
        <strong>
          {choice.ready && <Icon name="check" size="xs" />}
          {t('adminPayments.parts.total', { amount: format(choice.toCollect) })}
        </strong>
      </p>
      {covered && (
        <p className={styles.partsError} role="alert">
          {t('adminPayments.parts.tooMuch', { amount: format(choice.toCollect) })}
        </p>
      )}
      {choice.canAddPart && !covered && (
        <button type="button" className={styles.leaveOpen} onClick={choice.parts.add}>
          <Icon name="plus" size="xs" />
          {t('adminPayments.parts.add')}
        </button>
      )}
    </section>
  );
}
