'use client';

import { useContent, usePaymentProof } from '@/api/hooks';
import { Icon, Spinner } from '@/components/ui';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './ProofPicker.module.css';

/** One proof photo, read with the admin's token; a tap opens it full size in a new tab. */
function ProofThumb({
  proofKey,
  n,
  source,
}: {
  proofKey: string;
  n: number;
  source: 'payments' | 'inventory';
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { url, failed, removed } = usePaymentProof(branch.id, proofKey, source);
  const label = t('adminPayments.proofs.photo', { n });
  if (removed) {
    return (
      <span className={styles.thumb} title={t('adminPayments.proofs.removed')}>
        <span className={styles.state}>
          <Icon name="history" size="xs" label={t('adminPayments.proofs.removed')} />
        </span>
      </span>
    );
  }
  if (failed) {
    return (
      <span className={styles.thumb} title={t('adminPayments.proofs.loadFailed')}>
        <span className={styles.state}>
          <Icon name="alert" size="xs" label={t('adminPayments.proofs.loadFailed')} />
        </span>
      </span>
    );
  }
  if (!url) {
    return (
      <span className={styles.thumb} aria-busy="true">
        <span className={styles.state}>
          <Spinner />
        </span>
      </span>
    );
  }
  return (
    <a className={styles.thumb} href={url} target="_blank" rel="noopener" aria-label={label}>
      {/* A private photo read with the admin's token (an object URL), not a page image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" />
    </a>
  );
}

/**
 * The proof photos staff took with a payment (a UPI screen, a card slip), or with wastage
 * (`source: 'inventory'`).
 */
export function ProofThumbs({
  proofs,
  source = 'payments',
}: {
  proofs: readonly string[];
  source?: 'payments' | 'inventory';
}) {
  const t = useContent('common');
  return (
    <ul
      className={styles.thumbs}
      aria-label={t('adminPayments.proofs.view', { count: proofs.length })}
    >
      {proofs.map((key, index) => (
        <li key={key}>
          <ProofThumb proofKey={key} n={index + 1} source={source} />
        </li>
      ))}
    </ul>
  );
}
