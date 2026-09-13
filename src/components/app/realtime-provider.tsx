"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe, useActiveOrgId } from "@/lib/hooks/use-session";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";

type EventMap = { [event: string]: (detail: { data?: Record<string, unknown> }) => void };

/** Window-level event bus used by pages for lightweight live updates (typing…). */
export function dispatchRealtime(type: string, data: unknown) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`nexora:${type}`, { detail: { data } }));
}

/**
 * Subscribes to org/user Pusher channels when REALTIME is configured.
 * All mutations still flow through REST; this layer only invalidates
 * caches + fans events to pages. Absent/disabled realtime is a no-op:
 * pages fall back to refetch intervals, so the app never breaks.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const me = useMe();
  const orgId = useActiveOrgId();
  const userId = me.data?.user?.id;
  const runtimeConfig = useQuery({
    queryKey: ["platform-public-config"],
    queryFn: () => apiFetch<{ realtime: { driver: "none" | "pusher"; key: string | null; cluster: string } }>("/api/config/public"),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });

  React.useEffect(() => {
    const driver = runtimeConfig.data?.realtime.driver;
    const key = runtimeConfig.data?.realtime.key;
    if (driver !== "pusher" || !key || !orgId || !userId) return;
    let disposed = false;
    let pusherInstance: { subscribe: (c: string) => { bind: (e: string, h: (d: unknown) => void) => void; unbind?: () => void }; disconnect: () => void } | null = null;

    void (async () => {
      try {
        const { default: Pusher } = await import("pusher-js");
        if (disposed) return;
        const pusher = new Pusher(key, {
          cluster: runtimeConfig.data?.realtime.cluster ?? "mt1",
          authEndpoint: "/api/realtime/auth",
          auth: { headers: { "Content-Type": "application/json" } },
        });
        pusherInstance = pusher as never;
        const channel = pusher.subscribe(`private-org-${orgId}`);
        channel.bind("pusher:subscription_error", () => console.warn("[realtime] subscription denied"));
        const onEvent = (envelope: { type?: string; data?: unknown }) => {
          if (!envelope?.type) return;
          handleEvent(envelope.type, envelope.data as Record<string, unknown> | undefined);
        };
        // Bind all server event names.
        const events = [
          "task.created", "task.updated", "task.moved", "task.deleted",
          "comment.created", "comment.updated", "comment.deleted",
          "sprint.started", "sprint.completed", "milestone.updated", "project.updated",
          "member.joined", "member.removed", "member.updated",
          "notification.created", "message.created", "message.updated", "message.deleted",
          "conversation.created", "typing", "presence",
        ];
        events.forEach((e) => channel.bind(e, onEvent));
        if (userId) {
          const userCh = pusher.subscribe(`private-user-${userId}`);
          userCh.bind("notification.created", (env: { data?: unknown }) => {
            dispatchRealtime("notification.created", env.data);
            qc.invalidateQueries({ queryKey: ["notifications"] });
          });
        }
      } catch (error) {
        console.warn("[realtime] disabled:", error);
      }
    })();

    function handleEvent(type: string, data?: Record<string, unknown>) {
      const projectId = typeof data?.projectId === "string" ? data.projectId : undefined;
      const taskId = typeof data?.id === "string" && /task/.test(type) ? data.id : undefined;
      if (type === "notification.created") {
        qc.invalidateQueries({ queryKey: ["notifications"] });
        return;
      }
      if (projectId) {
        qc.invalidateQueries({ queryKey: ["board", orgId, projectId] });
        qc.invalidateQueries({ queryKey: ["tasks", orgId, projectId] });
        if (taskId) qc.invalidateQueries({ queryKey: ["task", orgId, projectId, taskId] });
      }
      if (type.startsWith("message.") || type === "conversation.created") {
        const cid = typeof data?.conversationId === "string" ? data.conversationId : undefined;
        qc.invalidateQueries({ queryKey: ["conversations", orgId] });
        if (cid) qc.invalidateQueries({ queryKey: ["messages", orgId, cid] });
      }
      if (type.startsWith("sprint.")) qc.invalidateQueries({ queryKey: ["sprints", orgId] });
      if (type.startsWith("milestone")) qc.invalidateQueries({ queryKey: ["milestones", orgId] });
      if (type.startsWith("project.")) qc.invalidateQueries({ queryKey: ["projects", orgId] });
      dispatchRealtime(type, data);
    }

    return () => {
      disposed = true;
      pusherInstance?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, userId, runtimeConfig.data]);

  return <>{children}</>;
}

/** Empty event bus reference for typing/presence pages. */
export const REAL_TIME_EVENTS = Object.freeze({
  typing: "typing",
  presence: "presence",
  messageCreated: "message.created",
} as const);

export function useRealtimeListener(type: string, handler: (data: unknown) => void) {
  React.useEffect(() => {
    const fn = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === type || e.type === `nexora:${type}`) handler(detail?.data);
    };
    const eventName = `nexora:${type}`;
    window.addEventListener(eventName, fn);
    return () => window.removeEventListener(eventName, fn);
  }, [type, handler]);
}

// Silence unused warnings for the qk import when tree-shaken builds complain.
void qk;
void dispatchRealtime;
