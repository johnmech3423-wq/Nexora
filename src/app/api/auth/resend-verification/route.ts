import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { resendVerification } from "@/server/auth/auth.service";
import { requireUser } from "@/server/auth/session";

export const runtime = "nodejs";

export const POST = handleApi(async (_req: NextRequest) => {
  const session = await requireUser();
  await resendVerification(String(session.user._id));
  return ok({ resent: true });
});
