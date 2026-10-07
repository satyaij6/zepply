import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCreator } from "@/lib/clip-access";
import { MAX_UPLOAD_BYTES } from "@/lib/clip-engine";
import { createSourceUpload } from "@/lib/clip-storage";

const body = z.object({
  fileName: z.string().min(1).max(200),
  size: z.number().int().positive(),
  contentType: z.string().regex(/^(video|audio)\//, "Only video or audio files can be uploaded"),
});

// POST — A signed URL the browser uploads the source video to, directly into storage
export async function POST(request: NextRequest) {
  const { userId, error } = await requireCreator();
  if (error) return error;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { fileName, size } = parsed.data;
  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `Files can be up to ${MAX_UPLOAD_BYTES / 1024 ** 3} GB` }, { status: 413 });
  }

  // Keep the original name readable but safe as an object key
  const safeName = fileName.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-120) || "video";
  const path = `${userId}/${randomUUID()}/${safeName}`;

  try {
    const upload = await createSourceUpload(path);
    return NextResponse.json({ path, signedUrl: upload.signedUrl });
  } catch (e) {
    console.error("create/uploads: could not sign upload", e);
    return NextResponse.json({ error: "Uploads aren't available right now" }, { status: 503 });
  }
}
