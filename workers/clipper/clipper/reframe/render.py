"""
Stage D: turn framing runs into a filtergraph.

Because every run is a CONSTANT crop, there is nothing to drive per frame --
`sendcmd` was needed only while the crop moved continuously, and locking removed
the reason for it. A run is a static `crop`, and a boundary between runs is a
concat boundary.

Layout changes are handled with the **concat filter**, not the concat demuxer
and not overlay/streamselect:

* the concat *demuxer* joins separately-encoded files, which is exactly what
  puts a visible seam at every boundary -- forced keyframe, rate-control
  restart;
* *overlay* or *streamselect* with enable expressions is seamless but runs BOTH
  chains for every frame, paying for two crops, two scales and a vstack all the
  way through a clip that is split only 23% of the time;
* the concat *filter* joins the runs inside a single graph, so the whole clip is
  encoded **once** -- no seam is possible -- and each frame passes through
  exactly one layout.

Measured on real footage, a 90-second window contained 4 layout runs with a
median length of 20.4s, so the cost is four short decodes of the same file.

Audio is never segmented. A layout change is purely visual, so the audio comes
from one continuous trim of the whole span and cannot acquire a seam.
"""
from __future__ import annotations

import logging

from ..config import Settings
from .path import FramePlan, Run

log = logging.getLogger(__name__)


def centre_crop_chain(settings: Settings) -> str:
    """The fallback, and the path taken when reframing is switched off."""
    return (f"scale={settings.video_w}:{settings.video_h}"
            f":force_original_aspect_ratio=increase,"
            f"crop={settings.video_w}:{settings.video_h}")


def pad_to_canvas(settings: Settings) -> str:
    """
    Place the rendered picture on the canvas, or nothing for full-bleed.

    Returned as a chain fragment rather than applied here so callers can put
    it BEFORE the subtitle filter: captions and the headline are positioned in
    canvas coordinates, so they have to be drawn after the padding exists.
    """
    rect = settings.video_rect
    if rect.w >= settings.out_width and rect.h >= settings.out_height:
        return ""
    from .. import styles as _styles

    bg = settings.layout_style.canvas["bg"]
    return (f"pad={settings.out_width}:{settings.out_height}"
            f":{int(rect.x)}:{int(rect.y)}:{bg.replace('#', '0x')}")


def single_chain(run: Run, plan: FramePlan, settings: Settings) -> str:
    """Static crop for one person, scaled to the full output frame."""
    return (f"crop={int(plan.crop_w)}:{int(plan.crop_h)}"
            f":{int(round(run.crop_x))}:{int(round(run.crop_y))},"
            f"scale={settings.video_w}:{settings.video_h}")


def split_chains(run: Run, settings: Settings, label: str) -> tuple[list[str], str]:
    """
    Two stacked panels from one input.

    The source is split into two branches, each cropped around its own locked
    position and scaled to fill half the output, then stacked. `scale` uses
    force_original_aspect_ratio=increase followed by a crop so the panel is
    filled rather than letterboxed -- bars would waste a third of a format whose
    whole point is filling a phone screen.
    """
    panel_h = settings.video_h // 2
    parts = [f"[{label}]split=2[{label}a][{label}b]"]
    for tag, panel in zip("ab", run.panels):
        parts.append(
            f"[{label}{tag}]crop={int(panel.crop_w)}:{int(panel.crop_h)}"
            f":{int(round(panel.crop_x))}:{int(round(panel.crop_y))},"
            f"scale={settings.video_w}:{panel_h}"
            f":force_original_aspect_ratio=increase,"
            f"crop={settings.video_w}:{panel_h}[{label}{tag}c]"
        )
    # Left person on top, right person on bottom -- fixed, never reordered by
    # who is speaking.
    parts.append(f"[{label}ac][{label}bc]vstack=inputs=2[{label}v]")
    return parts, f"{label}v"


def build_span_graph(
    plan: FramePlan, settings: Settings, *, first_input: int, label: str,
    fps: int,
) -> tuple[list[str], str, int]:
    """
    Filtergraph for one span's video.

    Returns (graph parts, output label, inputs consumed). One input per run,
    because each run needs its own trimmed range of the source.
    """
    parts: list[str] = []
    outs: list[str] = []

    for n, run in enumerate(plan.runs):
        idx = first_input + n
        tag = f"{label}r{n}"
        if run.kind == "split" and len(run.panels) == 2:
            parts.append(f"[{idx}:v]setpts=PTS-STARTPTS[{tag}in]")
            chains, out = split_chains(run, settings, f"{tag}in")
            parts.extend(chains)
        else:
            parts.append(f"[{idx}:v]{single_chain(run, plan, settings)}[{tag}v]")
            out = f"{tag}v"
        # Normalise before concat: it refuses inputs that disagree on size,
        # pixel format, aspect or frame rate, and the failure is obscure.
        parts.append(f"[{out}]fps={fps},format=yuv420p,setsar=1,"
                     f"setpts=PTS-STARTPTS[{tag}n]")
        outs.append(f"[{tag}n]")

    # Normalise the span output's TIMEBASE, not just its size and rate.
    #
    # concat emits at 1/1000000 while a single run passed straight through keeps
    # 1/25. xfade then refuses to join them:
    #   "First input link main timebase (1/25) do not match the corresponding
    #    second input link xfade timebase (1/1000000)"
    # That only shows up when one span has several layout runs and the other has
    # one -- which no earlier test happened to produce.
    if len(outs) == 1:
        src = outs[0].strip("[]")
    else:
        parts.append(f"{''.join(outs)}concat=n={len(outs)}:v=1:a=0[{label}cc]")
        src = f"{label}cc"
    parts.append(f"[{src}]settb=1/{fps},fps={fps},setsar=1,"
                 f"format=yuv420p[{label}cat]")
    return parts, f"{label}cat", len(plan.runs)


def span_inputs(plan: FramePlan, media_path: str, span_start: float,
                span_duration: float) -> list[str]:
    """
    One decode per run for video, plus one covering the whole span for audio.

    The audio input is deliberately separate and un-segmented: cutting audio at
    a layout boundary would be audible, and a layout change is a visual event
    only.
    """
    args: list[str] = []
    for run in plan.runs:
        args += ["-ss", f"{span_start + run.start:.3f}",
                 "-t", f"{run.duration:.3f}", "-i", media_path]
    args += ["-ss", f"{span_start:.3f}", "-t", f"{span_duration:.3f}",
             "-i", media_path]
    return args


def describe(plan: FramePlan) -> str:
    return ", ".join(
        f"{r.kind}@{r.start:.1f}s({r.duration:.1f}s)" for r in plan.runs
    )
