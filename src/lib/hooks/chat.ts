"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";

export interface ConversationInput {
  type: "dm" | "group" | "project_channel";
  peerId?: string;
  name?: string;
  memberIds?: string[];
  projectId?: string;
}

/** Create a conversation (DM, group, or project channel) and return it. */
export function useCreateConversation(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConversationInput) =>
      apiFetch<{ conversation: { id: string } }>(
        `/api/chat/conversations?orgId=${encodeURIComponent(orgId)}`,
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.conversations(orgId) });
    },
  });
}

export function useSendMessage(orgId: string, conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; parentId?: string; attachmentFileIds?: string[] }) =>
      apiFetch<{ message: unknown }>(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            body: input.body,
            parentId: input.parentId ?? null,
            attachmentFileIds: input.attachmentFileIds ?? [],
          }),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.messages(orgId, conversationId) });
      qc.invalidateQueries({ queryKey: qk.conversations(orgId) });
    },
  });
}

export function useEditMessage(orgId: string, conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: string; body: string }) =>
      apiFetch(`/api/chat/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ body }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.messages(orgId, conversationId) });
      qc.invalidateQueries({ queryKey: qk.conversations(orgId) });
    },
  });
}

export function useDeleteMessage(orgId: string, conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => apiFetch(`/api/chat/messages/${messageId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.messages(orgId, conversationId) });
      qc.invalidateQueries({ queryKey: qk.conversations(orgId) });
    },
  });
}

export function useToggleReaction(orgId: string, conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      apiFetch(`/api/chat/messages/${messageId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.messages(orgId, conversationId) });
    },
  });
}
