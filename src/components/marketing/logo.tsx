import Link from "next/link";
import { cn } from "@/lib/utils";

/** Nexora brand mark used across public pages — matches the in-app identity. */
export function NexoraMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-extrabold text-primary-foreground",
        className
      )}
    >
      N
    </span>
  );
}

export function NexoraLogo({
  href = "/",
  className,
  markClassName,
  inverted = false,
}: {
  href?: string;
  className?: string;
  markClassName?: string;
  /** For dark-on-light contrast variants where the wordmark must be white. */
  inverted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 text-[15px] font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        inverted ? "text-white" : "text-foreground",
        className
      )}
      aria-label="Nexora home"
    >
      <NexoraMark className={markClassName} />
      nexora
    </Link>
  );
}
