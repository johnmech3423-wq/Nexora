"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";

/** Board moves: invalidate board + task + project counters. */
function invalidateTaskCaches(qc: ReturnType<typeof useQueryClient>, orgId: string, projectId: string) {
  qc.invalidateQueries({ queryKey: qk.board(orgId, projectId) });
  qc.invalidateQueries({ queryKey: qk.tasks(orgId, projectId) });
  qc.invalidateQueries({ queryKey: qk.project(orgId, projectId) });
  qc.invalidateQueries({ queryKey: qk.projects(orgId) });
}

export function useMoveTask(orgId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status, position }: { taskId: string; status: string; position: number }) =>
      apiFetch(`/api/projects/${projectId}/tasks/move`, {
        method: "POST",
        body: JSON.stringify({ taskId, status, position }),
      }),
    onSuccess: () => invalidateTaskCaches(qc, orgId, projectId),
  });
}

export function useUpdateTask(orgId: string, projectId: string, taskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiFetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      if (taskId) qc.invalidateQueries({ queryKey: qk.task(orgId, projectId, taskId) });
      invalidateTaskCaches(qc, orgId, projectId);
    },
  });
}

export function useWatchTask(orgId: string, projectId: string, taskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (watching: boolean) =>
      apiFetch(`/api/projects/${projectId}/tasks/${taskId}/watchers`, {
        method: "POST",
        body: JSON.stringify({ watching }),
      }),
    onSuccess: () => {
      if (taskId) qc.invalidateQueries({ queryKey: qk.task(orgId, projectId, taskId) });
      qc.invalidateQueries({ queryKey: qk.board(orgId, projectId) });
    },
  });
}

export function useDeleteTask(orgId: string, projectId: string, taskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => invalidateTaskCaches(qc, orgId, projectId),
  });
}

export { invalidateTaskCaches };
