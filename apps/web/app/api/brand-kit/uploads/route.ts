import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-helpers";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, REEL_BUCKETS } from "@/lib/reels/options";
import { createUpload, signedUrls } from "@/lib/storage";

const EXT: Record<(typeof IMAGE_TYPES)[number], string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const body = z.object({
  kind: z.enum(["logo", "photo"]),
  size: z.number().int().positive(),
  contentType: z.enum(IMAGE_TYPES, { error: "Use a JPG, PNG or WebP image" }),
});

// POST — A signed URL the browser uploads a logo or photo to, plus a read URL for the preview
export async function POST(request: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { kind, size, contentType } = parsed.data;
  if (size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: `Images can be up to ${MAX_IMAGE_BYTES / 1024 ** 2} MB` }, { status: 413 });
  }

  const path = `${userId}/${kind}/${randomUUID()}.${EXT[contentType]}`;
  try {
    const upload = await createUpload(REEL_BUCKETS.assets, path);
    // Signed before the file exists; valid once the upload lands
    const read = await signedUrls(REEL_BUCKETS.assets, [path], 6 * 3600);
    return NextResponse.json({ path, signedUrl: upload.signedUrl, readUrl: read.get(path) ?? null });
  } catch (e) {
    console.error("brand-kit/uploads: could not sign upload", e);
    return NextResponse.json({ error: "Uploads aren't available right now" }, { status: 503 });
  }
}
