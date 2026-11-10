import { describe, expect, it } from 'vitest';
import { mineFirst, type QueueItem } from '@/lib/adminService';
import { initialsOf, isMe, myTables, sectionsFor } from '@/lib/adminTables';
import type { AdminFloor } from '@/types/admin';

const arjun = { id: 'a1', name: 'Arjun Waiter' };
const priya = { id: 'p1', name: 'Priya' };
const sections = [
  { table: 1, waiter: arjun },
  { table: 2, waiter: arjun },
  { table: 3, waiter: priya },
];

describe('table sections', () => {
  it('writes a waiter as initials', () => {
    expect(initialsOf('Arjun Waiter')).toBe('AW');
    expect(initialsOf('  priya ')).toBe('P');
  });

  it('knows the signed-in waiter by id, or by name on an older session', () => {
    expect(isMe(arjun, { id: 'a1' })).toBe(true);
    expect(isMe(arjun, { id: 'p1', name: 'Arjun Waiter' })).toBe(false);
    expect(isMe(arjun, { name: 'arjun waiter' })).toBe(true);
    expect(isMe(undefined, { id: 'a1' })).toBe(false);
  });

  it('splits the tables into mine and others’, and nothing is others’ without a section', () => {
    const { mine, others } = sectionsFor(sections, { id: 'a1' });
    expect([...mine]).toEqual([1, 2]);
    expect([...others]).toEqual([3]);
    expect([...sectionsFor(sections, { id: 'zz' }).others]).toEqual([]);
    const floors = [
      { id: 'g', name: 'Ground', tables: [{ table: 1, waiter: arjun }, { table: 4 }] },
    ] as unknown as AdminFloor[];
    expect([...myTables(floors, { id: 'a1' })]).toEqual([1]);
  });

  it('puts my tables first, then the rest, then others’ (each still oldest first)', () => {
    const item = (key: string, table: number | undefined, since: string) =>
      ({ key, kind: 'waiter', since, request: { table } }) as unknown as QueueItem;
    // As the queue comes: oldest first.
    const queue = [
      item('priya-old', 3, '1'),
      item('free-old', 7, '2'),
      item('mine-old', 1, '3'),
      item('pickup', undefined, '3'),
      item('mine-new', 2, '4'),
    ];
    expect(mineFirst(queue, new Set([1, 2]), new Set([3])).map((i) => i.key)).toEqual([
      'mine-old',
      'mine-new',
      'free-old',
      'pickup',
      'priya-old',
    ]);
  });
});
