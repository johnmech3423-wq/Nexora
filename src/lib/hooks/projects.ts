"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";

export function useArchiveProject(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, archived }: { projectId: string; archived: boolean }) =>
      apiFetch(`/api/projects/${projectId}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects(orgId) });
    },
  });
}

export function useFavoriteProject(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch(`/api/projects/${projectId}/favorite`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", orgId] });
      qc.invalidateQueries({ queryKey: ["project", orgId] });
    },
  });
}

export function useDeleteProject(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => apiFetch(`/api/projects/${projectId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects(orgId) });
    },
  });
}
