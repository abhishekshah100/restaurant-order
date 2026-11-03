'use client';

import { useContent, usePaymentProof } from '@/api/hooks';
import { Icon, Spinner } from '@/components/ui';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './ProofPicker.module.css';

/** One proof photo, read with the admin's token; a tap opens it full size in a new tab. */
function ProofThumb({ proofKey, n }: { proofKey: string; n: number }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { url, failed } = usePaymentProof(branch.id, proofKey);
  const label = t('adminPayments.proofs.photo', { n });
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

/** The proof photos staff took with a payment (a UPI screen, a card slip). */
export function ProofThumbs({ proofs }: { proofs: readonly string[] }) {
  const t = useContent('common');
  return (
    <ul
      className={styles.thumbs}
      aria-label={t('adminPayments.proofs.view', { count: proofs.length })}
    >
      {proofs.map((key, index) => (
        <li key={key}>
          <ProofThumb proofKey={key} n={index + 1} />
        </li>
      ))}
    </ul>
  );
}
