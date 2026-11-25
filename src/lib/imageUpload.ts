import { ApiError } from '@/api/client';

/*
 * Every picture uploaded goes through prepareImage: dish photos (and their thumbnails), the branch
 * photo, payment, deposit and supplier-invoice photos. In the browser, as the app is a static
 * site and nothing resizes pictures later:
 *
 * 1. checked before it's opened: a photo type (JPEG, PNG, WebP; HEIC where the browser reads it),
 *    at most MAX_FILE_BYTES, and at most MAX_PIXELS by its header, so a huge file can't freeze a
 *    phone while it's decoded;
 * 2. fitted to its use: the shape kept, never enlarged, its longer side at most the preset's;
 * 3. compressed to fit: WebP (JPEG where the browser can't write WebP) at good quality, then
 *    lower quality, then smaller, until it's under the preset's size, which the server's limit
 *    for that kind of picture leaves room above (restaurant-backend › media/data-url-image.ts);
 * 4. cleaned: turned upright (the camera's rotation), transparency on white, and the camera's
 *    details (GPS position, the phone) left out, as only the pixels are redrawn.
 *
 * Every refusal is an ImageError naming the problem, which imageProblemOf also reads from the
 * server's refusals, so the screens say what was wrong instead of "upload failed".
 */

const KB = 1024;

/** The largest file opened (5 MB): bigger ones are refused before anything is decoded. */
export const MAX_FILE_BYTES = 5 * KB * KB;
/** The most pixels opened (by the file's header): about a 7700 × 5200 photo. */
export const MAX_PIXELS = 40_000_000;

/** What the file pickers offer. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export type ImagePurpose = 'dish' | 'branch' | 'proof';

interface Preset {
  /** The longer side, at most. */
  maxSide: number;
  /** The file, at most (the server allows a little more). */
  maxBytes: number;
}

/** Each use's size and weight. */
export const IMAGE_PRESETS: Record<ImagePurpose, Preset> = {
  /** Sharp on the dish page on a large phone (server: 500 kB, 2048 px). */
  dish: { maxSide: 1080, maxBytes: 450 * KB },
  /** The branch picker and outlet cards (server: 300 kB). */
  branch: { maxSide: 640, maxBytes: 280 * KB },
  /** Proof of payment or a supplier's invoice: the small print must read (server: 1 MB). */
  proof: { maxSide: 1600, maxBytes: 950 * KB },
};

/** A dish's thumbnail: its shorter side, sharp in the 56–96 px squares on 2× screens. */
const THUMB = { shortSide: 192, maxBytes: 90 * KB };

/** Qualities tried in turn before the picture is made smaller. */
const QUALITIES = [0.82, 0.72, 0.62];
/** Each step down in size when no quality fits. */
const SHRINK = 0.8;
const MAX_SHRINKS = 5;

export type ImageProblem =
  /** Not a photo type we take. */
  | 'type'
  /** An iPhone photo (HEIC) this browser can't open. */
  | 'heic'
  /** Over MAX_FILE_BYTES. */
  | 'fileTooLarge'
  /** Over MAX_PIXELS (by its header), or over the server's side for its kind. */
  | 'tooManyPixels'
  /** Damaged, or not what its name says. */
  | 'unreadable'
  /** Couldn't be made small enough (or the server found it too heavy). */
  | 'tooLarge'
  /** The upload itself failed (offline, the server). */
  | 'uploadFailed';

export class ImageError extends Error {
  constructor(readonly problem: ImageProblem) {
    super(`Image refused: ${problem}`);
    this.name = 'ImageError';
  }
}

/** What went wrong with an upload, from an ImageError or the server's refusal. */
export function imageProblemOf(error: unknown): ImageProblem {
  if (error instanceof ImageError) return error.problem;
  if (error instanceof ApiError && error.body?.field === 'dataUrl') {
    const reason = error.body.reason;
    if (reason === 'tooLarge') return 'tooLarge';
    if (reason === 'tooManyPixels') return 'tooManyPixels';
    if (reason === 'notAnImage') return 'unreadable';
  }
  return 'uploadFailed';
}

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/* ---------- Before opening: type and size from the file's first bytes ---------- */

type FileKind = 'jpeg' | 'png' | 'webp' | 'heic';

/** How many bytes are read for the type and size (a JPEG's camera details come first). */
const HEADER_BYTES = 256 * KB;

const ascii = (b: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...b.subarray(from, to));

/** The file's real type, from its signature (some phones send no type, or the wrong one). */
export function sniffType(b: Uint8Array): FileKind | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (ascii(b, 1, 4) === 'PNG' && b[0] === 0x89) return 'png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp';
  // ISO media: "ftyp" then the brand (HEIC and HEIF photos).
  if (
    ascii(b, 4, 8) === 'ftyp' &&
    /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(ascii(b, 8, 12))
  ) {
    return 'heic';
  }
  return null;
}

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/**
 * The picture's width and height from its header (JPEG, PNG, WebP), without decoding it; null
 * when the header doesn't say within the bytes read (HEIC: the browser decides).
 */
