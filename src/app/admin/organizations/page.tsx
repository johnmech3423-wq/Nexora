"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, ShieldCheck, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/utils";
import { PLANS, PLAN_PRICING, type PlanKey } from "@/lib/constants";
import type { AdminOrgRow, AdminPageResult } from "@/lib/admin-api";
import { ADMIN_PAGE_SIZE_OPTIONS, adminListQueryKey, useAdminListState } from "@/components/admin/list-state";
import { OrgPlanAction } from "@/components/admin/admin-actions";
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

function planBadge(plan: string): { label: string; variant: "success" | "default" | "warning" } {
  if (plan === "free") return { label: "Free", variant: "success" };
  if (plan === "pro") return { label: "Pro", variant: "default" };
  if (plan === "business") return { label: "Business", variant: "warning" };
  return { label: plan, variant: "warning" };
}

function OrgsTable() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const { draft, setDraft, page, setPage, pageSize, setPageSize } = useAdminListState();

  const list = useQuery({
    queryKey: adminListQueryKey("organizations", { q, page, pageSize }),
    queryFn: () =>
      apiFetch<AdminPageResult<AdminOrgRow>>(
        `/api/admin/organizations?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page), pageSize: String(pageSize) })}`
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
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Organizations</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Workspaces on the platform, newest first. Plan changes here are enforced by the billing gate immediately.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="org-search" className="sr-only">
            Search organizations by name or slug
          </label>
          <Input
            id="org-search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by name or slug…"
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
              <Building2 className="size-3.5" aria-hidden /> {list.isLoading ? "…" : total.toLocaleString()} workspaces
            </>
          )}
        </div>
        <div className="sm:ml-auto">
          <label htmlFor="org-page-size" className="sr-only">
            Rows per page
          </label>
          <select
            id="org-page-size"
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
            title="Couldn't load organizations"
            message="The organizations API didn't respond as expected."
            onRetry={refetch}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={Building2}
            title={q ? "No organizations match your search" : "No organizations yet"}
            description={
              q
                ? `Nothing matches “${q}”. Try a different name or slug.`
                : "No workspaces have been created on the platform yet."
            }
          />
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border bg-card">
          <Table className="min-w-[780px]">
            <caption className="sr-only">Platform organizations</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Plan action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => {
                const badge = planBadge(o.plan);
                const isPlan = PLANS.includes(o.plan as PlanKey);
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground" aria-hidden>
                          <Building2 className="size-3.5" />
                        </span>
                        <span className="truncate text-sm font-medium">{o.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{o.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>
                        {badge.label}
                        {isPlan ? (
                          <span className="font-normal opacity-70">
                            · ${PLAN_PRICING[o.plan as PlanKey].monthly}/mo
                          </span>
                        ) : null}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{o.members}</TableCell>
                    <TableCell title={formatDateTime(o.createdAt)}>{formatDate(o.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <OrgPlanAction org={o} onChanged={refetch} />
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
      <p className="mt-2 text-xs text-muted-foreground">
        Member counts and plans come from the platform service. Workspace owners keep their own billing controls under
        Settings → Billing.
      </p>
    </div>
  );
}

export default function AdminOrganizationsPage() {
  return (
    <React.Suspense fallback={<OrgFallback />}>
      <OrgsTable />
    </React.Suspense>
  );
}

function OrgFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-6 h-9 w-72 animate-pulse rounded bg-muted" />
      <div className="mt-5 rounded-xl border bg-card">
        <ListSkeleton rows={8} className="border-0" />
      </div>
    </div>
  );
}
