"""
Where the SOURCE cuts, so the prefilter can avoid choppy stretches.

The reframe follows the source: when the editor intercuts two camera angles
every 1.5 seconds, the reel cuts every 1.5 seconds too. Each shot is framed
correctly -- there is no glitch to fix downstream -- but a tight 9:16 close-up
makes a cut land far harder than the original wide 16:9 does, and the result
reads as flashing.

`min_run` cannot help. It merges a short shot into a neighbour that contains
the face, and across a source cut neither neighbour does: the person is simply
not in the frame any more. The only stage that can prevent this is SELECTION.
So cuts are measured up front and choppy regions are penalised before they can
become clips.

Cost: one decode of the analysis proxy. Measured on a 70-minute source, 37
seconds to find 626 cuts -- cheap next to transcription, and cached, so the
pass happens once per video no matter how many clips get cut.

Detection is ffmpeg's own `scene` score rather than anything bespoke. It is a
frame-difference heuristic, so a hard cut between two camera angles scores
high, a pan or a gesture scores low, and the threshold is the only knob.
"""
from __future__ import annotations

import json
import logging
import re
import subprocess
from pathlib import Path

from .config import Paths, Settings
from .ffmpeg import _binary

log = logging.getLogger(__name__)

_PTS = re.compile(r"pts_time:([0-9.]+)")


def detect_cuts(proxy_path: Path, *, threshold: float) -> list[float]:
    """Shot-cut times in seconds, ascending."""
    proc = subprocess.run(
        [_binary("ffmpeg"), "-hide_banner", "-nostats", "-v", "error",
         "-i", str(proxy_path),
         "-filter:v", f"select='gt(scene,{threshold})',metadata=print:file=-",
         "-an", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        # Never fatal. A source we cannot measure is treated as calm, which
        # is the behaviour this whole module is an improvement on.
        log.warning("scenes: cut detection failed (%s); treating the source as "
                    "uncut", (proc.stderr or "").strip()[:200])
        return []
    times = [float(m) for m in _PTS.findall(proc.stdout)]
    times.sort()
    return times


def cuts_for(paths: Paths, settings: Settings, *, use_cache: bool = True
             ) -> list[float]:
    """Cached shot-cut times for this video's proxy."""
    cache = paths.work / "scenes.json"
    if use_cache and cache.exists():
        try:
            payload = json.loads(cache.read_text(encoding="utf-8"))
            if payload.get("threshold") == settings.scene_threshold:
                return payload["cuts"]
        except (json.JSONDecodeError, KeyError):
            log.warning("scenes: %s is unreadable; re-detecting", cache)

    if not paths.proxy.exists():
        log.warning("scenes: no proxy at %s; treating the source as uncut",
                    paths.proxy)
        return []

    cuts = detect_cuts(paths.proxy, threshold=settings.scene_threshold)
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(
        {"threshold": settings.scene_threshold, "cuts": cuts}, indent=0),
        encoding="utf-8")
    log.info("scenes: %d source cuts (threshold %.2f)", len(cuts),
             settings.scene_threshold)
    return cuts


def cuts_per_minute(cuts: list[float], start: float, end: float) -> float:
    """How fast the source cuts inside [start, end]."""
    span = end - start
    if span <= 0 or not cuts:
        return 0.0
    import bisect
    lo = bisect.bisect_left(cuts, start)
    hi = bisect.bisect_right(cuts, end)
    return (hi - lo) * 60.0 / span


def choppiness_factor(rate: float, settings: Settings) -> float:
    """
    Multiplier for a region's score: 1.0 when calm, lower as cuts speed up.

    A smooth decay rather than a cliff, because "choppy" is a matter of degree
    and a hard threshold would make two near-identical regions rank far apart.
    Returns 1.0 when the penalty is disabled, so the old behaviour is one
    setting away.
    """
    limit = settings.max_cuts_per_minute
    if settings.cut_penalty <= 0 or limit <= 0 or rate <= limit:
        return 1.0
    over = rate / limit
    return 1.0 / (over ** settings.cut_penalty)
