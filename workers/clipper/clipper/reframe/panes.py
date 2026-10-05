"""
Find the divider in a side-by-side source.

Podcast footage is frequently a COMPOSITE: two camera feeds laid side by side
with a constant-colour strip between them. The rest of the reframe assumes one
camera filling the frame, and on a composite that assumption puts a panel
across the join -- measured on real footage, the left panel spanned x=62..659
against a divider at x=595..600, so 58px of the neighbouring camera appeared
down the right edge of the top panel.

Detection is a variance floor, not template matching. A divider is flat down
the FULL height of the frame, and nothing else in a talking-head shot is: a
plain wall has shading, a mic stand has edges, a door frame has a top and a
bottom. On the frame measured above the divider columns scored a variance of
11 against a frame-wide mean of 225.

Constraints that keep it from firing on a single-camera frame:

* the strip must be narrow -- a wide flat region is a wall, not a join;
* it must be near the middle, because a composite splits the frame roughly in
  half and a flat strip at the edge is just background;
* it must be the ONLY central candidate, since two of them means whatever is
  being measured is not a two-pane join.

Returning None is the common case and must stay a no-op: single-camera sources
have to keep framing exactly as they did.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

# Column variance below this counts as flat. Measured: 11 on a real divider.
VAR_FLOOR = 40.0
# Divider width as a fraction of frame width. A real 6px join on a 1280 frame
# is 0.5%; anything past a few percent is a wall or a blown-out background.
MIN_WIDTH_FRAC = 0.002
MAX_WIDTH_FRAC = 0.03
# How far from centre a join may sit. Two panes are never wildly lopsided.
CENTRE_LOW, CENTRE_HIGH = 0.25, 0.75


def _flat_runs(colvar, floor: float) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start = None
    for x, v in enumerate(colvar):
        if v < floor:
            if start is None:
                start = x
        elif start is not None:
            runs.append((start, x - 1))
            start = None
    if start is not None:
        runs.append((start, len(colvar) - 1))
    return runs


def divider_in_frame(frame) -> tuple[float, float] | None:
    """
    Divider bounds in this frame's own pixel coordinates, or None.

    `frame` is BGR as read by OpenCV.
    """
    import cv2
    import numpy as np

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32)
    width = gray.shape[1]
    colvar = gray.var(axis=0)

    lo_w = max(1, int(round(MIN_WIDTH_FRAC * width)))
    hi_w = max(lo_w, int(round(MAX_WIDTH_FRAC * width)))

    found: list[tuple[int, int]] = []
    for a, b in _flat_runs(colvar, VAR_FLOOR):
        span = b - a + 1
        centre = (a + b) / 2 / width
        if lo_w <= span <= hi_w and CENTRE_LOW <= centre <= CENTRE_HIGH:
            found.append((a, b))

    if len(found) != 1:
        return None
    a, b = found[0]
    return float(a), float(b + 1)


def divider_for_source(proxy_path, times, *, proxy_scale: float
                       ) -> tuple[float, float] | None:
    """
    Divider bounds in SOURCE pixels, agreed across several sampled times.

    Sampling more than one frame matters: this footage CUTS between a composite
    and full-frame singles, so a single sample can miss the join or catch a
    single-camera frame. The divider is accepted only when the frames that show
    one agree on where it is, which rules out a flat background that happens to
    sit mid-frame in one shot.
    """
    import cv2

    if not times:
        return None
    cap = cv2.VideoCapture(str(proxy_path))
    if not cap.isOpened():
        log.debug("panes: could not open %s", proxy_path)
        return None

    hits: list[tuple[float, float]] = []
    try:
        for t in times:
            cap.set(cv2.CAP_PROP_POS_MSEC, float(t) * 1000.0)
            ok, frame = cap.read()
            if not ok:
                continue
            found = divider_in_frame(frame)
            if found is not None:
                hits.append(found)
    finally:
        cap.release()

    if not hits:
        return None
    # Agreement: every hit must describe the same join, within a couple of
    # proxy pixels. A composite's divider does not move.
    los = [a for a, _ in hits]
    his = [b for _, b in hits]
    if max(los) - min(los) > 3 or max(his) - min(his) > 3:
        log.debug("panes: divider candidates disagree (%s); ignoring", hits)
        return None

    lo = min(los) * proxy_scale
    hi = max(his) * proxy_scale
    log.info("panes: side-by-side source, divider at x = %.0f..%.0f "
             "(%d/%d sampled frames)", lo, hi, len(hits), len(times))
    return lo, hi


def pane_for(x: float, divider: tuple[float, float] | None, *, source_w: int
             ) -> tuple[float, float]:
    """The pane containing `x`, as (left, right) in source pixels."""
    if divider is None:
        return 0.0, float(source_w)
    lo, hi = divider
    if x < lo:
        return 0.0, lo
    if x > hi:
        return hi, float(source_w)
    # Sitting on the join itself: whichever side is larger, so the crop has
    # somewhere to go.
    return (0.0, lo) if lo >= source_w - hi else (hi, float(source_w))
