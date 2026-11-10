/*
 * Pictures made small enough to upload, in the browser (the app is a static site: nothing resizes
 * them later). WebP where the browser can write it (smaller at the same quality), else JPEG.
 */

export interface ResizedImage {
  dataUrl: string;
  width: number;
  height: number;
}

const QUALITY = 0.82;

/**
 * Whether this browser writes WebP: one that can't (older Safari) quietly writes PNG instead,
 * several times larger, so it's asked once, with a pixel.
 */
let webp: boolean | undefined;
function writesWebp(): boolean {
  if (webp === undefined) {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    webp = probe.toDataURL('image/webp', QUALITY).startsWith('data:image/webp');
  }
  return webp;
}

/** `bitmap` scaled by `scale` (never enlarged) and encoded. */
function draw(bitmap: ImageBitmap, scale: number): ResizedImage {
  const s = Math.min(1, scale);
  const width = Math.max(1, Math.round(bitmap.width * s));
  const height = Math.max(1, Math.round(bitmap.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(bitmap, 0, 0, width, height);
  const type = writesWebp() ? 'image/webp' : 'image/jpeg';
  return { dataUrl: canvas.toDataURL(type, QUALITY), width, height };
}

/** The picture scaled to fit `max` pixels on its longer side. */
export async function resizeImage(file: Blob, max = 640): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    return draw(bitmap, max / Math.max(bitmap.width, bitmap.height));
  } finally {
    bitmap.close();
  }
}

/** The short side of a thumbnail: sharp in the 56–96 px squares it fills, on 2× screens. */
const THUMB_SIDE = 192;

/**
 * A dish picture and its thumbnail, for rows, the cart and orders (cropped to a square there):
 * the thumbnail's shorter side is THUMB_SIDE, so it covers the square without blurring.
 */
export async function resizeWithThumb(
  file: Blob,
  max = 640,
): Promise<ResizedImage & { thumb: ResizedImage }> {
  const bitmap = await createImageBitmap(file);
  try {
    const image = draw(bitmap, max / Math.max(bitmap.width, bitmap.height));
    const thumb = draw(bitmap, THUMB_SIDE / Math.min(bitmap.width, bitmap.height));
    return { ...image, thumb };
  } finally {
    bitmap.close();
  }
}
