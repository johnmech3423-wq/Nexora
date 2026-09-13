"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  setTriggerRef: (node: HTMLElement | null) => void;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

export function Popover({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const setTriggerRef = React.useCallback((node: HTMLElement | null) => {
    triggerRef.current = node;
  }, []);
  const setOpen = React.useCallback((next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);

  return <PopoverContext.Provider value={{ open, setOpen, triggerRef, setTriggerRef }}>{children}</PopoverContext.Provider>;
}

export const PopoverAnchor = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export const PopoverTrigger = React.forwardRef<
  HTMLElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ asChild, children, onClick, ...props }, forwardedRef) => {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("PopoverTrigger must be used inside Popover");

  const setRefs = (node: HTMLElement | null) => {
    ctx.setTriggerRef(node);

    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  if (asChild) {
    const child = React.Children.only(children) as React.ReactElement<{
      onClick?: (event: React.MouseEvent<HTMLElement>) => void;
      className?: string;
    }>;

    const childOnClick = child.props.onClick;

    return React.cloneElement(child, {
      ...props,
      ref: setRefs,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        childOnClick?.(event);

        if (!event.defaultPrevented) {
          ctx.setOpen(!ctx.open);
        }
      },
      "aria-expanded": ctx.open,
    } as never);
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);

    if (!event.defaultPrevented) {
      ctx.setOpen(!ctx.open);
    }
  };

  return (
    <button
      type="button"
      {...props}
      ref={setRefs}
      onClick={handleClick}
    >
      {children}
    </button>
  );
});

PopoverTrigger.displayName = "PopoverTrigger";

export const PopoverContent = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end"; sideOffset?: number }>(
  ({ className, align = "center", sideOffset = 6, style, children, ...props }, ref) => {
    const ctx = React.useContext(PopoverContext);
    const localContentRef = React.useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = React.useState<React.CSSProperties>({ left: "50%", top: "50%", transform: "translate(-50%, -50%)" });

    React.useEffect(() => {
      if (!ctx?.open) return;
      const update = () => {
        const rect = ctx.triggerRef.current?.getBoundingClientRect();
        if (!rect) {
          setPosition({ left: "50%", top: "50%", transform: "translate(-50%, -50%)" });
          return;
        }
        const estimatedWidth = 320;
        let left = align === "end" ? rect.right - estimatedWidth : align === "start" ? rect.left : rect.left + rect.width / 2 - estimatedWidth / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - estimatedWidth - 8));
        let top = rect.bottom + sideOffset;
        if (top > window.innerHeight - 80) top = Math.max(8, rect.top - sideOffset - 320);
        setPosition({ left, top, transform: "none" });
      };
      update();
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, true);
      return () => {
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
      };
    }, [align, ctx?.open, ctx?.triggerRef, sideOffset]);

    React.useEffect(() => {
      if (!ctx?.open) return;
      const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") ctx.setOpen(false); };
      const onPointerDown = (event: PointerEvent) => {
        const target = event.target as Node;
        const trigger = ctx.triggerRef.current;
        if (localContentRef.current?.contains(target) || trigger?.contains(target)) return;
        ctx.setOpen(false);
      };
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("pointerdown", onPointerDown);
      return () => { document.removeEventListener("keydown", onKeyDown); document.removeEventListener("pointerdown", onPointerDown); };
    }, [ctx?.open, ctx?.setOpen, ctx?.triggerRef]);

    if (!ctx?.open || typeof document === "undefined") return null;
    return createPortal(
      <div
        ref={(node) => {
          localContentRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        data-nexora-popover-content="true"
        role="dialog"
        {...props}
        style={{ ...position, ...style }}
        className={cn("fixed z-50 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg outline-none", className)}
      >
        {children}
      </div>,
      document.body
    );
  }
);
PopoverContent.displayName = "PopoverContent";
