import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import {
  createGroup,
  getOrCreateDm,
  getOrCreateProjectChannel,
  listConversations,
} from "@/server/services/chat.service";
import { createConversationSchema } from "@/validations/chat.schema";

export const runtime = "nodejs";

/** GET /api/chat/conversations?orgId= — my DMs/groups + visible project channels. */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  const items = await listConversations(String(session.user._id), orgId);
  return ok({ items });
});

/** POST /api/chat/conversations?orgId= — open a DM, create a group, or open a project channel. */
export const POST = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  const body = await parseBody(req, createConversationSchema);
  let conversation;
  if (body.type === "dm") {
    conversation = await getOrCreateDm(String(session.user._id), orgId, body.peerId);
  } else if (body.type === "group") {
    conversation = await createGroup(String(session.user._id), orgId, body.name, body.memberIds);
  } else {
    conversation = await getOrCreateProjectChannel(String(session.user._id), body.projectId);
  }
  return ok({ conversation }, { status: 201 });
});
