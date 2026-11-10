/*
 * Handing a file made in the page (a PDF bill) to the person without ever leaving the page.
 * Phones get their share sheet (Save to Files, Print, WhatsApp…); computers a plain download.
 * Never `location = blobUrl`: on an iPhone that swaps the page for the file, and closing the
 * file then closes the browser window the guest's QR code opened.
 */

/** Whether this device should get the share sheet for the file (a touch phone or tablet that can share files). */
export function canShareFile(file: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  if (!window.matchMedia?.('(pointer: coarse)').matches) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Opens the share sheet with the file: `shared`, or `cancelled` when the person closed it.
 * Throws `NotAllowedError` when the tap that asked for it was too long ago (making the file took
 * a while): ask for another tap, then call again.
 */
export async function shareFile(file: File): Promise<'shared' | 'cancelled'> {
  try {
    await navigator.share({ files: [file], title: file.name });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}

/** Whether an error is the browser asking for a fresh tap before sharing. */
export const needsTap = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'NotAllowedError';

/** Downloads the file from this page (a link with `download`), staying on it. */
export function downloadFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Long enough for a slow phone to start saving it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
