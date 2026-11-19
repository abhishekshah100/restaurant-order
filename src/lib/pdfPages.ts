/*
 * Laying a report's sections onto pages: each section whole where it fits, onto the next page
 * where it doesn't, and only a section taller than a page cut across pages. Pure, so the PDF
 * code only draws what this works out.
 */

/** A section (or a slice of one) on a page. */
export interface PagePlacement {
  /** 0-based. */
  page: number;
  /** Which section. */
  block: number;
  /** Where on the page its top goes (same units as the heights). */
  y: number;
  /** The part of the section drawn: from this far down it, this tall. */
  from: number;
  height: number;
}

/**
 * Where each section goes, given their heights, the room on a page and the gap between them.
 * A section starting low on a page that wouldn't fit whole starts on the next one; one taller
 * than a page starts on a page of its own unless most of the current page is free.
 */
export function layoutPages(
  heights: readonly number[],
  pageHeight: number,
  gap: number,
): PagePlacement[] {
  const placed: PagePlacement[] = [];
  let page = 0;
  let y = 0;
  heights.forEach((height, block) => {
    if (height <= pageHeight) {
      if (y > 0 && y + height > pageHeight) {
        page += 1;
        y = 0;
      }
      placed.push({ page, block, y, from: 0, height });
      y += height + gap;
      return;
    }
    // Taller than a page: on a fresh page unless most of this one is still free.
    if (y > pageHeight / 4) {
      page += 1;
      y = 0;
    }
    let from = 0;
    while (from < height) {
      const take = Math.min(height - from, pageHeight - y);
      placed.push({ page, block, y, from, height: take });
      from += take;
      if (from < height) {
        page += 1;
        y = 0;
      } else {
        y += take + gap;
      }
    }
  });
  return placed;
}
