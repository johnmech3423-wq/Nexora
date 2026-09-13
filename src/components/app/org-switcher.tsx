"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { useOrgStore } from "@/lib/org-store";
import { qk } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function OrgSwitcher() {
  const router = useRouter();
  const qc = useQueryClient();
  const { options, activeOrgId, setActiveOrgId } = useOrgStore();
  const active = options.find((o) => o.id === activeOrgId) ?? options[0];

  if (!active) return null;

  const switchOrg = async (orgId: string) => {
    if (orgId === activeOrgId) return;
    setActiveOrgId(orgId);
    // Bump every org-scoped cache so no other tenant's data can flash.
    qc.removeQueries({ queryKey: ["org"], predicate: undefined });
    qc.invalidateQueries();
    router.push(`/dashboard?org=${orgId}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary/60 data-[state=open]:bg-white/5">
        <OrgAvatar name={active.name} logoUrl={active.logoUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-sidebar-foreground">
            {active.name}
          </span>
          <span className="block text-[11px] text-sidebar-foreground/50">
            {planLabel(active.plan)} · {active.memberCount} member{active.memberCount === 1 ? "" : "s"}
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/40" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" sideOffset={8} className="w-72">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {options.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => void switchOrg(org.id)}
            className="gap-2.5 py-2"
          >
            <OrgAvatar name={org.name} logoUrl={org.logoUrl} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{org.name}</span>
              <span className="block text-xs text-muted-foreground capitalize">{org.myRole}</span>
            </span>
            {org.id === activeOrgId ? <Check className="size-4 text-primary" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/onboarding")} className="gap-2">
          <Plus className="text-muted-foreground" /> Create workspace
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(`/settings/general?org=${activeOrgId}`)} className="gap-2">
          <Settings className="text-muted-foreground" /> Workspace settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OrgAvatar({ name, logoUrl, size = "sm" }: { name: string; logoUrl: string | null; size?: "sm" | "md" }) {
  return (
    <span className={cn("relative inline-flex shrink-0 overflow-hidden rounded-md", size === "md" ? "size-8" : "size-7")}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span
          aria-hidden
          className="flex size-full items-center justify-center bg-primary/15 text-xs font-bold text-primary dark:bg-primary/25"
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function planLabel(plan: string): string {
  if (plan === "business") return "Business";
  if (plan === "pro") return "Pro";
  return "Free";
}

/** Fetch the orgs for the create-org page (lightweight typed helper). */
export async function fetchOrgList() {
  return apiFetch<{ organizations: Awaited<ReturnType<typeof useOrgStore.getState>["options"]> }>(
    "/api/organizations"
  );
}
void qk;
