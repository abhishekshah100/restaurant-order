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

/** What's written above the QR code on a downloaded card. */
export interface QrHeading {
  /** The restaurant's name. */
  name: string;
  /** "Table 5". */
  table: string;
}

/** Text no wider than `max`: a smaller font first (down to half size), then cut short with "…". */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  size: number,
  family: string,
  max: number,
): string {
  let px = size;
  ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > max && px > size / 2) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  let fitted = text;
  while (ctx.measureText(fitted).width > max && fitted.length > 1) {
    fitted = `${fitted.slice(0, -2).trimEnd()}…`;
  }
  return fitted;
}

/**
 * A PNG of the QR code with the restaurant's name and the table above it, so staff can tell the
 * downloaded codes apart: `width` pixels wide, as a data URL.
 */
export async function qrPng(text: string, heading: QrHeading, width = 1024): Promise<string> {
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, text, { errorCorrectionLevel: CORRECTION, width, margin: 2 });
  // The app's font, once loaded (a canvas doesn't wait for it).
  await document.fonts.ready;
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';

  const pad = Math.round(width * 0.07);
  const nameSize = Math.round(width * 0.055);
  const tableSize = Math.round(width * 0.11);
  const tableTop = pad + nameSize + Math.round(nameSize * 0.5);
  const qrTop = tableTop + tableSize;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = qrTop + width;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const max = width - pad * 2;
  ctx.fillText(fitText(ctx, heading.name, 600, nameSize, family, max), width / 2, pad);
  ctx.fillText(fitText(ctx, heading.table, 700, tableSize, family, max), width / 2, tableTop);
  ctx.drawImage(qr, 0, qrTop);
  return canvas.toDataURL('image/png');
}
