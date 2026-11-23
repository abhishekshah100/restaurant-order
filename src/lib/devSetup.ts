import type { SetupImportResponse } from '@/api/contracts';

/*
 * The developer setup page's helpers: its key kept for this tab only (sessionStorage: gone when
 * the tab closes), and the links an import gives.
 */

const KEY_STORAGE = 'olive.devSetupKey';

/** The key saved in this tab, if any (none where storage is blocked). */
export function savedDevKey(): string | null {
  try {
    return window.sessionStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

/** Keeps the key for this tab, or forgets it (`null`). */
export function saveDevKey(key: string | null): void {
  try {
    if (key) window.sessionStorage.setItem(KEY_STORAGE, key);
    else window.sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    // Blocked storage: the key lasts until the page is reloaded.
  }
}

/** The pasted text as JSON, or why it isn't. */
export function parsePasted(
  text: string,
): { ok: true; data: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** A table's guest link, as its printed QR code opens it: `/?branch=…&table=…&qr=…`. */
export function guestTableLink(
  origin: string,
  branchId: string,
  table: SetupImportResponse['tables'][number],
): string {
  const search = new URLSearchParams({
    branch: branchId,
    table: String(table.number),
    qr: table.qrToken,
  });
  return `${origin}/?${search.toString()}`;
}
