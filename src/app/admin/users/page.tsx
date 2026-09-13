"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Users as UsersIcon, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ADMIN_PAGE_SIZE_MAX } from "@/lib/admin-api";
import type { AdminPageResult, AdminUserRow } from "@/lib/admin-api";
import { ADMIN_PAGE_SIZE_OPTIONS, adminListQueryKey, useAdminListState } from "@/components/admin/list-state";
import { UserRowActions } from "@/components/admin/admin-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMe } from "@/lib/hooks/use-session";

function UsersTable() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const { draft, setDraft, page, setPage, pageSize, setPageSize } = useAdminListState();
  const me = useMe();

  const list = useQuery({
    queryKey: adminListQueryKey("users", { q, page, pageSize }),
    queryFn: () =>
      apiFetch<AdminPageResult<AdminUserRow>>(
        `/api/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page), pageSize: String(pageSize) })}`
      ),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const refetch = () => void list.refetch();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-primary">
          <ShieldCheck className="size-4" aria-hidden /> Control plane
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Users</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Every platform account, newest first. Actions here are global — suspending a user revokes their sessions and
          workspace access across all organizations.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="user-search" className="sr-only">
            Search users by name or email
          </label>
          <Input
            id="user-search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by name or email…"
            autoComplete="off"
            spellCheck={false}
            className="pr-8"
          />
          {draft ? (
            <button
              type="button"
              onClick={() => setDraft("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {q ? (
            <>
              Results for “<span className="font-medium text-foreground">{q}</span>”
              <span className="tabular-nums">· {total}</span>
            </>
          ) : (
            <>
              <UsersIcon className="size-3.5" aria-hidden /> {list.isLoading ? "…" : total.toLocaleString()} accounts
            </>
          )}
        </div>
        <div className="sm:ml-auto">
          <label htmlFor="user-page-size" className="sr-only">
            Rows per page
          </label>
          <select
            id="user-page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-9 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ADMIN_PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
        </div>
      </div>

      {list.isLoading ? (
        <div className="mt-5 rounded-xl border bg-card">
          <ListSkeleton rows={8} className="border-0" />
        </div>
      ) : list.isError ? (
        <div className="mt-5">
          <ErrorState
            title="Couldn't load users"
            message="The users API didn't respond as expected."
            onRetry={refetch}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={UsersIcon}
            title={q ? "No users match your search" : "No users yet"}
            description={
              q
                ? `Nothing matches “${q}”. Try a different name or email.`
                : "No platform accounts have been created yet."
            }
          />
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border bg-card">
          <Table className="min-w-[820px]">
            <caption className="sr-only">Platform user accounts</caption>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email verified</TableHead>
                <TableHead className="text-right">Organizations</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((u) => {
                const self = me.data?.user.id === u.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} src={null} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{u.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.suspended ? (
                        <Badge variant="destructive">Suspended</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.verified ? <Badge variant="secondary">Verified</Badge> : <Badge variant="warning">Unverified</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{u.organizationCount}</TableCell>
                    <TableCell>
                      {u.lastLoginAt ? (
                        <span title={formatDateTime(u.lastLoginAt)}>{formatDate(u.lastLoginAt)}</span>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell title={formatDateTime(u.createdAt)}>{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <UserRowActions user={u} self={self} onChanged={refetch} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-4">
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      </div>
      {!list.isLoading && !list.isError ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {Math.min(pageSize, ADMIN_PAGE_SIZE_MAX)} rows per page · server-ordered by creation date, newest
          first.
        </p>
      ) : null}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <React.Suspense fallback={<PageFallback />}>
      <UsersTable />
    </React.Suspense>
  );
}

function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-6 h-9 w-72 animate-pulse rounded bg-muted" />
      <div className="mt-5 rounded-xl border bg-card">
        <ListSkeleton rows={8} className="border-0" />
      </div>
    </div>
  );
}
