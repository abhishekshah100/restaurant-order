import QRCode from 'qrcode';

/*
 * Drawing a table's QR code: the link (the guest app's address and the path the API gives) as
 * one SVG path of its dark modules, sharp at any print size, or as a PNG to download.
 */

/** Medium error correction: still reads with a scuff or a small logo over it. */
const CORRECTION = 'M';

/** The full link printed on a table: this app's address with the API's path. */
export const tableLink = (origin: string, path: string) => new URL(path, origin).toString();

/** The QR code's modules as one SVG path, and its size in modules (for the viewBox). */
export function qrPath(text: string): { size: number; d: string } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: CORRECTION });
  const { size } = modules;
  let d = '';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules.get(row, col)) d += `M${col} ${row}h1v1h-1z`;
    }
  }
  return { size, d };
}

/** A PNG of the QR code, `width` pixels square with a quiet margin, as a data URL. */
export const qrPng = (text: string, width = 1024) =>
  QRCode.toDataURL(text, { errorCorrectionLevel: CORRECTION, width, margin: 2 });
