import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { deleteFile, getFileMeta } from "@/server/services/file.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ fileId: string }> };

export const GET = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { fileId } = await ctx.params;
  return ok({ file: await getFileMeta(String(session.user._id), fileId) });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { fileId } = await ctx.params;
  await deleteFile(String(session.user._id), fileId);
  return ok({ deleted: true });
});
