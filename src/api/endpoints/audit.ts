import { apiGet, backendBlob } from '../client';
import type { AuditLogResponse, AuditQuery } from '../contracts';
import { bearer, searchOf, seg } from './shared';

/** The audit log. */
export const auditApi = {
  /** GET …/audit: the audit log on these days, a page at a time (backend only). */
  auditLog: (token: string, branchId: string, query: AuditQuery) =>
    apiGet<AuditLogResponse>(
      `admin/branches/${seg(branchId)}/audit${searchOf(query)}`,
      bearer(token),
    ),
  /** GET …/audit/export.csv: every entry on these days (as filtered), as CSV bytes. */
  auditExport: (token: string, branchId: string, query: Omit<AuditQuery, 'before'>) =>
    backendBlob(
      `admin/branches/${seg(branchId)}/audit/export.csv${searchOf(query)}`,
      bearer(token),
    ),
};
