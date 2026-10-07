import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import type { BrandKit, Draft } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { postFonts } from "@/lib/onboarding/fonts";
import { REEL_BUCKETS } from "@/lib/reels/options";
import { downloadObject } from "@/lib/storage";

// GET — A draft drawn as an image: ?slide=0 is the post, carousel cover or Reel cover; carousels go up to ?slide=4.
// ?format=square draws a 1:1 version (same design, re-laid out) for compact previews.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireUserId();
  if (error) return error;
  const { id } = await params;
  const draft = await prisma.draft.findFirst({ where: { id, userId } });
  const kit = await prisma.brandKit.findUnique({ where: { userId } });
  if (!draft || !kit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slide = Math.max(0, Math.min(Number(request.nextUrl.searchParams.get("slide")) || 0, draft.slides.length));
  const photoPath = draft.photoPaths.length ? draft.photoPaths[Math.max(0, slide - 1) % draft.photoPaths.length] : null;
  const [photo, logo] = await Promise.all([dataUri(photoPath), dataUri(kit.logoPath)]);

  const reel = draft.kind === "REEL";
  const square = request.nextUrl.searchParams.get("format") === "square";
  const size = { width: 1080, height: square ? 1080 : reel ? 1920 : 1350 };
  const label = slide > 0 ? draft.slides[slide - 1] : null;
  const body = [kit.brandName, kit.handle ? `@${kit.handle}` : "", label ?? "", "Swipe"].join(" ");

  const image = new ImageResponse(
    label !== null ? (
      <Slide kit={kit} photo={photo} label={label} index={slide} total={draft.slides.length + 1} height={size.height} />
    ) : (
      <Cover draft={draft} kit={kit} photo={photo} logo={logo} reel={reel} height={size.height} />
    ),
    { ...size, fonts: await postFonts(kit.font, label ? "" : draft.headline, body) },
  );
  image.headers.set("Cache-Control", "private, max-age=86400");
  return image;
}

async function dataUri(path: string | null) {
  if (!path) return null;
  const bytes = await downloadObject(REEL_BUCKETS.assets, path);
  if (!bytes) return null;
  const type = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return `data:${type};base64,${bytes.toString("base64")}`;
}

const palette = (kit: BrandKit) => {
  const [primary = "#16161A", second = "#3D7EFF"] = kit.colors.length ? kit.colors : [kit.accent];
  return { primary, second, onPrimary: readableOn(primary) };
};

/** Black or white, whichever reads better on the colour */
function readableOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? "#111111" : "#FFFFFF";
}

function Backdrop({ photo, color, height }: { photo: string | null; color: string; height: number }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" width={1080} height={height} style={{ position: "absolute", top: 0, left: 0, width: 1080, height, objectFit: "cover" }} />
  ) : (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", background: color }} />
  );
}

/** Post, carousel cover and Reel cover: photo, a dark fade, the logo and name, and the headline. */
function Cover({ draft, kit, photo, logo, reel, height }: { draft: Draft; kit: BrandKit; photo: string | null; logo: string | null; reel: boolean; height: number }) {
  // Full-size Reel covers keep text inside the middle area profiles show; other sizes use the edges
  const tall = height === 1920;
  const { primary, second } = palette(kit);
  const carousel = draft.kind === "CAROUSEL";
  return (
    <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", fontFamily: "Body, Script" }}>
      <Backdrop photo={photo} color={primary} height={height} />
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          display: "flex",
          background: photo ? "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.78) 100%)" : "transparent",
        }}
      />

      {/* Reels show cropped to the middle on profiles, so their text stays inside that safe zone */}
      <div style={{ position: "absolute", top: tall ? 300 : 64, left: 64, right: 64, display: "flex", alignItems: "center", gap: 20 }}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" width={84} height={84} style={{ width: 84, height: 84, borderRadius: 42, objectFit: "cover", border: "3px solid rgba(255,255,255,0.9)" }} />
        )}
        <div style={{ display: "flex", fontSize: 34, color: "#FFFFFF", letterSpacing: 1.5, textTransform: "uppercase" }}>{kit.brandName}</div>
      </div>

      {reel && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", width: 190, height: 190, borderRadius: 95, border: "6px solid rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)" }}>
            <svg width="72" height="80" viewBox="0 0 72 80" style={{ marginLeft: 14 }}>
              <path d="M0 0 L72 40 L0 80 Z" fill="#FFFFFF" />
            </svg>
          </div>
        </div>
      )}

      <div style={{ position: "absolute", left: 64, right: 64, bottom: tall ? 340 : 80, display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", width: 120, height: 12, borderRadius: 6, background: second }} />
        <div style={{ display: "flex", fontFamily: "Headline, Script", fontSize: tall ? 128 : height === 1080 ? 100 : 112, lineHeight: 1.02, color: "#FFFFFF", letterSpacing: -2 }}>
          {draft.headline}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 30, color: "rgba(255,255,255,0.85)" }}>
          <div style={{ display: "flex" }}>{kit.handle ? `@${kit.handle}` : ""}</div>
          {carousel && (
            <div style={{ display: "flex", padding: "14px 30px", borderRadius: 999, background: "rgba(255,255,255,0.18)", border: "2px solid rgba(255,255,255,0.5)" }}>Swipe →</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A carousel slide after the cover: photo, a label in the brand colour, and the slide count. */
function Slide({ kit, photo, label, index, total, height }: { kit: BrandKit; photo: string | null; label: string; index: number; total: number; height: number }) {
  const { primary, onPrimary } = palette(kit);
  return (
    <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", fontFamily: "Body, Script" }}>
      <Backdrop photo={photo} color={primary} height={height} />
      <div style={{ position: "absolute", top: 56, right: 56, display: "flex", padding: "12px 24px", borderRadius: 999, background: "rgba(0,0,0,0.45)", color: "#FFFFFF", fontSize: 28 }}>
        {`${index + 1}/${total}`}
      </div>
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 64, display: "flex" }}>
        <div style={{ display: "flex", padding: "26px 40px", borderRadius: 28, background: primary, color: onPrimary, fontSize: 56, lineHeight: 1.1 }}>{label}</div>
      </div>
    </div>
  );
}
