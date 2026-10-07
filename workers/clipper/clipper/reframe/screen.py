"""
Screen recordings: the screen on top, the presenter's webcam below.

The speaker-tracked reframe assumes the face IS the picture. In a tutorial or a
demo it is a thumbnail in a corner, and following it crops away the thing the
video is about -- or, below the detection threshold, falls back to a centre
crop that cuts the screen in half. Neither is right for this footage, so it
gets its own layout instead of being bent through the speaker one.

Recognising it is deliberately narrow. A webcam overlay has a signature no
camera shot has: a SMALL face that never moves, parked in a CORNER. Each test
alone has innocent explanations (a wide shot, a static guest, someone sitting
at the edge); together they almost never happen outside a screen recording.
Anything that fails them stays on the speaker path that already works, and
the user can force this layout for the cases the detector refuses.
"""
from __future__ import annotations

import logging
import statistics
from dataclasses import dataclass

from ..config import Settings
from .detect import Detections
from .path import FramePlan, Panel, Run

log = logging.getLogger(__name__)

# Webcam signature, as fractions of the frame. Measured on screen recordings:
# a 1080p capture with a 320x180 overlay puts a face at ~7% of frame height,
# while a two-person wide podcast shot puts faces at 12-18%.
MAX_FACE_H = 0.13
CORNER = 0.34           # centre within this fraction of a horizontal edge...
CORNER_Y = 0.36         # ...and of a vertical one
MAX_DRIFT = 0.05        # std of the centre: an overlay does not move
MIN_PRESENCE = 0.3      # of sampled frames carrying that face


@dataclass(frozen=True)
class ScreenLayout:
    """The webcam crop in SOURCE pixels, or None when there is no presenter."""
    face: tuple[float, float, float, float] | None
    reason: str


def _largest(sample):
    return max(sample.faces, key=lambda f: f.w * f.h) if sample.faces else None


def detect_layout(det: Detections | None, settings: Settings,
                  *, scale: float, forced: bool) -> ScreenLayout | None:
    """
    A ScreenLayout when this source is a screen recording, else None.

    `forced` is the user saying so; then the only open question is whether
    there is a webcam to show, and a source with no steady face simply gets the
    screen on its own.
    """
    if det is None or not det.samples:
        return ScreenLayout(None, "no face detection; screen only") if forced else None

    faces = [f for f in (_largest(s) for s in det.samples) if f is not None]
    presence = len(faces) / len(det.samples)
    W, H = det.width, det.height
    if presence < MIN_PRESENCE or not W or not H:
        if forced:
            return ScreenLayout(None, f"a face in only {presence:.0%} of frames; screen only")
        return None

    h_frac = statistics.median(f.h / H for f in faces)
    cx = [f.cx / W for f in faces]
    cy = [f.cy / H for f in faces]
    mcx, mcy = statistics.median(cx), statistics.median(cy)
    drift = max(statistics.pstdev(cx), statistics.pstdev(cy))
    in_corner = ((mcx < CORNER or mcx > 1 - CORNER)
                 and (mcy < CORNER_Y or mcy > 1 - CORNER_Y))
    looks_like_overlay = h_frac < MAX_FACE_H and in_corner and drift < MAX_DRIFT

    if not forced and not looks_like_overlay:
        return None

    # Median box, so one false detection cannot drag the crop.
    box = (statistics.median(f.x for f in faces), statistics.median(f.y for f in faces),
           statistics.median(f.w for f in faces), statistics.median(f.h for f in faces))
    if forced and not looks_like_overlay and h_frac >= MAX_FACE_H:
        # Forced on footage whose face is big and central -- probably a talking
        # head with slides behind. Show it anyway; the user asked.
        log.info("screen: forced on a source that does not look like a screen "
                 "recording (face %.0f%% of height)", 100 * h_frac)
    reason = (f"webcam overlay: face {h_frac:.0%} of frame height at "
              f"({mcx:.2f}, {mcy:.2f}), drift {drift:.3f}, present {presence:.0%}")
    log.info("screen: %s", reason)
    x, y, w, h = (v * scale for v in box)
    return ScreenLayout((x, y, w, h), reason)


