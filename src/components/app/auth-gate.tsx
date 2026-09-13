"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMe, useOrganizations } from "@/lib/hooks/use-session";
import { useOrgStore } from "@/lib/org-store";

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

/** Returns the server-computed platform-admin flag from the authenticated user payload. */
export function useIsPlatformAdmin(): boolean {
  const me = useMe();
  return Boolean(me.data?.user?.isPlatformAdmin);
}

/** Keeps analytics fetching honest: refresh count used by nav badge caches. */
export function useOrgBump() {
  return useOrgStore((s) => s.bump);
}
