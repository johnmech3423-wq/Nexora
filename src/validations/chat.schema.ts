import { z } from "zod";

export const createConversationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("dm"),
    peerId: z.string().min(1),
  }),
  z.object({
    type: z.literal("group"),
    name: z.string().trim().min(1, "Group name is required.").max(120),
    memberIds: z.array(z.string()).min(1).max(200),
  }),
  z.object({
    type: z.literal("project_channel"),
    projectId: z.string().min(1),
  }),
]);

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty.").max(10_000),
  parentId: z.string().nullable().optional(),
  attachmentFileIds: z.array(z.string()).max(8).optional(),
});

export const updateMessageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty.").max(10_000),
});

export const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(32),
});
