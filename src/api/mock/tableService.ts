import { isOutOfService } from '@/lib/floorLayout';
import { fail, type MockContext } from './context';

/**
 * 409 table_disabled when the table is out of service (Settings › Floor plan): guests can't
 * start a visit or order there, waiters can't take orders and it can't be booked. No table
 * (takeaway, delivery): nothing to check.
 */
export async function assertTableInService(
  ctx: MockContext,
  branchId: string,
  table: number | undefined,
): Promise<void> {
  if (table === undefined) return;
  if (isOutOfService(await ctx.seed.floors(branchId), table)) fail(409, 'table_disabled');
}
