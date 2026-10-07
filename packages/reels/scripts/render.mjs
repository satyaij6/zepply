#!/usr/bin/env node
// Render one promo reel to MP4.
//
//   node packages/reels/scripts/render.mjs --job job.json --out reel.mp4 [--workers 2] [--quality high] [--keep]
//
// job.json: { "format": "vertical", "length": "standard", "music": "upbeat", "sound": true,
//             "variables": { "brandName": "...", "photos": "https://...\nhttps://...", ... } }
//
// Remote logo/photo URLs are downloaded into the temporary project first, so the
// render never depends on the network mid-capture. Progress lines from the
// HyperFrames CLI are passed through on stdout ("NN%").

import { spawn } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildReelHtml, LENGTHS, VARIABLE_KEYS } from "../src/index.mjs";

const HYPERFRAMES = "hyperframes@0.8.134";
const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE = resolve(here, "../../../apps/web/public/reel-templates/promo-classic");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

function die(msg) {
  console.error(`render: ${msg}`);
  process.exit(1);
}

const jobPath = arg("job");
const outPath = arg("out");
if (!jobPath || !outPath) die("usage: render.mjs --job job.json --out reel.mp4");
const templateDir = resolve(arg("template", DEFAULT_TEMPLATE));
const workers = String(arg("workers", "2"));
const quality = String(arg("quality", "high"));
const keep = arg("keep", false) === true || arg("prepare-only", false) === true;

const job = JSON.parse(readFileSync(jobPath, "utf8"));
if (!LENGTHS[job.length]) job.length = "standard";

const work = mkdtempSync(join(tmpdir(), "zepply-reel-"));
const cleanup = () => {
  if (!keep) rmSync(work, { recursive: true, force: true });
};

async function main() {
  // template assets: fonts, sound effects, the one music bed this reel uses
  cpSync(join(templateDir, "fonts"), join(work, "fonts"), { recursive: true });
  cpSync(join(templateDir, "sfx"), join(work, "sfx"), { recursive: true });
  mkdirSync(join(work, "music"), { recursive: true });
  const bed = `${job.music || "upbeat"}-${job.length}.mp3`;
  if (existsSync(join(templateDir, "music", bed))) copyFileSync(join(templateDir, "music", bed), join(work, "music", bed));

  // only declared variables; media localised into ./media
  const vars = {};
  for (const k of VARIABLE_KEYS) {
    if (job.variables && typeof job.variables[k] === "string") vars[k] = job.variables[k];
  }
  mkdirSync(join(work, "media"), { recursive: true });
  let m = 0;
  const localise = async (ref) => {
    if (!ref) return ref;
    const name = `m${m++}${extOf(ref)}`;
    const dest = join(work, "media", name);
    if (/^https?:\/\//i.test(ref)) {
      const res = await fetch(ref);
      if (!res.ok) throw new Error(`could not download ${shorten(ref)} (${res.status})`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    } else if (existsSync(ref)) {
      copyFileSync(ref, dest);
    } else {
      throw new Error(`media not found: ${shorten(ref)}`);
    }
    return `media/${name}`;
  };
  if (vars.logo) vars.logo = await localise(vars.logo);
  if (vars.photos) {
    const list = vars.photos.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
    const local = [];
    for (const p of list) local.push(await localise(p));
    vars.photos = local.join("\n");
  }

  const template = readFileSync(join(templateDir, "index.html"), "utf8");
  const html = buildReelHtml(template, {
    format: job.format,
    length: job.length,
    music: job.music,
    sound: job.sound !== false,
    variables: vars,
    // Inline as well as --variables-file: the template reads both, and inlining
    // keeps the render correct even if the CLI's injection order changes.
    inlineVariables: true,
  });
  writeFileSync(join(work, "index.html"), html);
  writeFileSync(join(work, "variables.json"), JSON.stringify(vars));
  writeFileSync(
    join(work, "hyperframes.json"),
    JSON.stringify({ paths: { blocks: "compositions", components: "compositions/components", assets: "media" } }, null, 2),
  );

  if (arg("prepare-only", false) === true) {
    console.log(`prepared ${work}`);
    return;
  }

  const out = resolve(outPath);
  mkdirSync(dirname(out), { recursive: true });
  const args = [
    "--yes",
    HYPERFRAMES,
    "render",
    "--variables-file",
    "variables.json",
    "--quality",
    quality,
    "--workers",
    workers,
    "--output",
    out,
  ];
  const code = await new Promise((done) => {
    const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", args, {
      cwd: work,
      shell: process.platform === "win32",
      env: { ...process.env, HYPERFRAMES_NO_UPDATE_CHECK: "1" },
    });
    const relay = (buf) => {
      for (const line of String(buf).split(/\r?\n|\r/)) {
        const pct = line.match(/(\d{1,3})%/);
        if (pct) process.stdout.write(`${pct[1]}%\n`);
        else if (/error|✗/i.test(line)) process.stderr.write(line + "\n");
      }
    };
    child.stdout.on("data", relay);
    child.stderr.on("data", relay);
    child.on("close", done);
  });
  if (code !== 0) throw new Error(`hyperframes render exited with ${code}`);
  if (!existsSync(out)) throw new Error("render finished but no MP4 was written");
  console.log(`done ${out}`);
}

function extOf(ref) {
  const clean = ref.split("?")[0];
  const e = extname(basename(clean)).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"].includes(e) ? e : ".jpg";
}

function shorten(s) {
  return s.length > 80 ? s.slice(0, 77) + "..." : s;
}

main()
  .then(cleanup)
  .catch((e) => {
    console.error(`render: ${e.message}`);
    if (keep) console.error(`render: project kept at ${work}`);
    cleanup();
    process.exit(1);
  });
