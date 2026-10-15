/*
 * A picture made small enough to upload, in the browser: scaled to fit `max` pixels on its
 * longer side (never enlarged) and saved as JPEG.
 */

export interface ResizedImage {
  dataUrl: string;
  width: number;
  height: number;
}

const QUALITY = 0.82;

export async function resizeImage(file: Blob, max = 640): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { dataUrl: canvas.toDataURL('image/jpeg', QUALITY), width, height };
}
