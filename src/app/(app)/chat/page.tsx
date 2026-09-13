"use client";

import * as React from "react";
import { ConversationList } from "@/components/features/chat/conversation-list";
import { ChatEmptyDetail, ChatWorkspace } from "@/components/features/chat/chat-workspace";
import { NewConversationDialog } from "@/components/features/chat/new-conversation";

/**
 * /chat — the conversations rail.
 * On desktop the rail sits next to a placeholder pane; opening a
 * conversation routes to /chat/[id], which keeps the same rail.
 */
export default function ChatIndexPage() {
  const [newOpen, setNewOpen] = React.useState(false);
  return (
    <>
      <ChatWorkspace
        rail={<ConversationList onNew={() => setNewOpen(true)} />}
        detail={<ChatEmptyDetail onNew={() => setNewOpen(true)} />}
      />
      <NewConversationDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}
