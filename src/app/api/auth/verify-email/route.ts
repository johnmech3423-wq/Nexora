import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { verifyEmail } from "@/server/auth/auth.service";
import { verifyEmailSchema } from "@/validations/auth.schema";

export const runtime = "nodejs";

export const POST = handleApi(async (req: NextRequest) => {
  const body = await parseBody(req, verifyEmailSchema);
  await verifyEmail(body.token);
  return ok({ verified: true });
});
