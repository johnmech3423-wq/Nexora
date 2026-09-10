import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Plan-gated card shown when the backend answers 402/plan_required. */
export function PlanGateCard({
  title = "This is a Pro feature",
  description,
  orgId,
  compact,
}: {
  title?: string;
  description?: string;
  orgId: string | null;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      className={`flex flex-col items-start gap-3 rounded-lg border border-dashed bg-card/60 p-5 ${compact ? "py-4" : ""}`}
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description ??
            "Upgrade to Pro to unlock deeper analytics — trends, workload, distributions and team velocity. Your data stays private and ready the moment you upgrade."}
        </p>
      </div>
      <Button asChild size="sm">
        <Link href={`/settings/billing?org=${orgId ?? ""}`}>Upgrade to Pro</Link>
      </Button>
    </div>
  );
}
