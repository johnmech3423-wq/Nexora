"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, LayoutGrid, ShieldCheck, Terminal, User as UserIcon, Users, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";

/** Visible settings destinations. Extended as more settings modules ship. */
const SETTINGS_SECTIONS = [
  { group: "Account", items: [
    { href: "/settings/profile", label: "Profile", icon: UserIcon },
    { href: "/settings/security", label: "Security", icon: ShieldCheck },
  ]},
  { group: "Workspace", items: [
    { href: "/settings/general", label: "General", icon: LayoutGrid },
    { href: "/settings/members", label: "Members", icon: Users },
    { href: "/settings/billing", label: "Billing", icon: CreditCard },
    { href: "/settings/webhooks", label: "Webhooks", icon: Webhook },
    { href: "/settings/api", label: "API", icon: Terminal },
  ]},
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <aside className="shrink-0 lg:sticky lg:top-6 lg:w-52">
        <nav aria-label="Settings" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-4 lg:overflow-visible lg:pb-0">
          {SETTINGS_SECTIONS.map((section) => (
            <div key={section.group} className="shrink-0">
              <p className="hidden px-2 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase lg:block">
                {section.group}
              </p>
              <div className="flex gap-0.5 lg:flex-col lg:gap-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
