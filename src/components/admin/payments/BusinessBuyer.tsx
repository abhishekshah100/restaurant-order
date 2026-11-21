'use client';

import { useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useOrderBuyer } from '@/api/mutations';
import { Button, Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cleanTaxId, taxIdOf } from '@/lib/branchSettings';
import { cx } from '@/lib/cx';
import type { Order } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import dialog from './PaymentDialogs.module.css';
import styles from './CollectExtras.module.css';

/**
 * A business customer's details for the tax invoice (their registered name, GSTIN or PAN and
 * address), set on the orders being paid before they're paid: the invoice keeps them. Folded
 * into a link; saved, one line with Edit and Remove; open, the dialog's dashed card with a
 * Cancel. The server's only (the mock issues no invoices).
 */
/** Whether a business customer's details can still go on these orders (no invoice yet). */
export const canAddBuyer = (orders: readonly Order[]) =>
  isBackendEnabled() && orders.length > 0 && !orders.some((o) => o.invoice);

export function BusinessBuyer({
  orders,
  open,
  onOpenChange,
}: {
  orders: Order[];
  /** The form is open (opened from the bill's options, or Edit). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!canAddBuyer(orders)) return null;
  return (
    <BuyerForm
      key={orders.map((o) => o.id).join()}
      orders={orders}
      open={open}
      setOpen={onOpenChange}
    />
  );
}

function BuyerForm({
  orders,
  open,
  setOpen,
}: {
  orders: Order[];
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useContent('common');
  const { branch, region } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useOrderBuyer();
  const current = orders[0]?.buyer;
  const [name, setName] = useState(current?.name ?? '');
  const [taxId, setTaxId] = useState(current?.taxId ?? '');
  const [address, setAddress] = useState(current?.address ?? '');
  const [tried, setTried] = useState(false);

  const taxIdLabel = t(`adminPayments.receipt.taxIdLabels.${region.tax.taxIdKey}`);
  const rule = taxIdOf(region.country);
  const nameError = !name.trim() ? t('adminPayments.business.errors.name') : undefined;
  const taxIdError =
    taxId && !rule.pattern.test(cleanTaxId(taxId))
      ? t('adminPayments.business.errors.taxId')
      : undefined;

  /** Back to what's saved (or nothing), folded away. */
  const cancel = () => {
    setName(current?.name ?? '');
    setTaxId(current?.taxId ?? '');
    setAddress(current?.address ?? '');
    setTried(false);
    setOpen(false);
  };

  const send = async (buyer: { name: string; taxId?: string; address?: string } | null) => {
    try {
      for (const order of orders) {
        await save.mutateAsync({ branchId: branch.id, orderId: order.id, buyer });
      }
      showToast(t(buyer ? 'adminPayments.business.saved' : 'adminPayments.business.removed'), {
        tone: 'success',
      });
      if (!buyer) {
        setName('');
        setTaxId('');
        setAddress('');
      }
      setTried(false);
      setOpen(false);
    } catch (error) {
      showToast(
        isApiError(error, 'invoice_issued')
          ? t('adminPayments.business.errors.issued')
          : t('adminPayments.business.errors.failed'),
        { tone: 'error' },
      );
    }
  };

  if (!open) {
    if (!current) return null;
    return (
      <div className={styles.givenRow}>
        <Icon name="receipt" size="xs" className={styles.givenIcon} />
        <span className={styles.givenText}>
          <span className={styles.givenLabel}>
            {t('adminPayments.business.on', { name: current.name })}
          </span>
          <span className={styles.givenMeta}>
            {[current.taxId && `${taxIdLabel} ${current.taxId}`, current.address]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className={styles.links}>
          <button type="button" className={styles.takeOff} onClick={() => setOpen(true)}>
            {t('adminPayments.business.edit')}
          </button>
          <button
            type="button"
            className={styles.takeOff}
            disabled={save.isPending}
            onClick={() => void send(null)}
          >
            {t('adminPayments.business.remove')}
          </button>
        </span>
      </div>
    );
  }

  return (
    <section className={dialog.leaveCard} aria-labelledby="buyer-title">
      <div className={dialog.leaveHead}>
        <h3 id="buyer-title" className={dialog.leaveTitle}>
          {t('adminPayments.business.title')}
        </h3>
        <button type="button" className={dialog.leaveCancel} onClick={cancel}>
          {t('adminPayments.business.cancel')}
        </button>
      </div>
      <p className={styles.hint}>{t('adminPayments.business.hint')}</p>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('adminPayments.business.name')}</span>
        <input
          className={cx(styles.noteInput, tried && nameError && styles.invalidInput)}
          value={name}
          maxLength={120}
          autoComplete="organization"
          aria-invalid={tried && nameError ? true : undefined}
          onChange={(event) => setName(event.target.value)}
        />
        {tried && nameError && <span className={styles.fieldError}>{nameError}</span>}
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          {taxIdLabel}{' '}
          <span className={styles.optional}>{t('adminPayments.business.optional')}</span>
        </span>
        <input
          className={cx(styles.noteInput, tried && taxIdError && styles.invalidInput)}
          value={taxId}
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={tried && taxIdError ? true : undefined}
          onChange={(event) => setTaxId(event.target.value.toUpperCase())}
        />
        {tried && taxIdError && <span className={styles.fieldError}>{taxIdError}</span>}
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          {t('adminPayments.business.address')}{' '}
          <span className={styles.optional}>{t('adminPayments.business.optional')}</span>
        </span>
        <input
          className={styles.noteInput}
          value={address}
          maxLength={300}
          autoComplete="street-address"
          onChange={(event) => setAddress(event.target.value)}
        />
      </label>

      <Button
        block
        iconStart="check"
        loading={save.isPending}
        onClick={() => {
          setTried(true);
          if (nameError || taxIdError) return;
          void send({
            name: name.trim(),
            ...(taxId ? { taxId: cleanTaxId(taxId) } : {}),
            ...(address.trim() ? { address: address.trim() } : {}),
          });
        }}
      >
        {t('adminPayments.business.save')}
      </Button>
    </section>
  );
}
