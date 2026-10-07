/*
 * Fonts for drawing post images (next/og needs TTF/OTF bytes). Fetched from Google Fonts, subset
 * to the exact text being drawn so each download stays small, and kept in memory for reuse.
 */
import { FONTS, type FontValue } from "./options";

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" };

const cache = new Map<string, Promise<ArrayBuffer | null>>();

async function fetchFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  // Instrument Serif has a single weight, so it takes no weight axis
  const axis = family === "Instrument Serif" ? "" : `:wght@${weight}`;
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}${axis}&text=${encodeURIComponent(text)}`;
  try {
    // Without a browser user agent, Google serves TTF (the format next/og can read)
    const css = await (await fetch(url)).text();
    const file = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return file ? await (await fetch(file)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

function font(family: string, weight: number, text: string) {
  const key = `${family}|${weight}|${text}`;
  if (!cache.has(key)) {
    if (cache.size > 300) cache.clear();
    cache.set(key, fetchFont(family, weight, text));
  }
  return cache.get(key)!;
}

/**
 * The brand's headline face (as "Headline") and a clean face for small text (as "Body"), plus
 * Telugu or Devanagari faces when the text needs them; drawing falls back through them per glyph.
 */
export async function postFonts(brandFont: string | null, headline: string, body: string): Promise<OgFont[]> {
  const face = FONTS.find((f) => f.value === (brandFont as FontValue)) ?? FONTS[0];
  const headWeight = face.value === "instrument-serif" ? 400 : 700;
  const all = headline + body;
  const wanted: [string, string, number, string][] = [
    ["Headline", face.family, headWeight, headline],
    ["Body", "Inter", 600, body + "0123456789/→@"],
  ];
  if (/[ఀ-౿]/.test(all)) wanted.push(["Script", "Noto Sans Telugu", 700, all]);
  if (/[ऀ-ॿ]/.test(all)) wanted.push(["Script", "Noto Sans Devanagari", 700, all]);

  const loaded = await Promise.all(wanted.map(async ([name, family, weight, text]) => ({ name, weight, data: await font(family, weight, text) })));
  return loaded.flatMap((f) => (f.data ? [{ name: f.name, data: f.data, weight: f.weight as OgFont["weight"], style: "normal" as const }] : []));
}
