"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ConversationList } from "@/components/features/chat/conversation-list";
import { ChatThread } from "@/components/features/chat/thread";
import { ChatWorkspace } from "@/components/features/chat/chat-workspace";
import { NewConversationDialog } from "@/components/features/chat/new-conversation";
import { useActiveOrgId } from "@/lib/hooks/use-session";

/**
 * /chat/[conversationId] — rail + open thread.
 * Mobile shows the thread only (back button in the thread header);
 * desktop keeps the conversation rail in sync.
 */
export default function ChatConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const orgId = useActiveOrgId();
  const [newOpen, setNewOpen] = React.useState(false);
  const conversationId = params?.conversationId;

  if (!conversationId) return null;

  return (
    <>
      {!orgId ? (
        <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <ChatWorkspace
          railVisibleOnMobile={false}
          rail={<ConversationList activeConversationId={conversationId} onNew={() => setNewOpen(true)} />}
          detail={
            <ChatThread key={conversationId} conversationId={conversationId} orgId={orgId} />
          }
        />
      )}
      <NewConversationDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}
