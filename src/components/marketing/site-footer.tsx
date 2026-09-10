import Link from "next/link";
import { NexoraMark } from "@/components/marketing/logo";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/security", label: "Security" },
    ],
  },
  {
    heading: "Company",
    links: [{ href: "/about", label: "About" }],
  },
  {
    heading: "Resources",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/register", label: "Create account" },
    ],
  },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div className="max-w-sm space-y-4">
            <Link href="/" className="inline-flex items-center gap-2 font-bold tracking-tight" aria-label="Nexora home">
              <NexoraMark />
              <span className="text-[15px]">nexora</span>
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A multi-tenant project workspace — projects, tasks, sprints, chat and analytics in one place, built as a
              production-oriented SaaS architecture.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{col.heading}</h2>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="rounded text-sm text-foreground/80 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Nexora. All rights reserved.</p>
          <p>Next.js · TypeScript · MongoDB · designed for Vercel deployment.</p>
        </div>
      </div>
    </footer>
  );
}
