import * as React from "react";
import { cn, initials, hashHue } from "@/lib/utils";

function AvatarInner({
  name,
  src,
  className,
  textClassName,
  title,
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
  textClassName?: string;
  title?: string;
}) {
  const hue = hashHue(name ?? "");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={title ?? name ?? ""}
        loading="lazy"
        className={cn("size-full rounded-[inherit] object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-full items-center justify-center rounded-[inherit] text-[0.55em] font-semibold text-white select-none",
        className
      )}
      style={{ backgroundColor: `hsl(${hue} 62% 48%)` }}
    >
      <span className={textClassName}>{initials(name)}</span>
    </span>
  );
}

/** Avatar sized by parent's font-size conventions; size prop picks from scale. */
export function Avatar({
  name,
  src,
  size = "md",
  className,
  title,
}: {
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  title?: string;
}) {
  const sizeCls = {
    xs: "size-5 text-[9px]",
    sm: "size-6 text-[10px]",
    md: "size-8 text-[11px]",
    lg: "size-10 text-xs",
    xl: "size-14 text-base",
  }[size];
  return (
    <span
      title={title ?? name ?? undefined}
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full align-middle ring-1 ring-black/5 dark:ring-white/10",
        sizeCls,
        className
      )}
    >
      <AvatarInner name={name} src={src} className={sizeCls} title={title} />
    </span>
  );
}

/** Overlapping avatar group. */
export function AvatarGroup({
  items,
  max = 4,
  size = "sm",
}: {
  items: { name: string | null; avatarUrl?: string | null }[];
  max?: number;
  size?: "xs" | "sm" | "md";
}) {
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  const sizeCls = { xs: "size-6", sm: "size-7", md: "size-8" }[size];
  return (
    <span className="flex -space-x-1.5">
      {shown.map((u, i) => (
        <Avatar key={i} name={u.name} src={u.avatarUrl} size={size} className={cn("ring-2 ring-card", sizeCls)} />
      ))}
      {extra > 0 ? (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground ring-2 ring-card",
            sizeCls
          )}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
