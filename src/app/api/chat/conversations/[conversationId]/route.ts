import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { listMessages } from "@/server/services/chat.service";
import { parsePositiveInt } from "@/lib/utils";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ conversationId: string }> };

/** GET — conversation detail with a page of messages (chronological). */
export const GET = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { conversationId } = await ctx.params;
  const page = parsePositiveInt(req.nextUrl.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(req.nextUrl.searchParams.get("pageSize"), 50, 100);
  const result = await listMessages(String(session.user._id), conversationId, { page, pageSize });
  return ok(result);
});
