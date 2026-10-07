"""
A cover image per clip: the best still of the speaker, with the hook on it.

The frame is rendered from the SOURCE through the clip's own framing, not
grabbed from the finished clip. The finished clip has captions burned in, and a
cover with half a sentence across the bottom looks like a screenshot.

Which frame: the reframe already measured every face at 5fps, including how
much its mouth was moving. A big face with a still mouth is a person caught
between words -- the frame a photographer would pick -- where a mid-syllable
frame catches the face half-shaped. Without detections (centre crop, screen
recordings) the third of the way in is as good a guess as any.

Text is drawn by libass, like the captions, so Telugu shapes correctly; it
sits in the lower third over a gradient, clear of the face line and inside the
3:4 window Instagram's profile grid crops to.
"""
from __future__ import annotations

import copy
import logging
import re
from pathlib import Path

from . import ffmpeg, reframe
from .captions import Measurer, _family_of
from .config import ASSETS_DIR, Settings
from .models import ClipPlan

log = logging.getLogger(__name__)

FONT = "Anton-Regular.ttf"
FALLBACK_FONT = "Peddana-Regular.ttf"   # Telugu, for titles Anton cannot draw
ACCENT = "#FFD400"
TEXT_TOP = 0.60          # of the canvas: below the face line (0.38)
TEXT_BOTTOM = 0.84       # Instagram's 3:4 grid crop ends at 0.875
MAX_LINES = 3


def _segments(text: str) -> list[tuple[str, bool]]:
    """Words with their accent flag; *starred* words take the accent."""
    out: list[tuple[str, bool]] = []
    accent = False
    for token in re.split(r"(\*)", text.strip()):
        if token == "*":
            accent = not accent
            continue
        out.extend((w, accent) for w in token.split())
    return out


def _fit(segments, width: float, height: float, canvas_h: int):
    start, floor = int(canvas_h * 0.11), int(canvas_h * 0.05)
    size = start
    while size >= floor:
        measure = Measurer(ASSETS_DIR / FONT, size).width
        lines: list[list[tuple[str, bool]]] = []
        cur: list[tuple[str, bool]] = []
        for seg in segments:
            trial = " ".join(w for w, _ in [*cur, seg])
            if cur and measure(trial) > width:
                lines.append(cur)
                cur = [seg]
            else:
                cur.append(seg)
        if cur:
            lines.append(cur)
        fits = (len(lines) <= MAX_LINES and len(lines) * size * 1.05 <= height
                and all(measure(" ".join(w for w, _ in l)) <= width for l in lines))
        if fits:
            return lines, size
        size -= 4
    return None, floor


def _ass_colour(hex_rgb: str) -> str:
    h = hex_rgb.lstrip("#")
    return f"&H00{h[4:6]}{h[2:4]}{h[0:2]}&"


