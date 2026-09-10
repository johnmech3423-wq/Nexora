import { Building2 } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted/25 px-4 py-10">
      <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm" aria-hidden>
          <Building2 className="size-4" />
        </span>
        Nexora
      </div>
      {children}
      <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        Plan projects, track tasks and ship together with your team.
      </p>
    </main>
  );
}
