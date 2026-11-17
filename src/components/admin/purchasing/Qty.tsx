'use client';

import { IconButton } from '@/components/ui';
import { parseQuantity, quantityText } from '@/lib/inventory';
import styles from './Purchasing.module.css';

/** − [2] +: a number of packs, typed or stepped (decimals allowed: 2.5 kg). */
export function Qty({
  id,
  value,
  onChange,
  label,
  less,
  more,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  label: string;
  less: string;
  more: string;
}) {
  const n = parseQuantity(value) ?? 0;
  const set = (next: number) =>
    onChange(next > 0 ? quantityText(Math.round(next * 1000) / 1000) : '');
  return (
    <span className={styles.qty}>
      <IconButton
        icon="minus"
        size="sm"
        label={less}
        disabled={n <= 0}
        onClick={() => set(Math.ceil(n) - 1)}
      />
      <input
        id={id}
        className={styles.qtyInput}
        inputMode="decimal"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <IconButton icon="plus" size="sm" label={more} onClick={() => set(Math.floor(n) + 1)} />
    </span>
  );
}
