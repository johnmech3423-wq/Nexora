import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { chat } from "@/server/services/ai.service";
import { z } from "zod";
import { assertRateLimit } from "@/server/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
  feature: z.enum(["assistant", "summarize", "suggest"]).optional().default("assistant"),
  projectId: z.string().trim().min(1).max(100).optional(),
});

/** POST /api/ai/chat?orgId= — assistant (metered per member/day). */
export const POST = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  await assertRateLimit("ai", session.user.email, 60, 60_000, "Too many AI requests. Please wait a moment before trying again.");
  const body = await parseBody(req, schema);
  const result = await chat(String(session.user._id), orgId, body.feature, body.message, {
    projectId: body.projectId,
  });
  return ok(result);
});
