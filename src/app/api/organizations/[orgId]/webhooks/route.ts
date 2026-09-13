import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { createEndpoint, listEndpoints, updateEndpoint } from "@/server/services/webhook.service";
import { z } from "zod";
import { WEBHOOK_EVENT_KEYS } from "@/server/services/webhook.service";

export const runtime = "nodejs";

const createSchema = z.object({
  url: z.string().min(1).max(2000),
  events: z.array(z.enum(WEBHOOK_EVENT_KEYS)).min(1, "Pick at least one event."),
  enabled: z.boolean().optional(),
});

type Ctx = { params: Promise<{ orgId: string }> };

export const GET = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  const items = await listEndpoints(String(session.user._id), orgId);
  return ok({ items });
});

export const POST = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  const body = await parseBody(req, createSchema);
  const endpoint = await createEndpoint(String(session.user._id), orgId, body);
  // Secrets are only ever revealed once: rotate immediately so the value
  // returned below is exactly what is stored on the endpoint.
  const rotated = await updateEndpoint(String(session.user._id), orgId, endpoint.id, { rotateSecret: true });
  return ok({ endpoint: rotated }, { status: 201 });
});
