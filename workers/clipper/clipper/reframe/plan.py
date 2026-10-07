"""
The seam between the pipeline and the reframe stages.

Detection and speaker matching are whole-video, one-off and cached; crop paths
are per span. This module owns that split so cut.py does not have to, and so
the expensive half runs once no matter how many clips get cut.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

from ..config import Paths, Settings
from .active import (
    Assignment, Identity, assign_speakers, build_tracks, cluster_identities,
    is_single_face, turns_from_transcript,
)
from . import panes, screen
from .detect import Detections, ReframeError, detect
from .path import FramePlan, build_plan

log = logging.getLogger(__name__)


@dataclass
class ReframeContext:
    """Everything whole-video, computed once per source."""
    detections: Detections
    identities: list[Identity]
    assignments: dict[str, Assignment]
    turns: list[tuple[float, float, str]]
    proxy_path: Path
    proxy_scale: float          # proxy pixels -> source pixels
    single_face: bool
    # Divider of a side-by-side source, in SOURCE pixels, or None for a normal
    # single-camera frame. Detected once: it cannot move within a source.
    divider: tuple[float, float] | None = None
    # Set when the source is a screen recording; overrides speaker framing.
    screen: screen.ScreenLayout | None = None

    @property
    def usable(self) -> bool:
        return bool(self.identities)


def load_turns(paths: Paths, asr_cache: Path | None) -> list[tuple[float, float, str]]:
    """Speaker turns from the cached Sarvam payload, if diarization produced any."""
    if asr_cache and asr_cache.exists():
        try:
            payload = json.loads(asr_cache.read_text(encoding="utf-8"))
            return turns_from_transcript(payload)
        except json.JSONDecodeError:
            log.warning("reframe: ASR cache unreadable; treating as single speaker")
    return []


def prepare(
    paths: Paths, settings: Settings, *, proxy_path: Path, source_w: int,
    asr_cache: Path | None = None, use_cache: bool = True,
) -> ReframeContext | None:
    """
    Run detection and speaker matching for a whole source.

    Returns None when reframing cannot or should not run, which callers treat
    as "centre crop, carry on" -- never as an error. Screen recordings, b-roll
    and drone shots have to keep working.
    """
    forced = settings.layout == "screen"
    if not settings.reframe and not forced:
        log.info("reframe: disabled; using centre crop")
        return None

    det = None
    if proxy_path.exists():
        try:
            det = detect(proxy_path, paths.faces, settings, use_cache=use_cache)
        except ReframeError as exc:
            log.warning("reframe: detection unavailable (%s)", exc)
    else:
        log.warning("reframe: no analysis proxy at %s", proxy_path)

    # Checked before the face threshold: a webcam overlay can sit either side
    # of it, and on either side the speaker path frames it wrong.
    scale = source_w / det.width if det is not None and det.width else 1.0
    if forced or (det is not None and settings.layout == "auto"):
        layout = screen.detect_layout(det, settings, scale=scale, forced=forced)
        if layout is not None:
            return ReframeContext(
                detections=det or Detections(0, 0, 0.0, 0.0, []), identities=[],
                assignments={}, turns=[], proxy_path=proxy_path,
                proxy_scale=scale, single_face=False, screen=layout,
            )
    if det is None:
        log.warning("reframe: using centre crop")
        return None

    if det.detection_ratio < settings.reframe_min_detection_ratio:
        log.warning(
            "reframe: only %.0f%% of sampled frames contain a face (threshold "
            "%.0f%%); using centre crop. This is expected for screen "
            "recordings, b-roll and drone footage.",
            100 * det.detection_ratio,
            100 * settings.reframe_min_detection_ratio,
        )
        return None

    turns = load_turns(paths, asr_cache)
    tracks = build_tracks(det, settings)
    # Diarization already knows how many people speak. Without that cap,
    # positional clustering splits one person across camera angles -- measured
    # on real footage it produced three identities for two speakers, and the
    # spurious third stole enough samples to drop an assignment to 0.10
    # confidence.
    speakers = speaker_count(turns)
    cap = max(1, speakers) if speakers else settings.max_identities
    identities = cluster_identities(tracks, det, settings,
                                    max_identities=min(cap, settings.max_identities))

    single = is_single_face(det, turns)
    if single and identities:
        # One face, one speaker: nothing to disambiguate, and running the
        # matcher would only invent a decision it cannot get right.
        identities = [max(identities, key=lambda i: i.coverage)]
        assignments = {
            (turns[0][2] if turns else "0"):
                Assignment(turns[0][2] if turns else "0", identities[0].id, 1.0,
                           "single-face fast path")
        }
        log.info("reframe: single-face fast path (%d%% of frames have one face)",
                 int(100 * det.detection_ratio))
    else:
        assignments = assign_speakers(identities, turns, settings)

    # Only frames showing two faces can show a composite join, and those are
    # exactly the frames a split layout would be built from. Sampling several
    # spread across the source matters because this footage CUTS between a
    # composite and full-frame singles.
    two_face_times = [s_.t for s_ in det.samples if len(s_.faces) >= 2]
    if len(two_face_times) > 8:
        step = len(two_face_times) // 8
        two_face_times = two_face_times[::step][:8]
    divider = panes.divider_for_source(proxy_path, two_face_times,
                                       proxy_scale=scale)

    return ReframeContext(
        detections=det, identities=identities, assignments=assignments,
        turns=turns, proxy_path=proxy_path, proxy_scale=scale,
        single_face=single, divider=divider,
    )


def speaker_count(turns: list[tuple[float, float, str]]) -> int:
    """
    How many people speak -- the most found within any single ASR part.

    Long sources are transcribed as several files, and Sarvam numbers speakers
    per file, so labels arrive namespaced ("p0:1", "p1:1"). Counting distinct
    labels across the whole source would double the count for a two-person
    podcast split in two, and this number caps identity clustering -- the cap
    exists precisely because an uncapped clusterer invents a spurious third
    person who then steals samples from a real one.
    """
    per_part: dict[str, set[str]] = {}
    for _, _, who in turns:
        part, _, label = who.rpartition(":")
        per_part.setdefault(part, set()).add(label)
    return max((len(v) for v in per_part.values()), default=0)


def path_for_span(
    ctx: ReframeContext, *, start: float, duration: float, fps: float,
    source_w: int, source_h: int, settings: Settings,
) -> FramePlan:
    """
    Framing plan for one span, in SOURCE pixels.

    Detection ran on the proxy, so every coordinate is scaled up here. Doing it
    at the boundary keeps the rest of the reframe code in one coordinate space.
    """
    if ctx.screen is not None:
        return screen.plan_for_span(ctx.screen, duration=duration, fps=fps,
                                    source_w=source_w, source_h=source_h,
                                    settings=settings)
    scaled = _scaled_identities(ctx)
    return build_plan(
        scaled, ctx.assignments, ctx.turns,
        source_w=source_w, source_h=source_h,
        start=start, duration=duration, fps=fps,
        settings=settings, detection_ratio=ctx.detections.detection_ratio,
        divider=ctx.divider,
    )


def _scaled_identities(ctx: ReframeContext) -> list[Identity]:
    """Identities with face boxes expressed in source pixels."""
    from copy import deepcopy

    if abs(ctx.proxy_scale - 1.0) < 1e-6:
        return ctx.identities
    out: list[Identity] = []
    for identity in ctx.identities:
        clone = deepcopy(identity)
        for track in clone.tracks:
            for face in track.faces:
                face.x *= ctx.proxy_scale
                face.y *= ctx.proxy_scale
                face.w *= ctx.proxy_scale
                face.h *= ctx.proxy_scale
        out.append(clone)
    return out
