/*
 * Browser-side image handling for the brand kit: phone photos are shrunk before upload
 * (faster uploads, faster renders), and the logo suggests a brand colour.
 */

/** Scales an image down so its longer side is at most `maxSide`. Logos keep PNG for transparency. */
export async function shrinkImage(file: File, maxSide: number, keepPng = false): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 ** 2) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = keepPng && file.type === "image/png" ? "image/png" : "image/jpeg";
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), type, 0.86));
}

/** The logo's most vivid colour as #RRGGBB, or null for a monochrome logo. */
export async function colourFromImage(blob: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return null;
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, size, size);

  // Bucket by hue; score by saturation so a logo's brand colour beats its background
  const buckets = new Map<number, { r: number; g: number; b: number; n: number; score: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.35 || max < 60) continue;
    const hue = rgbHue(r, g, b);
    const key = Math.round(hue / 20);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, score: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    bucket.score += sat * (max / 255);
    buckets.set(key, bucket);
  }
  const best = [...buckets.values()].sort((a, b) => b.score - a.score)[0];
  if (!best || best.n < 12) return null;
  const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, "0");
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`.toUpperCase();
}

function rgbHue(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
