"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMe, useOrganizations } from "@/lib/hooks/use-session";
import { useOrgStore } from "@/lib/org-store";
import { apiFetch } from "@/lib/api-client";

/** Redirects unauthenticated users to /login; renders a branded splash while checking. */
export function AuthGate({ children, redirectTo = "/login" }: { children: React.ReactNode; redirectTo?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const orgs = useOrganizations();
  const { setOptions, activeOrgId, setActiveOrgId } = useOrgStore();

  React.useEffect(() => {
    if (!me.isLoading && (me.isError || !me.data)) {
      router.replace(`${redirectTo}?next=${encodeURIComponent(pathname)}`);
    }
  }, [me.isLoading, me.isError, me.data, router, pathname, redirectTo]);

  // Mirror orgs into the store and restore the persisted tenant.
  React.useEffect(() => {
    if (orgs.data?.length) {
      setOptions(orgs.data);
      if (!activeOrgId) {
        let stored: string | null = null;
        try {
          stored = localStorage.getItem("nexora.activeOrgId");
        } catch {
          /* ignore */
        }
        const valid = orgs.data.some((o) => o.id === stored) ? stored : orgs.data[0].id;
        if (valid) setActiveOrgId(valid);
      }
    }
  }, [orgs.data, setOptions, setActiveOrgId, activeOrgId]);

  const loading = me.isLoading || (orgs.isLoading && !orgs.data);
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            N
          </span>
          Nexora
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading your workspace…
        </p>
      </div>
    );
  }
  if (me.isError || !me.data) return null;
  return <>{children}</>;
}

/** Admin gate — probes the platform-admin endpoint; only admins pass. */
export function useIsPlatformAdmin(): boolean {
  const me = useMe();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [checked, setChecked] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    if (!me.data) return;
    apiFetch("/api/admin/overview", { skipAuthRedirect: true })
      .then(() => alive && setIsAdmin(true))
      .catch(() => alive && setIsAdmin(false))
      .finally(() => alive && setChecked(true));
    return () => {
      alive = false;
    };
  }, [me.data]);
  void checked;
  return isAdmin;
}

/** Keeps analytics fetching honest: refresh count used by nav badge caches. */
export function useOrgBump() {
  return useOrgStore((s) => s.bump);
}
