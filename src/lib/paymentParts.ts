import { MAX_PARTS, type PaymentPart } from '@/api/contracts';
import type { AtTableMethodKey } from '@/types/branch';
import type { Price } from '@/types/menu';

/*
 * A bill paid in more than one way (₹1,500 in cash, then ₹1,526 by UPI): the rows staff fill in
 * (the last taking the rest), and the request.
 */

export interface PartRow {
  id: string;
  method: AtTableMethodKey;
  /** As typed: "1500". */
  amount: string;
}

/** Proof photos are for payments that aren't cash (a UPI screen, a card slip). */
export const takesProof = (method: AtTableMethodKey) => method !== 'cash';

/** A typed amount, or null when it isn't one (major units, 2 decimals at most, more than 0). */
export function rowAmount(text: string): Price | null {
  const trimmed = text.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/**
 * What's left of `toCollect` for the last row once the others are paid (0 or less: they cover
 * it), in the currency's smallest unit so ₹0.10 + ₹0.20 is ₹0.30 exactly.
 */
export function restOf(rows: readonly PartRow[], toCollect: Price, minorUnit: number): Price {
  const typed = rows
    .slice(0, -1)
    .reduce((sum, r) => sum + Math.round((rowAmount(r.amount) ?? 0) * minorUnit), 0);
  return (Math.round(toCollect * minorUnit) - typed) / minorUnit;
}

/**
 * The next payment to add: UPI when the branch takes it and it isn't used yet (the usual other
 * half of a bill paid partly in cash), else one not used yet (the branch's order), else the
 * first.
 */
export function nextMethod(
  methods: readonly AtTableMethodKey[],
  rows: readonly PartRow[],
): AtTableMethodKey {
  const used = new Set(rows.map((r) => r.method));
  const fresh = methods.filter((m) => !used.has(m));
  return fresh.find((m) => m === 'upi') ?? fresh[0] ?? (methods[0] as AtTableMethodKey);
}

export const canAddPart = (rows: readonly PartRow[]) => rows.length < MAX_PARTS;

/** The request's parts: each row's way and amount, with its photos' keys (not for cash). */
export function partsRequest(
  rows: readonly PartRow[],
  proofsOf: (rowId: string) => readonly string[],
): PaymentPart[] {
  return rows.map((row) => {
    const proofs = takesProof(row.method) ? proofsOf(row.id) : [];
    return {
      method: row.method,
      amount: rowAmount(row.amount) ?? 0,
      ...(proofs.length > 0 ? { proofs: [...proofs] } : {}),
    };
  });
}
