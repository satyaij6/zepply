"""
Storytelling B-roll: motion-graphics moments Claude designs for each clip.

The speaker's words get a picture -- a metaphor, a diagram, a comparison, a
scene -- for a few seconds at a time while the voice keeps playing. Claude
writes every moment from scratch (HTML, CSS and a GSAP timeline); HyperFrames
renders the result over the clip in headless Chrome.

Order of operations, and why:

1. The clip is rendered WITHOUT captions (cut.py does that when this is on).
   A full-screen cutaway hides the speaker; burned captions underneath it
   would vanish with them, so captions go on last, over everything.
2. Claude designs the moments from the clip's word timings plus three stills,
   so it knows what the frame looks like and where the face is.
3. The moments are assembled into ONE composition around the clip and linted.
   Lint errors go back to Claude once for a repair; still broken -> no B-roll.
4. HyperFrames renders the picture; ffmpeg burns the captions onto it and takes
   the audio from the clean render, bit for bit, so the voice is never
   re-encoded by a browser pipeline.

Like the post kit, this is an extra and never a gate: any failure leaves the
clip exactly as it would have been without it.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import threading
from pathlib import Path

from pydantic import BaseModel, Field

from . import ffmpeg
from .config import ASSETS_DIR, PROMPTS_DIR, Settings
from .errors import ClipperError, TransientError
from .models import ClipPlan, Word
from .retry import with_retry

log = logging.getLogger(__name__)

BROLL_ASSETS = ASSETS_DIR / "broll"
PROMPT_PATH = PROMPTS_DIR / "broll_designer.md"
HAIRLINE_EXAMPLE = PROMPTS_DIR / "broll_hairline_example.js"
W, H = 1080, 1920
SPLIT_H = 960
SPLIT_SHIFT = 570      # px the speaker slides down during a split moment
# Chrome capture is memory-hungry; clips render in parallel, B-roll does not.
_RENDER_LOCK = threading.Lock()

FONT_FACES = """
@font-face { font-family: "Inter Tight"; font-weight: 100 900; font-display: block; src: url("fonts/InterTight-Latin.woff2") format("woff2"); }
@font-face { font-family: "Inter"; font-weight: 400; font-display: block; src: url("fonts/Inter-400-latin.woff2") format("woff2"); }
@font-face { font-family: "Inter"; font-weight: 700; font-display: block; src: url("fonts/Inter-700-latin.woff2") format("woff2"); }
@font-face { font-family: "Instrument Serif"; font-style: italic; font-weight: 400; font-display: block; src: url("fonts/InstrumentSerif-Italic.woff2") format("woff2"); }
@font-face { font-family: "Anton"; font-weight: 400; font-display: block; src: url("fonts/Anton-Regular.ttf") format("truetype"); }
@font-face { font-family: "Zalando Sans Expanded"; font-weight: 200 900; font-display: block; src: url("fonts/ZalandoSansExpanded-Variable.ttf") format("truetype"); }
@font-face { font-family: "Caveat"; font-weight: 700; font-display: block; src: url("fonts/Caveat-700-latin.woff2") format("woff2"); }
@font-face { font-family: "Noto Sans Telugu"; font-weight: 100 900; font-display: block; src: url("fonts/NotoSansTelugu.woff2") format("woff2"); }
"""

# Hairline's palette and strokes, retuned for a 1080x1920 video. The kernel's
# own css() is written for a 400px web figure: a 0.9px non-scaling stroke that
# vanishes on a phone, a dim dark palette, and 260ms CSS transitions on stroke
# colour -- which run on the browser's clock, not the timeline's, so a frame
# captured mid-transition would differ from one captured later. No transitions.
HAIRLINE_CSS = """
:root { --hl-plate: #0B0B0F; --hl-hi: var(--accent); --hl-edge: #9EA1AB; --hl-mid: #55575F;
  --hl-lo: #303138; --hl-sw: 3.2; }
[data-hairline] { display: block; position: relative; }
[data-hairline] > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
[data-hairline] svg :where(path, polygon, ellipse, line) { fill: var(--hl-plate); stroke: var(--hl-mid);
  stroke-width: var(--hl-sw); vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
[data-hairline] svg :where(.nf) { fill: none; }
[data-hairline] svg :where(.fo) { stroke: none; }
[data-hairline] svg :where(.sil) { stroke: var(--hl-edge); }
[data-hairline] svg :where(.hi) { stroke: var(--hl-hi); }
[data-hairline] svg :where(.lo) { stroke: var(--hl-lo); }
[data-hairline] svg :where(.dash) { stroke-dasharray: 3 10; }
[data-hairline] svg :where(.dot) { stroke: none; fill: var(--hl-hi); }
[data-hairline] svg :where(.dot.m) { fill: var(--hl-edge); }
[data-hairline] svg :where(.dot.off) { fill: var(--hl-lo); }
[data-hairline] svg :where(.ghost path) { fill: none; stroke: var(--hl-mid); }
"""


# The same figures on the Clean Explainer's light paper.
HAIRLINE_LIGHT = """
:root { --hl-plate: #F0F6F6; --hl-edge: #5E6866; --hl-mid: #A9B4B1; --hl-lo: #D3DCDA; }
"""
LOOKS = ("editorial", "explainer", "signal")


# ------------------------------------------------------------------ schema

class Moment(BaseModel):
    id: str = Field(description='"m1", "m2", ... in time order')
    start: float = Field(description="Seconds from the start of the clip")
    end: float
    layout: str = Field(description="cutaway | split | overlay")
    idea: str
    html: str
    css: str
    animation: str


class Design(BaseModel):
    moments: list[Moment]


# ------------------------------------------------------------------ inputs

def clip_words(plan: ClipPlan, words: list[Word]) -> list[tuple[float, float, Word]]:
    """(start, end, word) in clip (assembled) time, speech over others excluded."""
    out = []
    for span in plan.spans:
        for w in words:
            if w.overlap or not (span.source_start <= w.start < span.source_end):
                continue
            a = span.playback_start + (w.start - span.source_start)
            b = span.playback_start + (min(w.end, span.source_end) - span.source_start)
            out.append((a, b, w))
    out.sort(key=lambda x: x[0])
    return out


def timed_lines(timed: list[tuple[float, float, Word]]) -> str:
    """Phrases with their times: `[12.34-14.10] roman | native`."""
    lines, bucket = [], []

    def flush():
        if bucket:
            roman = " ".join(w.caption_text for _, _, w in bucket)
            native = " ".join(w.text for _, _, w in bucket)
            tail = f" | {native}" if native != roman else ""
            lines.append(f"[{bucket[0][0]:.2f}-{bucket[-1][1]:.2f}] {roman}{tail}")
            bucket.clear()

    for item in timed:
        if bucket and (item[0] - bucket[-1][1] >= 0.35 or len(bucket) >= 8):
            flush()
        bucket.append(item)
    flush()
    return "\n".join(lines)


def _stills(video: Path, duration: float, work: Path) -> list[dict]:
    """Three small frames so the designer can see the shot and the face."""
    blocks = []
    for n, frac in enumerate((0.2, 0.5, 0.8)):
        dest = work / f"still_{n}.jpg"
        try:
            ffmpeg.run(["-ss", f"{duration * frac:.2f}", "-i", str(video), "-frames:v", "1",
                        "-vf", "scale=360:-2", "-q:v", "4", dest.name],
                       cwd=work, what="broll still")
            data = base64.b64encode(dest.read_bytes()).decode()
            blocks.append({"type": "image",
                           "source": {"type": "base64", "media_type": "image/jpeg", "data": data}})
        except Exception as exc:  # noqa: BLE001 - stills only help
            log.debug("broll: still %d failed: %s", n, exc)
    return blocks


def solo_windows(plan: ClipPlan, frame_plans: list | None) -> list[tuple[float, float]]:
    """
    Clip-time stretches where the frame shows ONE person, full frame.

    A `split` moment slides the speaker into the bottom half. On a shot the
    reframe already stacks two people, that slide shows a forehead and half of
    the other person -- so splits are only offered, and only kept, here.
    """
    out: list[tuple[float, float]] = []
    for n, span in enumerate(plan.spans):
        fp = frame_plans[n] if frame_plans and n < len(frame_plans) else None
        if fp is None:
            continue  # centre crop: no face we can promise to keep in frame
        for run in fp.runs:
            if run.kind == "single" and run.duration >= 2.0:
                out.append((span.playback_start + run.start, span.playback_start + run.end))
    return out


def build_prompt(plan: ClipPlan, timed, duration: float, *, title: str | None,
                 accent: str | None, solo: list[tuple[float, float]] | None = None) -> str:
    parts = [
        f"Clip length: {duration:.2f}s. Canvas 1080x1920.",
        f"What the clip is about: {plan.theme}",
        f"Its title: {title or plan.suggested_title}",
    ]
    if accent:
        parts.append(f"Brand accent colour: {accent} (use it as the accent).")
    if solo:
        parts.append("`split` is allowed ONLY inside these windows, where one person fills the "
                     "frame: " + ", ".join(f"{a:.1f}-{b:.1f}s" for a, b in solo)
                     + ". Elsewhere the shot already stacks two people; use cutaway or overlay.")
    else:
        parts.append("Do not use `split` in this clip: the shot never shows one person alone.")
    parts += [
        "",
        "The frames above are from this clip (start, middle, end).",
        "",
        "WORDS WITH TIMINGS (clip seconds; romanised | original script):",
        timed_lines(timed),
    ]
    return "\n".join(parts)


# ------------------------------------------------------------------ Claude

def system_prompt(look: str = "editorial") -> str:
    """The design brief, with the worked Hairline moment and the clip's look."""
    brief = PROMPT_PATH.read_text(encoding="utf-8").replace(
        "{{HAIRLINE_EXAMPLE}}", HAIRLINE_EXAMPLE.read_text(encoding="utf-8").strip())
    look_file = PROMPTS_DIR / "looks" / f"{look if look in LOOKS else 'editorial'}.md"
    return brief + "\n\n" + look_file.read_text(encoding="utf-8")


def _client(settings: Settings):
    import anthropic

    from .http import ensure_tls

    ensure_tls()
    return anthropic.Anthropic(api_key=settings.require_anthropic())


def _ask(client, settings: Settings, messages: list) -> tuple[Design | None, list]:
    """One design request. Returns the design (None on refusal) and the reply content."""
    import anthropic

    system = system_prompt(settings.broll_look)

    def once():
        try:
            with client.messages.stream(
                model=settings.broll_model,
                max_tokens=settings.broll_max_tokens,
                system=system,
                thinking={"type": "adaptive"},
                output_config={"effort": settings.broll_effort},
                messages=messages,
                output_format=Design,
            ) as stream:
                response = stream.get_final_message()
        except (anthropic.RateLimitError, anthropic.APIConnectionError,
                anthropic.InternalServerError) as exc:
            raise TransientError(f"Claude call failed: {type(exc).__name__}",
                                 status=getattr(exc, "status_code", None)) from exc
        if response.stop_reason == "refusal":
            log.warning("broll: the design request was declined (%s)",
                        getattr(response.stop_details, "category", None))
            return None, response.content
        if response.stop_reason == "max_tokens":
            raise ClipperError("broll: design hit max_tokens",
                               hint="Raise broll_max_tokens or lower broll_effort.")
        if response.parsed_output is None:
            raise TransientError(f"no structured output (stop_reason={response.stop_reason})")
        return response.parsed_output, response.content

    return with_retry(once, what="broll design", attempts=3, base_delay=3.0)


# ------------------------------------------------------------------ assembly

_ID = re.compile(r"^m\d{1,2}$")


def sanitize(design: Design, duration: float,
             solo: list[tuple[float, float]] | None = None) -> list[Moment]:
    """Drop moments that break the pacing or the contract before any render."""
    kept: list[Moment] = []
    for m in sorted(design.moments, key=lambda m: m.start):
        reason = None
        if not _ID.match(m.id) or any(k.id == m.id for k in kept):
            reason = "bad id"
        elif m.layout not in ("cutaway", "split", "overlay"):
            reason = f"unknown layout {m.layout!r}"
        elif m.start < 1.5 or m.end > duration - 1.0 or not (2.0 <= m.end - m.start <= 7.0):
            reason = f"timing {m.start:.1f}-{m.end:.1f}"
        elif kept and m.start < kept[-1].end + 1.5:
            reason = "too close to the previous moment"
        elif m.layout == "split" and not any(a - 0.2 <= m.start and m.end <= b + 0.2
                                             for a, b in (solo or [])):
            reason = "split over a shot that is not one person"
        elif re.search(r"<\s*(script|img|iframe|link)\b|https?://|\son\w+\s*=", m.html, re.I):
            reason = "forbidden markup"
        elif re.search(r"Math\.random|Date\.|performance\.now|setTimeout|setInterval|"
                       r"requestAnimationFrame|fetch\(|XMLHttpRequest|import\(|eval\(|new Function|"
                       r"repeat:\s*-1|\bregister\s*\(|\bpointer\s*\(|\btset\s*\(|\bstepS\s*\(|"
                       r"\bspring\s*\(|\btween\s*\(", m.animation):
            reason = "non-deterministic or unsafe code"
        if reason:
            log.warning("broll: dropping %s (%s)", m.id, reason)
            continue
        kept.append(m)
    return kept


def _box(layout: str) -> str:
    if layout == "split":
        return f"left:0;top:0;width:{W}px;height:{SPLIT_H}px"
    return f"left:0;top:0;width:{W}px;height:{H}px"


def assemble(moments: list[Moment], project: Path, *, duration: float, fps: int,
             accent: str | None = None, layer=None, shell: str = "",
             look: str = "editorial") -> Path:
    """
    One composition: the clip, the B-roll moments, and optionally a kinetic
    caption layer (kinetic.Layer) drawn above everything.
    """
    hosts, styles, calls = [], [], []
    for n, m in enumerate(moments):
        hosts.append(
            f'<div class="moment clip" id="{m.id}" data-start="{m.start:.3f}" '
            f'data-duration="{m.end - m.start:.3f}" data-track-index="{2 + n % 2}" '
            f'style="{_box(m.layout)}">\n{m.html}\n</div>'
        )
        styles.append(f"/* {m.id}: {m.idea} */\n{m.css}")
        calls.append(
            f"try {{ (function (tl, T, D, el, gsap, rand) {{\n{m.animation}\n}})"
            f"(tl, {m.start:.3f}, {m.end - m.start:.3f}, document.getElementById({json.dumps(m.id)}), gsap, rand); }}"
            f" catch (e) {{ console.error({json.dumps(m.id + ' failed: ')} + e); }}"
        )
        if m.layout == "split":
            # Slide the speaker down rather than resizing them: a transform
            # stays smooth under frame-by-frame capture where top/height snap
            # to whole pixels. SPLIT_SHIFT keeps the face (~0.38 of the frame)
            # in the upper part of the bottom half.
            calls.append(
                f'tl.fromTo("#video-wrap", {{ y: 0 }}, {{ y: {SPLIT_SHIFT}, duration: 0.45, ease: "power3.inOut" }}, {m.start:.3f});\n'
                f'tl.to("#video-wrap", {{ y: 0, duration: 0.4, ease: "power3.inOut" }}, {max(m.start, m.end - 0.4):.3f});'
            )

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
{FONT_FACES}
:root {{ --accent: {accent or "#E8453C"}; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000;
  font-family: "Inter Tight", "Inter", "Noto Sans Telugu", sans-serif; }}
#stage {{ position: relative; width: 100%; height: 100%; overflow: hidden; }}
#video-wrap {{ position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; overflow: hidden; }}
#video-wrap video {{ width: 100%; height: 100%; object-fit: cover; object-position: 50% 38%; }}
.moment {{ position: absolute; overflow: hidden; pointer-events: none; }}
{HAIRLINE_CSS}
{HAIRLINE_LIGHT if look == "explainer" else ""}
{shell}
{chr(10).join(styles)}
{layer.css if layer else ""}
</style>
</head>
<body>
<div id="stage" data-composition-id="broll" data-start="0" data-duration="{duration:.3f}" data-fps="{fps}" data-width="{W}" data-height="{H}">
<div id="video-wrap"><video id="bg-video" src="clip.mp4" playsinline muted data-start="0" data-duration="{duration:.3f}" data-track-index="1"></video></div>
{chr(10).join(hosts)}
{layer.html if layer else ""}
<script src="vendor/gsap.min.js"></script>
<script src="vendor/hairline.js"></script>
<script>
(function () {{
  const tl = gsap.timeline({{ paused: true }});
  const rand = function (i) {{ const x = Math.sin((i + 1) * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }};
{chr(10).join(calls)}
{layer.js if layer else ""}
  window.__timelines["broll"] = tl;
}})();
</script>
</div>
</body>
</html>
"""
    index = project / "index.html"
    index.write_text(html, encoding="utf-8")
    return index


def stage_project(project: Path, clean: Path, fps: int) -> None:
    """Fonts, GSAP and the clip, re-encoded so every frame is a seek point."""
    if project.exists():
        shutil.rmtree(project)
    (project / "vendor").mkdir(parents=True)
    shutil.copytree(BROLL_ASSETS / "fonts", project / "fonts")
    shutil.copy(BROLL_ASSETS / "gsap.min.js", project / "vendor" / "gsap.min.js")
    shutil.copy(BROLL_ASSETS / "hairline" / "kernel.js", project / "vendor" / "hairline.js")
    # A sparse GOP freezes the picture under the overlays when the renderer
    # seeks; one keyframe per second of frames makes every seek cheap.
    ffmpeg.run(["-i", str(clean), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
                "-g", str(fps), "-keyint_min", str(fps), "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", "clip.mp4"],
               cwd=project, what="broll stage clip")


# ------------------------------------------------------------------ CLI

def _npx() -> str:
    return shutil.which("npx") or shutil.which("npx.cmd") or "npx"


def _hf(args: list[str], cwd: Path, settings: Settings, timeout: int) -> subprocess.CompletedProcess:
    return subprocess.run(
        [_npx(), "-y", f"hyperframes@{settings.hyperframes_version}", *args],
        cwd=str(cwd), capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=timeout, env={**os.environ, "HYPERFRAMES_NO_UPDATE_CHECK": "1"},
    )


def lint_errors(project: Path, settings: Settings) -> list[str]:
    """Lint errors (not warnings) for the assembled composition."""
    proc = _hf(["lint", ".", "--json"], project, settings, timeout=180)
    try:
        start = proc.stdout.index("{")
        payload = json.loads(proc.stdout[start:])
    except (ValueError, json.JSONDecodeError):
        if proc.returncode != 0:
            return [f"lint could not run: {(proc.stderr or proc.stdout)[-500:]}"]
        return []
    findings = payload.get("findings") or payload.get("issues") or []
    errors = []
    for f in findings:
        if str(f.get("severity", "")).lower() == "error":
            where = f.get("selector") or f.get("elementId") or f.get("file") or ""
            errors.append(f"{f.get('code') or f.get('rule')}: {f.get('message')} {where}".strip())
    return errors


def render(project: Path, out: Path, settings: Settings, fps: int) -> None:
    with _RENDER_LOCK:
        proc = _hf(["render", ".", "-o", str(out), "--fps", str(fps), "--quality", "looks",
                    "--workers", str(settings.broll_render_workers), "--quiet"],
                   project, settings, timeout=settings.broll_render_timeout)
    if proc.returncode != 0 or not out.exists():
        tail = (proc.stderr or proc.stdout or "")[-800:]
        raise ClipperError("broll: render failed", hint=tail)


# ------------------------------------------------------------------ entry

def burn_captions(picture: Path, audio_from: Path, ass: Path, dest: Path, out_dir: Path,
                  *, captions: bool) -> None:
    """The final clip: picture + captions, with the clean render's audio untouched."""
    vf = ["-vf", f"ass={ass.name}:fontsdir=fonts:shaping=complex"] if captions else []
    ffmpeg.run(["-i", str(picture), "-i", str(audio_from), "-map", "0:v:0", "-map", "1:a:0?",
                *vf, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                "-c:a", "copy", "-movflags", "+faststart", "-shortest", dest.name],
               cwd=out_dir, what=f"{dest.stem} captions")


def apply(plan: ClipPlan, index: int, video: Path, ass: Path, words: list[Word],
          settings: Settings, *, fps: int, burn: bool, title: str | None = None,
          frame_plans: list | None = None, cache_dir: Path | None = None,
          ctx=None, audio: Path | None = None) -> dict | None:
    """
    Turn the caption-free render at `video` into the finished clip: B-roll
    moments when they are on and can be made, kinetic words when the style
    draws its captions in the browser. Always leaves a finished clip at
    `video` -- with plain burned captions if anything here fails.
    Returns a summary, or None when the clip went out plain.
    """
    from . import kinetic

    out_dir = video.parent
    clean = out_dir / f"{video.stem}_clean.mp4"
    clean.unlink(missing_ok=True)
    video.rename(clean)
    work = out_dir / f"{video.stem}_broll"
    duration = plan.total_duration
    style = settings.layout_style
    moments: list[Moment] = []
    layer = None
    picture, captions = clean, burn
    try:
        stage_project(work, clean, fps)
        if settings.broll:
            try:
                moments = _design(plan, index, words, settings, fps=fps, work=work, title=title,
                                  solo=solo_windows(plan, frame_plans), cache_dir=cache_dir) or []
            except Exception as exc:  # noqa: BLE001 - B-roll must never cost the clip
                log.warning("broll: clip_%02d goes out without B-roll: %s", index, exc)
        accent = settings.broll_accent or style.kinetic.get("accent") or "#3888F0"
        captions_layer = None
        if style.kinetic_on and burn:
            mode = style.kinetic.get("mode") or "kinetic"
            if mode == "kinetic" and not settings.card_layout:
                captions_layer = kinetic.build(
                    plan, words, settings, frame_plans=frame_plans, ctx=ctx, audio=audio,
                    blocked=[(m.start, m.end) for m in moments if m.layout != "overlay"],
                    accent=accent, script=style.kinetic.get("script", "roman"), seed=index)
            else:
                # Around-the-head placement means nothing once the speaker is a
                # card; kinetic falls back to centred emphasis lines there.
                captions_layer = kinetic.build_lines(
                    plan, words, settings, mode=mode if mode != "kinetic" else "emphasis",
                    audio=audio, accent=accent, script=style.kinetic.get("script", "roman"),
                    anchor_y=kinetic.CARD_ANCHOR if settings.card_layout else None)
        shell = ""
        reel_layer = None
        if settings.card_layout or settings.cta_keyword:
            from . import reel

            canvas, ink = reel.canvas_from(settings.canvas or accent)
            sections = (reel.plan_panels(plan, words, settings, fallback=title or plan.suggested_title,
                                         cache_dir=cache_dir) if settings.card_layout else [])
            reel_layer = reel.layer(duration, card=settings.card_layout, sections=sections,
                                    keyword=settings.cta_keyword, accent=accent,
                                    canvas=canvas, ink=ink)
            if settings.card_layout:
                shell = reel.shell_css(canvas)
            from .reel import merge
            layer = merge(captions_layer, reel_layer)
        else:
            layer = captions_layer
        if moments or layer or shell:
            assemble(moments, work, duration=duration, fps=fps, accent=accent,
                     layer=layer, shell=shell, look=settings.broll_look)
            errors = lint_errors(work, settings)
            if errors:
                raise ClipperError("overlay composition fails lint: " + "; ".join(errors[:4]))
            log.info("broll: clip_%02d rendering %d moment(s)%s", index, len(moments),
                     f" and caption/reel layers {layer.summary}" if layer else "")
            render(work, work / "broll.mp4", settings, fps)
            picture = work / "broll.mp4"
            captions = burn and captions_layer is None
    except Exception as exc:  # noqa: BLE001 - the clip ships plain rather than not at all
        log.warning("broll: clip_%02d goes out plain: %s", index, exc)
        moments, layer, picture, captions = [], None, clean, burn

    burn_captions(picture, clean, ass, video, out_dir, captions=captions)
    summary = None
    if picture != clean:
        summary = {"moments": [{"id": m.id, "start": m.start, "end": m.end, "layout": m.layout,
                                "idea": m.idea} for m in moments],
                   "kinetic": layer.summary if layer else None}
        (out_dir / f"{video.stem}_broll.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    if not settings.broll_keep_work:
        clean.unlink(missing_ok=True)
    return summary


def _design(plan: ClipPlan, index: int, words: list[Word], settings: Settings,
            *, fps: int, work: Path, title: str | None, solo: list[tuple[float, float]],
            cache_dir: Path | None) -> list[Moment] | None:
    """Claude's B-roll moments for one clip, checked and linted, not yet rendered."""
    duration = plan.total_duration
    timed = clip_words(plan, words)
    if duration < 12 or len(timed) < 10:
        log.info("broll: clip_%02d is too short for B-roll", index)
        return None

    prompt = build_prompt(plan, timed, duration, title=title, accent=settings.broll_accent,
                          solo=solo)
    # A design is paid for once: re-rendering the same clip (a new style, a
    # fixed bug downstream) reuses it while the prompt and the brief match.
    key = hashlib.sha256((prompt + system_prompt(settings.broll_look)
                          + settings.broll_model).encode()).hexdigest()[:16]
    cache = cache_dir / f"broll_{key}.json" if cache_dir else None
    if cache is not None and cache.exists():
        log.info("broll: clip_%02d reusing a cached design", index)
        design = Design.model_validate_json(cache.read_text(encoding="utf-8"))
        moments = sanitize(design, duration, solo)
        assemble(moments, work, duration=duration, fps=fps, accent=settings.broll_accent)
        if moments and not lint_errors(work, settings):
            return moments

    client = _client(settings)
    content = [*_stills(work / "clip.mp4", duration, work), {"type": "text", "text": prompt}]
    messages: list = [{"role": "user", "content": content}]

    for attempt in range(2):
        design, reply = _ask(client, settings, messages)
        if design is None:
            return None
        if cache is not None:
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(design.model_dump_json(indent=1), encoding="utf-8")
        moments = sanitize(design, duration, solo)
        if not moments:
            log.warning("broll: clip_%02d: no usable moments", index)
            return None
        assemble(moments, work, duration=duration, fps=fps, accent=settings.broll_accent)
        errors = lint_errors(work, settings)
        if not errors:
            break
        log.warning("broll: clip_%02d lint errors (attempt %d): %s", index, attempt + 1,
                    "; ".join(errors[:6]))
        if attempt == 1:
            raise ClipperError("broll: composition still fails lint after a repair")
        messages += [
            {"role": "assistant", "content": reply},
            {"role": "user", "content": "The assembled composition fails HyperFrames lint with "
             "these errors. Return the complete corrected set of moments (all of them, not just "
             "the broken ones):\n- " + "\n- ".join(errors[:20])},
        ]

    log.info("broll: clip_%02d designed %d moment(s): %s", index, len(moments),
             ", ".join(f"{m.id} {m.layout} {m.start:.1f}-{m.end:.1f}s" for m in moments))
    return moments
