/**
 * Platform-admin API types + typed fetch helpers (client-side only).
 * Shapes mirror src/server/services/admin.service.ts exactly.
 */

export interface AdminOverview {
  users: { total: number; verified: number; activeSessionsToday: number };
  organizations: { total: number; totalMembers: number };
  signupsLast7d: number;
  activityLast24h: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  suspended: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  organizationCount: number;
}

export interface AdminOrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  members: number;
  createdAt: string;
}

export interface AdminPageResult<T> {
  items: T[];
  total: number;
}

/** Server-enforced page size ceiling (see admin route files). */
export const ADMIN_PAGE_SIZE_MAX = 100;
