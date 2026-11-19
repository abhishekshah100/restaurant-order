import { apiGet } from '../client';
import type { BranchSalesReport, SalesReport } from '../contracts';
import { bearer, searchOf, seg } from './shared';

/** Reports for managers (`reports.view`). */
export const reportsApi = {
  salesReport: (token: string, branchId: string, range: { from: string; to: string }) =>
    apiGet<SalesReport>(
      `admin/branches/${seg(branchId)}/reports/sales${searchOf(range)}`,
      bearer(token),
    ),
  salesByBranch: (token: string, branchId: string, range: { from: string; to: string }) =>
    apiGet<BranchSalesReport>(
      `admin/branches/${seg(branchId)}/reports/sales/branches${searchOf(range)}`,
      bearer(token),
    ),
};
