import type { AddressLabel, DeliveryAddress } from '@/types/order';

/** Address labels, in the order they're offered. */
export const ADDRESS_LABELS: readonly AddressLabel[] = ['home', 'work', 'other'];

/** Longest free-text field on an address (the server's limit too). */
export const ADDRESS_FIELD_MAX = 160;

/** How many addresses a device remembers per branch. */
export const SAVED_ADDRESS_LIMIT = 3;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isOptionalString = (v: unknown) => v === undefined || typeof v === 'string';

/** Runtime guard for a delivery address (saved on the device or in the checkout). */
export const isDeliveryAddress = (v: unknown): v is DeliveryAddress =>
  isObject(v) &&
  typeof v.line === 'string' &&
  typeof v.area === 'string' &&
  isOptionalString(v.landmark) &&
  isOptionalString(v.instructions) &&
  typeof v.label === 'string' &&
  (ADDRESS_LABELS as readonly string[]).includes(v.label);

/** Content key (checkout › details.address.errors) of what's wrong with an address field. */
export type AddressError = 'lineRequired' | 'areaRequired';

/** Field errors of an address being entered; `areas` are the ones the branch delivers to. */
export function validateAddress(
  address: Pick<DeliveryAddress, 'line' | 'area'>,
  areas: readonly string[],
): { line?: AddressError; area?: AddressError } {
  return {
    ...(address.line.trim() === '' ? { line: 'lineRequired' as const } : {}),
    ...(areas.includes(address.area) ? {} : { area: 'areaRequired' as const }),
  };
}

/** The address as sent: trimmed, without empty optional fields. */
export function cleanAddress(address: DeliveryAddress): DeliveryAddress {
  const landmark = address.landmark?.trim();
  const instructions = address.instructions?.trim();
  return {
    line: address.line.trim(),
    area: address.area,
    label: address.label,
    ...(landmark ? { landmark } : {}),
    ...(instructions ? { instructions } : {}),
  };
}

/** Same place (ignoring the label and notes). */
export const sameAddress = (a: DeliveryAddress, b: DeliveryAddress) =>
  a.line.trim().toLowerCase() === b.line.trim().toLowerCase() && a.area === b.area;

/** Puts an address first in a list of saved ones, dropping an older copy and the oldest beyond the limit. */
export function rememberAddress(
  saved: readonly DeliveryAddress[],
  address: DeliveryAddress,
): DeliveryAddress[] {
  return [address, ...saved.filter((a) => !sameAddress(a, address))].slice(
    0,
    SAVED_ADDRESS_LIMIT,
  );
}

/** "Flat 3B, 12 Lake Road, Lazimpat". */
export const addressText = (address: Pick<DeliveryAddress, 'line' | 'area'>) =>
  `${address.line}, ${address.area}`;
