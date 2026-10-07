// Turns the promo-classic template into a renderable composition for one reel.
//
// The same function feeds the in-browser preview (variables inlined, <base> pointed
// at the template folder) and the render worker (variables passed to the CLI), so
// what the user previews is what renders.

import { LENGTHS, SFX, SFX_DURATIONS } from "./timing.mjs";

/** @type {Record<string, { width: number, height: number }>} */
export const FORMATS = {
  vertical: { width: 1080, height: 1920 },
  portrait: { width: 1080, height: 1350 },
  wide: { width: 1920, height: 1080 },
};

export const MUSIC = ["upbeat", "calm", "premium"];

/**
 * @param {string} html  the template's index.html
 * @param {import("./index").BuildOptions} opts
 * @returns {string}
 */
export function buildReelHtml(html, opts) {
  const format = FORMATS[opts.format] ? opts.format : "vertical";
  const length = LENGTHS[opts.length] ? opts.length : "standard";
  const music = MUSIC.includes(opts.music) ? opts.music : "upbeat";
  const { width, height } = FORMATS[format];
  const { duration, scenes } = LENGTHS[length];

  let out = html;

  // canvas size, length and format on the root and both full-length layers
  out = out.replace(/<meta name="viewport"[^>]*>/, `<meta name="viewport" content="width=${width}, height=${height}" />`);
  out = out.replace(/(<div\s+id="root"[\s\S]*?>)/, (tag) =>
    tag
      .replace(/data-duration="[^"]*"/, `data-duration="${duration}"`)
      .replace(/data-width="[^"]*"/, `data-width="${width}"`)
      .replace(/data-height="[^"]*"/, `data-height="${height}"`)
      .replace(/data-format="[^"]*"/, `data-format="${format}"`)
      .replace(/data-length="[^"]*"/, `data-length="${length}"`)
      .replace(/style="[^"]*"/, `style="width: ${width}px; height: ${height}px"`),
  );
  out = out.replace(/(<div id="(?:ground|stage)" class="clip" data-start="0" )data-duration="[^"]*"/g, `$1data-duration="${duration}"`);

  // music bed + sound cues
  const audio = [];
  if (opts.sound !== false) {
    audio.push(
      `<audio id="bgm" src="music/${music}-${length}.mp3" data-start="0" data-duration="${duration}" data-track-index="10" data-volume="0.85"></audio>`,
    );
    let n = 0;
    for (const scene of scenes) {
      const len = scene.end - scene.start;
      for (const cue of SFX[scene.id] ?? []) {
        const offset = typeof cue.at === "function" ? cue.at(len) : cue.at;
        const start = round(scene.start + offset);
        const dur = SFX_DURATIONS[cue.file] ?? 1;
        if (start < 0 || start + 0.05 >= duration) continue;
        audio.push(
          `<audio id="sfx-${n}" src="sfx/${cue.file}.mp3" data-start="${start}" data-duration="${round(Math.min(dur, duration - start))}" data-track-index="${20 + n}" data-volume="${cue.volume}"></audio>`,
        );
        n++;
      }
    }
  }
  out = out.replace("<!-- AUDIO -->", audio.join("\n      "));

  // head injections: <base> for the preview, inline variables when not using the CLI
  const head = [];
  if (opts.baseHref) head.push(`<base href="${escapeAttr(opts.baseHref)}" />`);
  if (opts.inlineVariables && opts.variables) {
    const json = JSON.stringify(opts.variables).replace(/</g, "\\u003c");
    head.push(`<script>window.__hfVariables = ${json};</script>`);
  }
  if (head.length) out = out.replace(/<head>/, `<head>\n    ${head.join("\n    ")}`);

  return out;
}

/** Keys the template declares, so callers can drop anything else. */
export const VARIABLE_KEYS = [
  "accent",
  "brandName",
  "handle",
  "logo",
  "hookLine",
  "comments",
  "customerName",
  "question",
  "reply",
  "replyChip",
  "answerHeadline",
  "galleryTitle",
  "galleryHeadline",
  "photos",
  "highlights",
  "highlightsHeadline",
  "tagline",
  "ctaLabel",
  "ctaSub",
];

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
