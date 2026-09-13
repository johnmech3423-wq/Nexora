import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { deleteEndpoint, updateEndpoint } from "@/server/services/webhook.service";
import { z } from "zod";
import { WEBHOOK_EVENT_KEYS } from "@/server/services/webhook.service";

export const runtime = "nodejs";

const updateSchema = z.object({
  url: z.string().min(1).max(2000).optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_KEYS)).min(1).optional(),
  enabled: z.boolean().optional(),
  rotateSecret: z.boolean().optional(),
});

type Ctx = { params: Promise<{ orgId: string; endpointId: string }> };

export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId, endpointId } = await ctx.params;
  const body = await parseBody(req, updateSchema);
  const endpoint = await updateEndpoint(String(session.user._id), orgId, endpointId, body);
  return ok({ endpoint });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId, endpointId } = await ctx.params;
  await deleteEndpoint(String(session.user._id), orgId, endpointId);
  return ok({ deleted: true });
});
