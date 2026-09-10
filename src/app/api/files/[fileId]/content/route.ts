import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { handleApi } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { assertFileAccess, resolveFileForContent } from "@/server/services/file.service";

export const runtime = "nodejs";

const LOCAL_ROOT = path.join(process.cwd(), "storage", "uploads");

/**
 * GET /api/files/:id/content — bytes of a stored file.
 * Local driver: streams from disk. Cloudinary driver: redirects to the
 * CDN URL. Membership is verified before anything is returned.
 */
export const GET = handleApi(async (req: NextRequest, ctx: { params: Promise<{ fileId: string }> }) => {
  const session = await requireUser();
  const { fileId } = await ctx.params;
  const doc = await resolveFileForContent(fileId);
  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }
  await assertFileAccess(String(session.user._id), doc);

  const download = req.nextUrl.searchParams.get("download") === "1";
  const disposition = (download ? "attachment" : "inline") + `; filename*=UTF-8''${encodeURIComponent(doc.name)}`;

  if (doc.storageProvider === "cloudinary") {
    const url = doc.url;
    if (!url) return new NextResponse("File unavailable", { status: 410 });
    return NextResponse.redirect(url, 307);
  }

  const absolute = path.join(LOCAL_ROOT, doc.storageKey);
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(absolute);
  } catch {
    return new NextResponse("File unavailable", { status: 410 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(bytes.length),
    },
  });
});
