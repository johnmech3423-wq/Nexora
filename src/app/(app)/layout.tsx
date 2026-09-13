import { AuthGate } from "@/components/app/auth-gate";
import { AppShell } from "@/components/app/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
