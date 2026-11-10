import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShareFile, downloadFile, needsTap, shareFile } from '@/lib/saveFile';

const pdf = () => new File(['%PDF'], 'Bill A1.pdf', { type: 'application/pdf' });
const pointer = (coarse: boolean) => {
  window.matchMedia = vi.fn(() => ({ matches: coarse }) as MediaQueryList);
};

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'canShare');
  Reflect.deleteProperty(navigator, 'share');
});

describe('saving a file without leaving the page', () => {
  it('uses the share sheet only on a touch device that can share files', () => {
    Object.assign(navigator, { canShare: () => true });
    pointer(true);
    expect(canShareFile(pdf())).toBe(true);
    pointer(false);
    expect(canShareFile(pdf())).toBe(false);
    Reflect.deleteProperty(navigator, 'canShare');
    pointer(true);
    expect(canShareFile(pdf())).toBe(false);
  });

  it('tells a closed share sheet from one that needs a fresh tap', async () => {
    Object.assign(navigator, {
      share: vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')),
    });
    await expect(shareFile(pdf())).resolves.toBe('cancelled');
    Object.assign(navigator, {
      share: vi.fn().mockRejectedValue(new DOMException('no tap', 'NotAllowedError')),
    });
    const error = await shareFile(pdf()).catch((e: unknown) => e);
    expect(needsTap(error)).toBe(true);
  });

  it('downloads through a link, staying on the page', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const href = location.href;
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    downloadFile(pdf(), 'Bill A1.pdf');
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.contexts[0]).toMatchObject({ download: 'Bill A1.pdf' });
    expect(location.href).toBe(href);
  });
});
