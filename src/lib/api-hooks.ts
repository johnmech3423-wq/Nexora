"use client";

import { useCallback } from "react";
import { QueryClient } from "@tanstack/react-query";

/** React Query client preconfigured for Nexora API conventions. */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          const e = error as { code?: string };
          if (e.code === "plan_required" || e.code === "forbidden" || e.code === "unauthorized") return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Invalidation helpers shared across features. */
export function useApiKeys() {
  return useCallback((orgId: string | null | undefined) => {
    if (!orgId) return [];
    return {
      org: ["org", orgId],
      me: ["me"],
      projects: ["projects", orgId],
      board: (pid: string) => ["board", orgId, pid],
      tasks: (pid: string) => ["tasks", orgId, pid],
      task: (pid: string, tid: string) => ["task", orgId, pid, tid],
      notifications: ["notifications", orgId],
      conversations: ["chat", orgId, "conversations"],
      messages: (cid: string) => ["chat", orgId, "messages", cid],
      timeReport: ["time", orgId, "report"],
      analytics: ["analytics", orgId],
      calendar: ["calendar", orgId],
      files: ["files", orgId],
      activity: ["activity", orgId],
    };
  }, []);
}
