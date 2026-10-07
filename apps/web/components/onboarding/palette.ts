import { colourFromImage } from "@/lib/reels/images";
import { MAX_COLORS } from "@/lib/onboarding/options";

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const distance = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

/**
 * Brand colours read from the logo and photos in the browser, for when the server couldn't ask
 * Claude. Near-duplicates are dropped; a deep neutral and a light one round out the set.
 */
export async function paletteFromImages(urls: string[]): Promise<string[]> {
  const found: string[] = [];
  for (const url of urls.slice(0, 4)) {
    const blob = await fetch(url).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
    const colour = blob ? await colourFromImage(blob) : null;
    if (colour && found.every((c) => distance(c, colour) > 60)) found.push(colour.toUpperCase());
  }
  for (const neutral of ["#1C1917", "#F5F0E8"]) if (found.length < MAX_COLORS) found.push(neutral);
  return found.slice(0, MAX_COLORS);
}
