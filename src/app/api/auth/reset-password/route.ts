import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { resetPassword } from "@/server/auth/auth.service";
import { resetPasswordSchema } from "@/validations/auth.schema";

export const runtime = "nodejs";

export const POST = handleApi(async (req: NextRequest) => {
  const body = await parseBody(req, resetPasswordSchema);
  await resetPassword(body.token, body.password);
  return ok({ reset: true });
});
