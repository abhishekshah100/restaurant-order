import { describe, expect, it } from 'vitest';
import { layoutPages } from '@/lib/pdfPages';

/* Laying report sections on PDF pages: whole where they fit, cut only when taller than a page. */

const pages = (heights: number[], room = 1000, gap = 10) =>
  layoutPages(heights, room, gap).map((p) => [p.page, p.block, p.y, p.from, p.height]);

describe('PDF pages', () => {
  it('stacks sections down a page, with the gap between them', () => {
    expect(pages([300, 400])).toEqual([
      [0, 0, 0, 0, 300],
      [0, 1, 310, 0, 400],
    ]);
  });

  it('moves a section that would not fit whole to the next page', () => {
    expect(pages([600, 500, 200])).toEqual([
      [0, 0, 0, 0, 600],
      [1, 1, 0, 0, 500],
      [1, 2, 510, 0, 200],
    ]);
  });

  it('cuts only a section taller than a page, starting it on a fresh page when this one is used', () => {
    expect(pages([400, 2300])).toEqual([
      [0, 0, 0, 0, 400],
      [1, 1, 0, 0, 1000],
      [2, 1, 0, 1000, 1000],
      [3, 1, 0, 2000, 300],
    ]);
    // Most of the page still free: it starts right there.
    expect(pages([100, 1500])).toEqual([
      [0, 0, 0, 0, 100],
      [0, 1, 110, 0, 890],
      [1, 1, 0, 890, 610],
    ]);
  });

  it('puts what follows a cut section after its last slice', () => {
    expect(pages([1200, 300])).toEqual([
      [0, 0, 0, 0, 1000],
      [1, 0, 0, 1000, 200],
      [1, 1, 210, 0, 300],
    ]);
  });
});
