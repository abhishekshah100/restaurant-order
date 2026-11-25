import { Blob as NodeBlob } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import {
  ImageError,
  MAX_FILE_BYTES,
  checkImageFile,
  dataUrlBytes,
  fitWithin,
  headerSize,
  imageProblemOf,
  sniffType,
} from '@/lib/imageUpload';

/*
 * Every upload's checks before a picture is opened (its real type, its weight, its pixels by its
 * header), the compression steps until it fits, and the problems said in words.
 */

const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const jpeg = (width: number, height: number) =>
  new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    0x00,
    0x04,
    0x45,
    0x78,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    ...u16(height),
    ...u16(width),
    0x03,
    0x01,
    0x22,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
    0xff,
    0xd9,
  ]);
function png(width: number, height: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  b.set(
    [...'IHDR'].map((c) => c.charCodeAt(0)),
    12,
  );
  const view = new DataView(b.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return b;
}
function webp(chunk: 'VP8 ' | 'VP8L' | 'VP8X', width: number, height: number) {
  const b = new Uint8Array(32);
  const text = (s: string, at: number) =>
    b.set(
      [...s].map((c) => c.charCodeAt(0)),
      at,
    );
  text('RIFF', 0);
  text('WEBP', 8);
  text(chunk, 12);
  const view = new DataView(b.buffer);
  if (chunk === 'VP8 ') {
    b.set([0x9d, 0x01, 0x2a], 23);
    view.setUint16(26, width, true);
    view.setUint16(28, height, true);
  } else if (chunk === 'VP8L') {
    b[20] = 0x2f;
    view.setUint32(21, (width - 1) | ((height - 1) << 14), true);
  } else {
    b.set([(width - 1) & 0xff, ((width - 1) >> 8) & 0xff, 0], 24);
    b.set([(height - 1) & 0xff, ((height - 1) >> 8) & 0xff, 0], 27);
  }
  return b;
}
const heic = () => {
  const b = new Uint8Array(16);
  b.set([...'\0\0\0\x18ftypheic'].map((c) => c.charCodeAt(0)));
  return b;
};
const file = (bytes: Uint8Array, type = 'image/jpeg') =>
  new NodeBlob([bytes as Uint8Array<ArrayBuffer>], { type }) as unknown as Blob;

describe('a picture before it is opened', () => {
  it('knows its real type from its first bytes, whatever its name', () => {
    expect(sniffType(jpeg(10, 10))).toBe('jpeg');
    expect(sniffType(png(10, 10))).toBe('png');
    expect(sniffType(webp('VP8X', 10, 10))).toBe('webp');
    expect(sniffType(heic())).toBe('heic');
    expect(sniffType(new TextEncoder().encode('%PDF-1.7'))).toBeNull();
  });

  it('reads its size from its header without decoding it', () => {
    expect(headerSize(jpeg(4032, 3024), 'jpeg')).toEqual({ width: 4032, height: 3024 });
    expect(headerSize(png(1080, 720), 'png')).toEqual({ width: 1080, height: 720 });
    expect(headerSize(webp('VP8 ', 1080, 810), 'webp')).toEqual({ width: 1080, height: 810 });
    expect(headerSize(webp('VP8L', 192, 144), 'webp')).toEqual({ width: 192, height: 144 });
    expect(headerSize(webp('VP8X', 640, 480), 'webp')).toEqual({ width: 640, height: 480 });
    expect(headerSize(heic(), 'heic')).toBeNull();
  });

  it('takes a photo within the limits', async () => {
    await expect(checkImageFile(file(jpeg(4032, 3024)))).resolves.toBe('jpeg');
    // An iPhone photo: the browser decides whether it can open it.
    await expect(checkImageFile(file(heic(), 'image/heic'))).resolves.toBe('heic');
    // No type given (some phones): its bytes say.
    await expect(checkImageFile(file(png(10, 10), ''))).resolves.toBe('png');
  });

  it('refuses what would freeze a phone, before decoding it', async () => {
    const problem = (blob: Blob) => checkImageFile(blob).catch((e: ImageError) => e.problem);
    // Over 5 MB (only its size is looked at).
    const big = { size: MAX_FILE_BYTES + 1, type: 'image/jpeg' } as Blob;
    expect(await problem(big)).toBe('fileTooLarge');
    // A small file claiming 20000 × 20000 pixels.
    expect(await problem(file(jpeg(20_000, 20_000)))).toBe('tooManyPixels');
    // A document, and something calling itself a photo that isn't.
    expect(await problem(file(new TextEncoder().encode('%PDF-1.7'), 'application/pdf'))).toBe(
      'type',
    );
    expect(await problem(file(new TextEncoder().encode('<html>'), 'image/png'))).toBe('unreadable');
    expect(await problem(file(new Uint8Array(0)))).toBe('unreadable');
  });
});

describe('compressing until it fits', () => {
  /** A fake encoder: the bytes it makes for each scale and quality, and every try. */
  const encoder = (bytesFor: (scale: number, quality: number) => number) => {
    const tries: [number, number][] = [];
    const encode = (scale: number, quality: number) => {
      tries.push([Number(scale.toFixed(3)), quality]);
      const bytes = bytesFor(scale, quality);
      return {
        dataUrl: `data:image/webp;base64,${'A'.repeat(Math.ceil((bytes * 4) / 3))}`,
        width: 1,
        height: 1,
      };
    };
    return { encode, tries };
  };

  it('keeps the first quality that fits, at its size', () => {
    const { encode, tries } = encoder((_s, q) => (q >= 0.8 ? 500_000 : 300_000));
    fitWithin(encode, 0.5, 400_000);
    expect(tries).toEqual([
      [0.5, 0.82],
      [0.5, 0.72],
    ]);
  });

  it('makes it smaller when no quality fits, and never enlarges it', () => {
    const { encode, tries } = encoder((s) => s * 1_000_000);
    fitWithin(encode, 3, 850_000);
    // Never above full size: 1, then 0.8 × 1 (fits at its first quality).
    expect(tries.map(([s]) => s)).toEqual([1, 1, 1, 0.8]);
  });

  it('gives up with tooLarge when nothing fits', () => {
    const { encode } = encoder(() => 10_000_000);
    expect(() => fitWithin(encode, 1, 100)).toThrow(ImageError);
  });

  it('counts a data URL’s bytes from its base64', () => {
    expect(dataUrlBytes('data:image/png;base64,AAAA')).toBe(3);
    expect(dataUrlBytes('data:image/png;base64,AAA=')).toBe(2);
    expect(dataUrlBytes('data:image/png;base64,AA==')).toBe(1);
  });
});

describe('what went wrong, in words', () => {
  it("reads the server's refusals as well as its own", () => {
    expect(imageProblemOf(new ImageError('heic'))).toBe('heic');
    const refused = (reason: string) =>
      new ApiError(400, 'x', { error: 'invalid_request', field: 'dataUrl', reason });
    expect(imageProblemOf(refused('tooLarge'))).toBe('tooLarge');
    expect(imageProblemOf(refused('tooManyPixels'))).toBe('tooManyPixels');
    expect(imageProblemOf(refused('notAnImage'))).toBe('unreadable');
    expect(imageProblemOf(new ApiError(0, 'x'))).toBe('uploadFailed');
    expect(imageProblemOf(new Error('boom'))).toBe('uploadFailed');
  });
});
