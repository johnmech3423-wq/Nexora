"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut, Moon, Settings, Shield, Sun, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { useMe, useActiveOrgId } from "@/lib/hooks/use-session";
import { useThemeToggle } from "@/components/theme-toggle";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

export function UserMenu() {
  const me = useMe();
  const orgId = useActiveOrgId();
  const router = useRouter();
  const qc = useQueryClient();
  const { resolvedTheme, setTheme } = useThemeToggle();
  const user = me.data?.user;

  if (!user) return null;

  const signOut = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* session may already be gone */
    }
    qc.clear();
    router.replace("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label="Account menu"
        >
          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-sidebar-foreground">{user.name}</span>
            <span className="block truncate text-[11px] text-sidebar-foreground/50">{user.email}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" sideOffset={8} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(`/settings/profile`)}>
          <UserRound /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(`/settings/security`)}>
          <Shield /> Security
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(`/settings/billing?org=${orgId ?? ""}`)}>
          <CreditCard /> Billing
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun /> : <Moon />}
          Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(`/settings/general?org=${orgId ?? ""}`)}>
          <Settings /> Workspace settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()} danger>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MobileUserMenuLink() {
  const me = useMe();
  const user = me.data?.user;
  if (!user) return null;
  return (
    <Link
      href="/settings/profile"
      className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/5"
    >
      <Avatar name={user.name} src={user.avatarUrl} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-sidebar-foreground">{user.name}</span>
        <span className="block truncate text-xs text-sidebar-foreground/50">{user.email}</span>
      </span>
    </Link>
  );
}

export function signOutAndToast(): Promise<void> {
  return toast.promise(
    (async () => {
      await apiFetch("/api/auth/logout", { method: "POST" });
      // Full reload intentional to clear all client state after logout
      window.location.href = "/login";
    })(),
    { loading: "Signing out…", success: "Signed out", error: "Could not sign out" }
  ) as never;
}
