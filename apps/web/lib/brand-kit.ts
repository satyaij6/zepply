import type { BrandKit } from "@prisma/client";
import { REEL_BUCKETS } from "@/lib/reels/options";
import { signedUrls } from "@/lib/storage";

/** A brand kit as the browser sees it: stored fields plus short-lived URLs for the logo and photos. */
export type BrandKitView = Omit<BrandKit, "id" | "userId" | "createdAt" | "updatedAt"> & {
  logoUrl: string | null;
  photos: { path: string; url: string }[];
};

const PRIVATE_KEYS = ["id", "userId", "createdAt", "updatedAt"] as const;
const PRIVATE = new Set<string>(PRIVATE_KEYS);

export async function brandKitView(kit: BrandKit): Promise<BrandKitView> {
  const urls = await signedUrls(REEL_BUCKETS.assets, [kit.logoPath, ...kit.photoPaths], 6 * 3600).catch(() => new Map<string, string>());
  const fields = Object.fromEntries(Object.entries(kit).filter(([key]) => !PRIVATE.has(key))) as Omit<BrandKit, (typeof PRIVATE_KEYS)[number]>;
  return {
    ...fields,
    logoUrl: kit.logoPath ? urls.get(kit.logoPath) ?? null : null,
    photos: kit.photoPaths.flatMap((path) => (urls.get(path) ? [{ path, url: urls.get(path)! }] : [])),
  };
}
