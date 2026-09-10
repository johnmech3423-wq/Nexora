"use client";

import * as React from "react";
import { MessageCirclePlus, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared responsive frame for chat pages:
 * - md+: conversation rail (fixed width) + detail pane side by side.
 * - mobile: only one pane visible at a time (index → rail, conversation → thread).
 */
export function ChatWorkspace({
  rail,
  detail,
  railVisibleOnMobile = true,
}: {
  rail: React.ReactNode;
  detail: React.ReactNode;
  railVisibleOnMobile?: boolean;
}) {
  return (
    <div className="flex h-[calc(100dvh-6.75rem)] min-h-[440px] flex-col gap-3 md:h-[calc(100dvh-7.25rem)] md:flex-row md:gap-4">
      <section
        aria-label="Conversations"
        className={
          "min-h-0 flex-1 overflow-hidden rounded-xl border bg-card md:flex-none md:basis-[330px] " +
          (railVisibleOnMobile ? "flex" : "hidden md:flex")
        }
      >
        {rail}
      </section>
      <section
        aria-label="Conversation"
        className={"min-h-0 flex-1 overflow-hidden rounded-xl border bg-card " + (railVisibleOnMobile ? "hidden md:flex" : "flex")}
      >
        {detail}
      </section>
    </div>
  );
}

/** Desktop placeholder shown on /chat when no conversation is open. */
export function ChatEmptyDetail({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
        <MessagesSquare className="size-6 text-primary" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold">Your messages</p>
        <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted-foreground">
          Pick a conversation on the left, or start a direct message, group, or project channel.
        </p>
      </div>
      <Button size="sm" onClick={onNew} className="mt-1">
        <MessageCirclePlus /> New conversation
      </Button>
    </div>
  );
}
