"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { cn } from "@/lib/utils";
import type { ProjectDetailDTO } from "@/types";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/board", label: "Board" },
  { href: "/sprints", label: "Sprints" },
  { href: "/milestones", label: "Milestones" },
] as const;

export function ProjectTabs() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const orgId = useActiveOrgId();
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const detail = useQuery({
    queryKey: qk.project(orgId ?? "x", projectId),
    queryFn: () => apiFetch<{ project: ProjectDetailDTO }>(`/api/projects/${projectId}?orgId=${orgId}`),
    enabled: Boolean(orgId),
  });
  const isManager = detail.data?.project.myRole === "manager";

  const segment = pathname.replace(base, "").split("/")[1] ?? "";
  const activeHref = (href: string) => (href === "" ? segment === "" : segment === href.replace("/", ""));

  return (
    <nav aria-label="Project sections" className="flex gap-0.5 overflow-x-auto border-b pb-px">
      {TABS.map((t) => (
        <Link
          key={t.label}
          href={`${base}${t.href}`}
          aria-current={activeHref(t.href) ? "page" : undefined}
          className={cn(
            "rounded-t-md border-b-2 px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors",
            activeHref(t.href)
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
      {isManager ? (
        <Link
          href={`${base}/settings`}
          aria-current={segment === "settings" ? "page" : undefined}
          className={cn(
            "rounded-t-md border-b-2 px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors",
            segment === "settings"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          )}
        >
          Settings
        </Link>
      ) : null}
    </nav>
  );
}
