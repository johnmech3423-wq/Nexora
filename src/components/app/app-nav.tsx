"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Bell, CalendarDays, Clock3, Files, FolderKanban, Home, ListChecks, MessagesSquare, Settings, Sparkles, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { useIsPlatformAdmin } from "@/components/app/auth-gate";
import { ShieldCheck } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: "workspace" | "manage" | "admin";
  adminOnly?: boolean;
}

const baseNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, section: "workspace" },
  { href: "/projects", label: "Projects", icon: FolderKanban, section: "workspace" },
  { href: "/tasks", label: "My tasks", icon: ListChecks, section: "workspace" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, section: "workspace" },
  { href: "/chat", label: "Chat", icon: MessagesSquare, section: "workspace" },
  { href: "/notifications", label: "Notifications", icon: Bell, section: "workspace" },
  { href: "/files", label: "Files", icon: Files, section: "workspace" },
  { href: "/time", label: "Time", icon: Clock3, section: "workspace" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, section: "workspace" },
  { href: "/ai", label: "AI Assistant", icon: Sparkles, section: "workspace" },
  { href: "/activity", label: "Activity", icon: Activity, section: "workspace" },
];

const manageNav: NavItem[] = [
  { href: "/settings/general", label: "Settings", icon: Settings, section: "manage" },
];


/** Unread chat total shown on the nav item (shares cache with /chat). */
function useChatUnread(orgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["conversations", orgId ?? "x"],
    queryFn: async () => {
      const data = await apiFetch<{ items: { unreadCount: number }[] }>(
        `/api/chat/conversations?orgId=${orgId}`
      );
      return data.items.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0);
    },
    enabled: Boolean(orgId) && enabled,
    refetchInterval: 60_000,
  });
}

function SectionLink({ item, orgId }: { item: NavItem; orgId: string | null }) {
  const pathname = usePathname();
  const href = item.href === "/dashboard" ? `/dashboard?org=${orgId ?? ""}` : orgId ? item.href : item.href;
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const chatUnread = useChatUnread(orgId, item.href === "/chat" && !isActive);
  const Icon = item.icon;
  const badge = item.href === "/chat" ? (chatUnread.data ?? 0) : 0;
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        isActive
          ? "bg-white/10 text-white"
          : "text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
      {badge > 0 ? (
        <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const orgId = useActiveOrgId();
  const isAdmin = useIsPlatformAdmin();
  void orgId;

  const adminNav: NavItem[] = isAdmin
    ? [{ href: "/admin", label: "Platform admin", icon: ShieldCheck, section: "admin", adminOnly: true }]
    : [];

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-3">
      <div>
        <p className="px-2 pb-1 text-[10px] font-semibold tracking-widest text-sidebar-foreground/35 uppercase">
          Workspace
        </p>
        <div className="space-y-0.5">
          {baseNav.map((item) => (
            <div key={item.href} onClick={onNavigate}>
              <SectionLink item={item} orgId={orgId} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="px-2 pb-1 text-[10px] font-semibold tracking-widest text-sidebar-foreground/35 uppercase">
          Manage
        </p>
        <div className="space-y-0.5">
          {manageNav.map((item) => (
            <div key={item.href} onClick={onNavigate}>
              <SectionLink item={item} orgId={orgId} />
            </div>
          ))}
        </div>
      </div>
      {adminNav.length ? (
        <div>
          <p className="px-2 pb-1 text-[10px] font-semibold tracking-widest text-sidebar-foreground/35 uppercase">
            Admin
          </p>
          <div className="space-y-0.5">
            {adminNav.map((item) => (
              <div key={item.href} onClick={onNavigate}>
                <SectionLink item={item} orgId={orgId} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
