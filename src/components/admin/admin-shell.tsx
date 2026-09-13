"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  Building2,
  Check,
  LayoutDashboard,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Settings2,
  Sun,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { useMe } from "@/lib/hooks/use-session";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NexoraMark } from "@/components/marketing/logo";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/organizations", label: "Organizations", icon: Building2, exact: false },
  { href: "/admin/settings", label: "Settings", icon: Settings2, exact: false },
] as const;

function AdminThemeMenu() {
  const { theme, setTheme } = useTheme();
  const current = theme ?? "system";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label="Change color theme"
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Monitor className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        {([
          { key: "light", label: "Light", icon: Sun },
          { key: "dark", label: "Dark", icon: Moon },
          { key: "system", label: "System", icon: Monitor },
        ] as const).map((item) => (
          <DropdownMenuItem
            key={item.key}
            role="menuitemradio"
            aria-checked={current === item.key}
            className="gap-2"
            onSelect={() => setTheme(item.key)}
          >
            <item.icon className="size-4 text-muted-foreground" aria-hidden />
            {item.label}
            {current === item.key ? <Check className="ml-auto size-3.5 text-primary" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminSplash({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background">
      <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <NexoraMark className="size-7 text-sm" />
        nexora
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {label}
      </p>
    </div>
  );
}

function ForbiddenState() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldCheck className="size-6" aria-hidden />
      </span>
      <h1 className="text-xl font-bold tracking-tight">Restricted area</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Platform administration is limited to authorized personnel. If you believe this is a mistake, sign in with the
        account you were granted access with.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="size-4" aria-hidden /> Back to the app
        </Link>
        <Link href="/login" className={buttonVariants({ size: "sm" })}>
          Sign in with another account
        </Link>
      </div>
    </div>
  );
}

function ProbeErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <h1 className="text-xl font-bold tracking-tight">Couldn&apos;t verify admin access</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        The platform service didn&apos;t respond as expected. Try again — nothing was changed.
      </p>
      <button type="button" onClick={onRetry} className={buttonVariants({ size: "sm" })}>
        Try again
      </button>
    </div>
  );
}

/**
 * Platform-admin gate + shell. Gate ordering:
 *   1. session check (me)        → splash, then safe /login?next=… redirect when anon
 *   2. admin probe (real API)    → 403 view for authenticated non-admins
 *   3. authorized                → dedicated control-plane shell + children
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const me = useMe();
  const user = me.data?.user;

  const signOut = React.useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST", skipAuthRedirect: true });
    } catch {
      /* session may already be gone */
    }
    qc.clear();
    router.replace("/login");
  }, [qc, router]);

  // Anonymous / expired session → the standard safe login flow.
  React.useEffect(() => {
    if (!me.isLoading && (me.isError || !me.data)) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [me.isLoading, me.isError, me.data, router, pathname]);

  const probe = useQuery({
    queryKey: ["admin", "probe"],
    queryFn: async () => {
      try {
        await apiFetch("/api/admin/overview", { skipAuthRedirect: true });
        return true;
      } catch (error) {
        // Authenticated but not an allowlisted platform admin → the explicit restricted state.
        if (error instanceof ApiClientError && error.status === 403) return false;
        throw error;
      }
    },
    retry: (failureCount, error) =>
      error instanceof ApiClientError && error.status === 403 ? false : failureCount < 1,
    enabled: Boolean(me.data),
    staleTime: 5 * 60_000,
  });

  if (!me.data) return <AdminSplash label="Checking access…" />;
  if (probe.isLoading || (probe.isFetching && !probe.data)) return <AdminSplash label="Verifying platform access…" />;
  if (probe.isError) return <ProbeErrorState onRetry={() => void probe.refetch()} />;
  if (probe.data !== true) return <ForbiddenState />;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Platform admin home"
          >
            <NexoraMark />
            <span className="text-[15px]">nexora</span>
            <Badge variant="outline" className="ml-1 hidden text-[10px] sm:inline-flex">
              Platform Admin
            </Badge>
          </Link>
          <nav aria-label="Platform admin" className="ml-4 hidden items-center gap-0.5 md:flex">
            {ADMIN_NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <AdminThemeMenu />
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className="flex items-center gap-2 rounded-md p-1 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Admin account menu"
              >
                <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-64">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-medium">{user?.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => router.push("/dashboard")}
                  className="gap-2"
                >
                  <ArrowLeft className="size-4" aria-hidden /> Back to the app
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void signOut()}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" aria-hidden /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Mobile nav */}
        <nav aria-label="Platform admin" className="border-t px-2 md:hidden">
          <div className="mx-auto flex w-full max-w-6xl gap-0.5 overflow-x-auto">
            {ADMIN_NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Nexora platform console · internal administration
      </footer>
    </div>
  );
}
