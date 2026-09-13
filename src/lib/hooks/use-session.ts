"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useOrgStore, type OrgOption } from "@/lib/org-store";
import type { UserDTO } from "@/types";

/** Current signed-in user (+ session info). */
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => apiFetch<{ user: UserDTO; session: { id: string; expiresAt: string } }>("/api/auth/me"),
    staleTime: 5 * 60_000,
  });
}

/** Organizations the user belongs to, mirrored into the org store. */
export function useOrganizations() {
  const setOptions = useOrgStore((s) => s.setOptions);
  return useQuery({
    queryKey: qk.orgList,
    queryFn: async () => {
      const data = await apiFetch<{ organizations: OrgOption[] }>("/api/organizations");
      setOptions(data.organizations);
      return data.organizations;
    },
    staleTime: 2 * 60_000,
  });
}

/** Active org id from the store (restored during bootstrap). */
export function useActiveOrgId(): string | null {
  return useOrgStore((s) => s.activeOrgId);
}

export function useActiveOrg() {
  const orgs = useOrganizations();
  const activeOrgId = useActiveOrgId();
  return {
    orgs: orgs.data ?? [],
    activeOrg: orgs.data?.find((o) => o.id === activeOrgId) ?? orgs.data?.[0] ?? null,
    activeOrgId: (orgs.data?.find((o) => o.id === activeOrgId) ?? orgs.data?.[0])?.id ?? null,
    isLoading: orgs.isLoading,
  };
}

/** Bootstrap: me + org list + persisted-tenant restore. */
export function useBootstrap() {
  const me = useMe();
  const orgs = useOrganizations();
  const { setActiveOrgId } = useOrgStore.getState();
  const activeOrgId = useActiveOrgId();
  const query = useQuery({
    queryKey: ["bootstrap", activeOrgId],
    queryFn: async () => {
      const list = await apiFetch<{ organizations: OrgOption[] }>("/api/organizations");
      if (!activeOrgId) {
        let stored: string | null = null;
        try {
          stored = localStorage.getItem("nexora.activeOrgId");
        } catch {
          /* ignore */
        }
        const valid = list.organizations.some((o) => o.id === stored)
          ? stored
          : list.organizations[0]?.id ?? null;
        if (valid) setActiveOrgId(valid);
      }
      return list.organizations;
    },
    enabled: !orgs.data && !orgs.isLoading,
  });
  return {
    loading: me.isLoading || (orgs.isLoading && !orgs.data),
    error: me.error ?? query.error ?? null,
    user: me.data?.user ?? null,
  };
}

export interface ActiveOrgCtx {
  orgId: string;
  role: string;
  plan: string;
}