def write_cover_ass(text: str, dest: Path, settings: Settings) -> bool:
    """The cover's text layer. False when there is nothing worth drawing."""
    W, H = settings.out_width, settings.out_height
    segments = [(w.upper(), a) for w, a in _segments(text)]
    if not segments:
        return False
    lines, size = _fit(segments, W * 0.86, H * (TEXT_BOTTOM - TEXT_TOP), H)
    if not lines:
        log.info("cover: %r does not fit; drawing no text", text[:40])
        return False
    family = _family_of(ASSETS_DIR / FONT)
    plain, accent = _ass_colour("#FFFFFF"), _ass_colour(ACCENT)
    body = "\\N".join(
        " ".join(f"{{\\c{accent if a else plain}}}{w}" for w, a in line) for line in lines
    )
    margin_v = int(round(H * (1 - TEXT_BOTTOM)))
    dest.write_text(f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cover,{family},{size},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,1,0,1,3,4,2,60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:10.00,Cover,,0,0,0,,{body}
""", encoding="utf-8")
    return True


def pick_time(plan: ClipPlan, frame_plans: list | None, ctx) -> tuple[int, float]:
    """(span index, seconds into that span) of the best still."""
    fallback = (0, min(plan.spans[0].duration * 0.33, 6.0))
    if ctx is None or not getattr(ctx, "detections", None) or not ctx.detections.samples:
        return fallback
    det = ctx.detections
    best, best_score = fallback, float("-inf")
    for n, span in enumerate(plan.spans):
        fp = frame_plans[n] if frame_plans and n < len(frame_plans) else None
        if fp is None or any(r.kind == "screen" for r in fp.runs):
            continue
        lo, hi = span.source_start + 1.0, span.source_end - 1.0
        for s in det.samples:
            if not (lo <= s.t <= hi) or not s.faces:
                continue
            rel = s.t - span.source_start
            run = next((r for r in fp.runs if r.start <= rel < r.end), None)
            if run is None or run.kind != "single":
                continue
            face = max(s.faces, key=lambda f: f.w * f.h)
            size = face.h / det.height
            still = 1.0 - min(1.0, (face.mouth_motion or 0.0) * 4)
            # Faces looking at the lens score higher on YuNet; reward that too.
            score = size * 2.0 + still + face.score
            if score > best_score:
                best, best_score = (n, rel), score
    return best


def render(plan: ClipPlan, index: int, media_path: Path, out_dir: Path,
           settings: Settings, *, frame_plans: list | None, ctx, fps: int,
           text: str | None) -> Path | None:
    """Write clip_NN_cover.jpg next to the clip. None if it could not be made."""
    dest = out_dir / f"clip_{index:02d}_cover.jpg"
    try:
        n, rel = pick_time(plan, frame_plans, ctx)
        span = plan.spans[n]
        fp = frame_plans[n] if frame_plans and n < len(frame_plans) else None
        at = span.source_start + rel

        parts: list[str]
        if fp is None:
            parts = [f"[0:v]{reframe.centre_crop_chain(settings)}[pic]"]
        else:
            run = next((r for r in fp.runs if r.start <= rel < r.end), fp.runs[0])
            one = copy.copy(fp)
            one.runs = [_with_times(run)]
            chunk, vlabel, _ = reframe.build_span_graph(one, settings, first_input=0,
                                                        label="c", fps=fps)
            parts = [*chunk, f"[{vlabel}]null[pic]"]
        pad = reframe.pad_to_canvas(settings)
        if pad:
            parts.append(f"[pic]{pad}[pic2]")
        else:
            parts.append("[pic]null[pic2]")

        W, H = settings.out_width, settings.out_height
        ass = out_dir / f"clip_{index:02d}_cover.ass"
        has_text = bool(text) and write_cover_ass(text, ass, settings)
        if has_text:
            # FONT and FALLBACK_FONT are staged into out_dir/fonts by the caller,
            # under the same lock as the caption fonts.
            # Darken toward the bottom so white text reads over any frame.
            parts.append(
                f"color=c=black:s={W}x{H}:d=1,format=rgba,"
                f"geq=r=0:g=0:b=0:a='if(gt(Y,H*0.45),min(1,(Y-H*0.45)/(H*0.35))*215,0)'[shade]"
            )
            parts.append("[pic2][shade]overlay=0:0:format=auto[shaded]")
            parts.append(f"[shaded]ass={ass.name}:fontsdir=fonts:shaping=complex[out]")
        else:
            parts.append("[pic2]null[out]")

        ffmpeg.run(
            ["-ss", f"{at:.3f}", "-t", "0.5", "-i", str(media_path),
             "-filter_complex", ";".join(parts), "-map", "[out]",
             "-frames:v", "1", "-q:v", "2", dest.name],
            cwd=out_dir, what=f"clip_{index:02d} cover",
        )
        return dest if dest.exists() else None
    except Exception as exc:  # noqa: BLE001 - a cover must never cost the clip
        log.warning("cover: clip_%02d cover failed: %s", index, exc)
        return None


def _with_times(run):
    clone = copy.copy(run)
    clone.start, clone.end = 0.0, 0.2
    return clone
