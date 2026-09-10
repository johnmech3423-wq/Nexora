"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Activity as ActivityIcon, Check } from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import { ActivityItem } from "@/components/features/activity-utils";
import type { ActivityDTO } from "@/types";

const PAGE_SIZE = 25;

export default function ActivityPage() {
  const orgId = useActiveOrgId();
  const feed = useInfiniteQuery({
    queryKey: qk.activity(orgId ?? "x", "feed"),
    queryFn: async ({ pageParam }) => {
      const data = await apiFetch<{ items: ActivityDTO[]; total: number; hasMore: boolean }>(
        `/api/activity${qs({ orgId, page: pageParam, pageSize: PAGE_SIZE })}`
      );
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
    enabled: Boolean(orgId),
  });

  if (!orgId) return null;
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Activity</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          A chronological log of what changed across the workspace.
        </p>
      </div>

      {feed.isLoading ? (
        <CardSkeleton className="h-72" />
      ) : feed.isError ? (
        <ErrorState
          title="Couldn't load activity"
          message={apiErrorMessage(feed.error)}
          onRetry={() => void feed.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet"
          description="Changes to projects, tasks, members and more will show up here as your team works."
        />
      ) : (
        <>
          <ol className="divide-y rounded-lg border bg-card px-4">
            {items.map((a) => (
              <li key={a.id}>
                <ActivityItem entry={a} />
              </li>
            ))}
          </ol>
          <div className="flex justify-center">
            {feed.hasNextPage ? (
              <Button variant="outline" onClick={() => void feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
                Load older activity
              </Button>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="size-3 text-success" /> You&apos;re all caught up
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
