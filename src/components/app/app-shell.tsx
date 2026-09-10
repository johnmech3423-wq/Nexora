"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { AppNav } from "@/components/app/app-nav";
import { UserMenu, MobileUserMenuLink } from "@/components/app/user-menu";
import { NotificationBell } from "@/components/app/notifications-center";
import { GlobalSearch } from "@/components/app/global-search";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RealtimeProvider } from "@/components/app/realtime-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <RealtimeProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar (always dark — Nexora identity) */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
          <div className="flex h-14 items-center gap-2 px-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-white">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-extrabold text-primary-foreground">
                N
              </span>
              nexora
            </Link>
          </div>
          <div className="px-2.5 pb-1">
            <OrgSwitcher />
          </div>
          <AppNav />
          <div className="border-t border-white/5 p-2.5">
            <UserMenu />
          </div>
        </aside>

        {/* Mobile header */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-extrabold text-primary-foreground">
              N
            </span>
            nexora
          </Link>
          <div className="ml-auto flex items-center gap-0.5">
            <GlobalSearch />
            <NotificationBell />
          </div>
        </header>

        {/* Main content */}
        <div className="lg:pl-[250px]">
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8" id="main">
            {children}
          </main>
        </div>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex w-[290px] flex-col gap-0 bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-foreground/70">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-14 items-center justify-between px-4">
              <span className="flex items-center gap-2 text-[15px] font-bold text-white">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-extrabold text-primary-foreground">
                  N
                </span>
                nexora
              </span>
              <Button variant="ghost" size="icon" aria-label="Close navigation" className="text-sidebar-foreground/70" onClick={() => setMobileOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
            <div className="px-2.5 pt-1">
              <OrgSwitcher />
            </div>
            <AppNav onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-white/5 p-3">
              <MobileUserMenuLink />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </RealtimeProvider>
  );
}
