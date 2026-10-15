import { describe, expect, it } from 'vitest';
import { handledInMinutes, requestCounts, requestGroups } from '@/lib/adminRequests';
import { withAcknowledged } from '@/lib/adminService';
import type { AdminBranchService, AdminServiceRequest } from '@/types/admin';

/* The Requests page's logic: waiting vs on the way, the kind filter, done, handled time. */

const at = (minute: number) => `2026-10-15T19:${String(minute).padStart(2, '0')}:00.000Z`;

const water: AdminServiceRequest = {
  id: 'w1',
  kind: 'waiter',
  reason: 'water',
  table: 4,
  sessionId: 's1',
  requestedAt: at(0),
};
const bill: AdminServiceRequest = {
  id: 'b1',
  kind: 'bill',
  scope: 'table',
  balance: 900,
  table: 7,
  sessionId: 's2',
  requestedAt: at(2),
  acknowledgedAt: at(3),
  acknowledgedBy: 'Abhishek Saha',
};
const cutlery: AdminServiceRequest = {
  id: 'w2',
  kind: 'waiter',
  reason: 'cutlery',
  table: 9,
  sessionId: 's3',
  requestedAt: at(1),
  resolvedAt: at(5),
  resolvedBy: 'Abhishek Saha',
};

const service = { requests: [water, bill], doneRequests: [cutlery] } as AdminBranchService;

describe('requests page', () => {
  it('splits open requests into waiting and on the way, by kind', () => {
    expect(requestGroups(service, 'all')).toEqual({
      waiting: [water],
      coming: [bill],
      done: [cutlery],
    });
    expect(requestGroups(service, 'bill')).toEqual({ waiting: [], coming: [bill], done: [] });
    expect(requestCounts(service.requests)).toEqual({ all: 2, waiter: 1, bill: 1 });
  });

  it('says how long a request took to deal with', () => {
    expect(handledInMinutes(cutlery)).toBe(4);
    expect(handledInMinutes(water)).toBeUndefined();
  });

  it('marks someone on the way before the server confirms, keeping whoever was first', () => {
    const next = withAcknowledged(service, 'w1', 'Priya', at(6));
    expect(next.requests[0]).toMatchObject({ acknowledgedBy: 'Priya', acknowledgedAt: at(6) });
    expect(withAcknowledged(service, 'b1', 'Priya', at(6)).requests[1].acknowledgedBy).toBe(
      'Abhishek Saha',
    );
  });
});
