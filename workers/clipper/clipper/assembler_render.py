"""
Build the ffmpeg filtergraph that turns a span list into one clip.

Every span becomes its own input (the same file opened at a different offset),
each is reframed independently, and consecutive spans are dissolved together
with `xfade` / `acrossfade`. The captions are burned onto the assembled result
as a single pass, so their timings are in assembled time throughout.

Why every join is an xfade, including "hard": mixing `concat` and `xfade` in one
graph means tracking two different notions of stream time and re-deriving every
offset at the boundary between them. A "hard" cut is instead a one-frame
dissolve -- visually indistinguishable from a cut, inaudible at 40ms -- which
keeps a single uniform chain and one offset formula.

The offset formula is the whole reason the caption maths lines up:

    xfade offset for join k  ==  spans[k+1].playback_start

because a dissolve starting at `offset` is exactly when the incoming span
begins on the assembled timeline, which is what assemble.lay_out computed.
"""
from __future__ import annotations

import logging

from .config import Settings
from .models import ClipPlan

log = logging.getLogger(__name__)


def reframe_chain(settings: Settings) -> str:
    return (f"scale={settings.video_w}:{settings.video_h}"
            f":force_original_aspect_ratio=increase,"
            f"crop={settings.video_w}:{settings.video_h}")


def build_inputs(plan: ClipPlan, media_path: str,
                 frame_plans: list | None = None) -> list[str]:
    """
    Decodes for the whole clip.

    Without reframing, one per span. With it, one per LAYOUT RUN inside each
    span plus one for that span's audio, because each run needs its own trimmed
    range and audio must stay continuous across layout changes.
    """
    from . import reframe

    args: list[str] = []
    for n, span in enumerate(plan.spans):
        fp = frame_plans[n] if frame_plans and n < len(frame_plans) else None
        if fp is None:
            args += ["-ss", f"{span.source_start:.3f}",
                     "-t", f"{span.duration:.3f}", "-i", media_path]
        else:
            args += reframe.span_inputs(fp, media_path, span.source_start,
                                        span.duration)
    return args


def build_filtergraph(
    plan: ClipPlan, settings: Settings, *, ass_name: str | None, fps: int = 30,
    frame_plans: list | None = None, zoom: str = "",
) -> tuple[str, str, str]:
    """
    Returns (filter_complex, video_label, audio_label).

    Each span is normalised to a common size, pixel format, frame rate and
    sample rate first. xfade silently misbehaves when its two inputs disagree
    on any of those, and the failure looks like a corrupted transition rather
    than an error.
    """
    from . import reframe

    default = reframe_chain(settings)
    parts: list[str] = []
    vlabels: list[str] = []
    alabels: list[str] = []
    cursor = 0

    for n, span in enumerate(plan.spans):
        fp = frame_plans[n] if frame_plans and n < len(frame_plans) else None
        if fp is None:
            parts.append(
                f"[{cursor}:v]{default},fps={fps},format=yuv420p,setsar=1,"
                f"setpts=PTS-STARTPTS[v{n}]"
            )
            parts.append(
                f"[{cursor}:a]aformat=sample_fmts=fltp:sample_rates=48000"
                f":channel_layouts=stereo,asetpts=PTS-STARTPTS[a{n}]"
            )
            vlabels.append(f"v{n}")
            alabels.append(f"a{n}")
            cursor += 1
            continue

        # One input per layout run for video, then one covering the whole span
        # for audio -- audio is never cut at a layout boundary.
        chunk, out, used = reframe.build_span_graph(
            fp, settings, first_input=cursor, label=f"s{n}", fps=fps
        )
        parts.extend(chunk)
        audio_idx = cursor + used
        parts.append(
            f"[{audio_idx}:a]aformat=sample_fmts=fltp:sample_rates=48000"
            f":channel_layouts=stereo,asetpts=PTS-STARTPTS[a{n}]"
        )
        vlabels.append(out)
        alabels.append(f"a{n}")
        cursor += used + 1

    vlabel, alabel = vlabels[0], alabels[0]
    for k, join in enumerate(plan.joins):
        nxt = k + 1
        offset = plan.spans[nxt].playback_start
        duration = max(join.duration, 1.0 / fps)
        parts.append(
            f"[{vlabel}][{vlabels[nxt]}]xfade=transition=fade"
            f":duration={duration:.3f}:offset={offset:.3f}[vx{nxt}]"
        )
        parts.append(
            f"[{alabel}][{alabels[nxt]}]acrossfade=d={duration:.3f}"
            f":c1=tri:c2=tri[ax{nxt}]"
        )
        vlabel, alabel = f"vx{nxt}", f"ax{nxt}"

    from . import reframe as _reframe

    # Punch-ins go on the assembled picture, in assembled time, before the
    # padding and captions -- a zoomed caption is a different size every cut.
    if zoom:
        parts.append(f"[{vlabel}]{zoom}[vzoom]")
        vlabel = "vzoom"
    pad = _reframe.pad_to_canvas(settings)
    if pad:
        parts.append(f"[{vlabel}]{pad}[vpad]")
        vlabel = "vpad"
    if ass_name:
        parts.append(
            f"[{vlabel}]ass={ass_name}:fontsdir=fonts:shaping=complex[vout]"
        )
        vlabel = "vout"

    return ";".join(parts), vlabel, alabel


def build_command(
    plan: ClipPlan, media_path: str, out_name: str, settings: Settings,
    *, ass_name: str | None, fps: int = 30,
    frame_plans: list | None = None, zoom: str = "",
) -> list[str]:
    graph, vlabel, alabel = build_filtergraph(
        plan, settings, ass_name=ass_name, fps=fps, frame_plans=frame_plans,
        zoom=zoom,
    )
    return [
        *build_inputs(plan, media_path, frame_plans),
        "-filter_complex", graph,
        "-map", f"[{vlabel}]", "-map", f"[{alabel}]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        out_name,
    ]
