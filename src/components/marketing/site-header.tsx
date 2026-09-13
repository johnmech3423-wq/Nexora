"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Check, Menu, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NexoraMark } from "@/components/marketing/logo";

export const SITE_NAV = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/about", label: "About" },
] as const;

const REGISTER_HREF = "/register?next=%2Fdashboard";
const LOGIN_HREF = "/login?next=%2Fdashboard";

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const current = theme ?? "system";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change color theme" className="text-muted-foreground">
          <Monitor className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuItem
          role="menuitemradio"
          aria-checked={current === "system"}
          className="gap-2"
          onSelect={() => setTheme("system")}
        >
          <Monitor className="size-4 text-muted-foreground" aria-hidden />
          System
          {current === "system" ? <Check className="ml-auto size-3.5 text-primary" aria-hidden /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          role="menuitemradio"
          aria-checked={current === "light"}
          className="gap-2"
          onSelect={() => setTheme("light")}
        >
          <Sun className="size-4 text-muted-foreground" aria-hidden />
          Light
          {current === "light" ? <Check className="ml-auto size-3.5 text-primary" aria-hidden /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          role="menuitemradio"
          aria-checked={current === "dark"}
          className="gap-2"
          onSelect={() => setTheme("dark")}
        >
          <Moon className="size-4 text-muted-foreground" aria-hidden />
          Dark
          {current === "dark" ? <Check className="ml-auto size-3.5 text-primary" aria-hidden /> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 font-bold tracking-tight" aria-label="Nexora home">
          <NexoraMark />
          <span className="text-[15px]">nexora</span>
        </Link>

        <nav aria-label="Primary" className="ml-6 hidden items-center gap-1 md:flex">
          {SITE_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeMenu />
          <Link
            href={LOGIN_HREF}
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href={REGISTER_HREF}
            className="hidden rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            Get started
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[300px] flex-col gap-0 p-0">
              <SheetTitle className="sr-only">Site menu</SheetTitle>
              <div className="flex h-16 items-center gap-2 border-b px-4">
                <NexoraMark />
                <span className="font-bold tracking-tight">nexora</span>
              </div>
              <nav aria-label="Mobile" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
                {SITE_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      pathname === item.href ? "bg-accent text-accent-foreground" : "text-foreground/90 hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="space-y-2 border-t p-4">
                <Link
                  href={LOGIN_HREF}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Log in
                </Link>
                <Link
                  href={REGISTER_HREF}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Get started
                </Link>
                <p className="pt-1 text-center text-xs text-muted-foreground">
                  The public pages don&apos;t require an account.
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