def panel_heights(settings: Settings, source_w: int, source_h: int,
                  with_face: bool) -> tuple[int, int]:
    """(screen panel height, face panel height) inside the video rect."""
    vw, vh = settings.video_w, settings.video_h
    screen_h = int(round(vw * source_h / source_w / 2)) * 2
    screen_h = min(screen_h, vh)
    if not with_face:
        return screen_h, 0
    # Keep at least a third of the frame for the presenter, or they become a
    # postage stamp under a screen that already fills the width.
    screen_h = min(screen_h, int(vh * 2 / 3) // 2 * 2)
    return screen_h, vh - screen_h


def face_crop(face: tuple[float, float, float, float], *, source_w: int,
              source_h: int, panel_w: int, panel_h: int) -> Panel:
    """A crop around the webcam face with the face panel's aspect."""
    x, y, w, h = face
    aspect = panel_w / panel_h
    crop_h = min(h * 3.0, float(source_h))
    crop_w = crop_h * aspect
    if crop_w > source_w:
        crop_w = float(source_w)
        crop_h = crop_w / aspect
    cx = x + w / 2
    # Face high in its panel, as everywhere else in the reframe.
    cy = y + h / 2 + crop_h * 0.12
    cx0 = min(max(cx - crop_w / 2, 0.0), source_w - crop_w)
    cy0 = min(max(cy - crop_h / 2, 0.0), source_h - crop_h)
    return Panel(identity=-2, crop_x=cx0, crop_y=cy0, crop_w=crop_w, crop_h=crop_h)


def plan_for_span(layout: ScreenLayout, *, duration: float, fps: float,
                  source_w: int, source_h: int, settings: Settings) -> FramePlan:
    """One constant run: the whole screen, plus the webcam if there is one."""
    n = max(1, int(round(duration * fps)))
    screen = Panel(identity=-1, crop_x=0.0, crop_y=0.0,
                   crop_w=float(source_w), crop_h=float(source_h))
    panels = [screen]
    if layout.face is not None:
        _, face_h = panel_heights(settings, source_w, source_h, True)
        panels.append(face_crop(layout.face, source_w=source_w, source_h=source_h,
                                panel_w=settings.video_w, panel_h=face_h))
    plan = FramePlan(fps=fps, crop_w=float(source_w), crop_h=float(source_h),
                     source_w=source_w, source_h=source_h, note=layout.reason)
    plan.runs = [Run(0.0, duration, "screen", "screen", None, panels=panels)]
    plan.xs = [0.0] * n
    plan.active = [None] * n
    return plan


def screen_chains(run: Run, settings: Settings, label: str) -> tuple[list[str], str]:
    """Filtergraph for a screen run: stacked with the webcam, or on a blurred fill."""
    vw, vh = settings.video_w, settings.video_h
    source_w, source_h = int(run.panels[0].crop_w), int(run.panels[0].crop_h)
    with_face = len(run.panels) > 1
    screen_h, face_h = panel_heights(settings, source_w, source_h, with_face)
    if with_face:
        face = run.panels[1]
        return [
            f"[{label}]split=2[{label}s][{label}f]",
            f"[{label}s]scale={vw}:{screen_h}:force_original_aspect_ratio=decrease,"
            f"pad={vw}:{screen_h}:(ow-iw)/2:(oh-ih)/2:black[{label}sc]",
            f"[{label}f]crop={int(face.crop_w)}:{int(face.crop_h)}"
            f":{int(round(face.crop_x))}:{int(round(face.crop_y))},"
            f"scale={vw}:{face_h}:force_original_aspect_ratio=increase,"
            f"crop={vw}:{face_h}[{label}fc]",
            f"[{label}sc][{label}fc]vstack=inputs=2[{label}v]",
        ], f"{label}v"
    # No presenter: the screen, full width, over a blurred copy of itself. Bars
    # would waste most of a phone screen; the blur keeps it from reading as a
    # letterboxed upload.
    return [
        f"[{label}]split=2[{label}b][{label}s]",
        f"[{label}b]scale={vw}:{vh}:force_original_aspect_ratio=increase,"
        f"crop={vw}:{vh},boxblur=24:2,eq=brightness=-0.12[{label}bg]",
        f"[{label}s]scale={vw}:{screen_h}:force_original_aspect_ratio=decrease[{label}fg]",
        f"[{label}bg][{label}fg]overlay=(W-w)/2:(H-h)/2[{label}v]",
    ], f"{label}v"