export function headerSize(
  b: Uint8Array,
  kind: FileKind,
): { width: number; height: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (kind === 'png') {
    if (b.length < 24 || ascii(b, 12, 16) !== 'IHDR') return null;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (kind === 'jpeg') {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1] ?? 0;
      if (marker === 0xff) {
        i += 1;
        continue;
      }
      if (SOF.has(marker)) return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      if (marker === 0xda || marker === 0xd9) return null;
      if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2;
        continue;
      }
      i += 2 + view.getUint16(i + 2);
    }
    return null;
  }
  if (kind === 'webp' && b.length >= 30) {
    const chunk = ascii(b, 12, 16);
    if (chunk === 'VP8 ') {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (chunk === 'VP8L') {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') {
      const u24 = (at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16);
      return { width: u24(24) + 1, height: u24(27) + 1 };
    }
  }
  return null;
}

/** The file checked before it's opened: its type, and whether it's within the limits. */
export async function checkImageFile(file: Blob): Promise<FileKind> {
  if (file.size > MAX_FILE_BYTES) throw new ImageError('fileTooLarge');
  if (file.size === 0) throw new ImageError('unreadable');
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const kind = sniffType(head);
  if (!kind) {
    // Something else, whatever its name says (a PDF, a video, a document).
    throw new ImageError(file.type.startsWith('image/') ? 'unreadable' : 'type');
  }
  const size = headerSize(head, kind);
  if (size && size.width * size.height > MAX_PIXELS) throw new ImageError('tooManyPixels');
  return kind;
}

/* ---------- Drawing and compressing ---------- */

/**
 * Whether this browser writes WebP: one that can't (older Safari) quietly writes PNG instead,
 * several times larger, so it's asked once, with a pixel.
 */
let webp: boolean | undefined;
function writesWebp(): boolean {
  if (webp === undefined) {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    webp = probe.toDataURL('image/webp', 0.8).startsWith('data:image/webp');
  }
  return webp;
}

/** A data URL's bytes, from its base64 length. */
export const dataUrlBytes = (dataUrl: string): number => {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

/** The bitmap scaled by `scale` (never enlarged) and encoded at `quality`. */
function draw(bitmap: ImageBitmap, scale: number, quality: number): PreparedImage {
  const s = Math.min(1, scale);
  const width = Math.max(1, Math.round(bitmap.width * s));
  const height = Math.max(1, Math.round(bitmap.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageError('unreadable');
  const type = writesWebp() ? 'image/webp' : 'image/jpeg';
  // JPEG has no transparency: what was transparent is white, not black.
  if (type === 'image/jpeg') {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  const dataUrl = canvas.toDataURL(type, quality);
  canvas.width = canvas.height = 0;
  return { dataUrl, width, height };
}

/**
 * The first encoding within `maxBytes`: each quality in turn at `scale`, then smaller. Takes the
 * drawing as a function, so the steps are tested without a browser.
 */
export function fitWithin(
  encode: (scale: number, quality: number) => PreparedImage,
  scale: number,
  maxBytes: number,
): PreparedImage {
  let s = Math.min(1, scale);
  for (let step = 0; step <= MAX_SHRINKS; step += 1) {
    for (const quality of QUALITIES) {
      const out = encode(s, quality);
      if (dataUrlBytes(out.dataUrl) <= maxBytes) return out;
    }
    s *= SHRINK;
  }
  throw new ImageError('tooLarge');
}

/** The file decoded upright, or why it can't be. */
async function open(file: Blob, kind: FileKind): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError(kind === 'heic' ? 'heic' : 'unreadable');
  }
}

/**
 * The picture checked, fitted and compressed for its use; a dish's with its thumbnail too.
 * Throws ImageError (imageProblemOf says what to tell the staff).
 */
export async function prepareImage(
  file: Blob,
  purpose: 'dish',
): Promise<PreparedImage & { thumb: PreparedImage }>;
export async function prepareImage(
  file: Blob,
  purpose: Exclude<ImagePurpose, 'dish'>,
): Promise<PreparedImage>;
export async function prepareImage(
  file: Blob,
  purpose: ImagePurpose,
): Promise<PreparedImage & { thumb?: PreparedImage }> {
  const kind = await checkImageFile(file);
  const bitmap = await open(file, kind);
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new ImageError('tooManyPixels');
    const { maxSide, maxBytes } = IMAGE_PRESETS[purpose];
    const encode = (scale: number, quality: number) => draw(bitmap, scale, quality);
    const image = fitWithin(encode, maxSide / Math.max(bitmap.width, bitmap.height), maxBytes);
    if (purpose !== 'dish') return image;
    const thumb = fitWithin(
      encode,
      THUMB.shortSide / Math.min(bitmap.width, bitmap.height),
      THUMB.maxBytes,
    );
    return { ...image, thumb };
  } finally {
    bitmap.close();
  }
}
