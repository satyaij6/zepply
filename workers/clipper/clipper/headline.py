"""
Fit a plan's title into the band above an inset video.

Two rules shape this:

* **It must never reach the video.** The band handed in ENDS at the video's top
  edge, so the fitter cannot overflow into the picture -- overlap is not a case
  to be tested for afterwards, it is unrepresentable. What the fitter can do is
  fail to fit, and the order it tries is: wrap, then shrink toward a floor,
  then ellipsize. Shrinking before ellipsizing because a slightly smaller
  headline still reads; a truncated one has lost words.

* **Accent is a named rule, not markup.** The style file says which rule to
  use; the rules live here. That keeps arbitrary code out of data files while
  still letting a style pick "the words either side of `vs` are red", which is
  the pattern the reference layout uses.
"""
from __future__ import annotations

import logging
import re

from .styles import LINE_SPACING, Rect, Style

log = logging.getLogger(__name__)

ELLIPSIS = "…"
_VS = re.compile(r"^vs\.?$", re.IGNORECASE)

# Segment = (text, accented)
Segment = tuple[str, bool]


def accent_segments(title: str, rule: str) -> list[Segment]:
    """Split a title into words, marking which take the accent colour."""
    words = title.split()
    if rule == "none" or not words:
        return [(w, False) for w in words]
    if rule == "vs_flank":
        marked = [False] * len(words)
        for i, word in enumerate(words):
            if _VS.match(word.strip(",;:")):
                if i > 0:
                    marked[i - 1] = True
                if i + 1 < len(words):
                    marked[i + 1] = True
        return list(zip(words, marked))
    raise ValueError(f"unknown accent rule {rule!r}")


def _wrap(segments: list[Segment], measure, max_px: float, wrap: str
          ) -> list[list[Segment]]:
    """Greedy word wrap that keeps each word's accent flag with the word."""
    if wrap == "none":
        return [segments]
    lines: list[list[Segment]] = []
    current: list[Segment] = []
    for seg in segments:
        trial = " ".join(w for w, _ in [*current, seg])
        if current and measure(trial) > max_px:
            lines.append(current)
            current = [seg]
        else:
            current.append(seg)
    if current:
        lines.append(current)
    return lines


def _ellipsize(line: list[Segment], measure, max_px: float) -> list[Segment]:
    """Trim the tail of a line until it fits, leaving an ellipsis."""
    out = list(line)
    while out:
        text = " ".join(w for w, _ in out) + ELLIPSIS
        if measure(text) <= max_px or len(out) == 1:
            break
        out = out[:-1]
    if not out:
        return [(ELLIPSIS, False)]
    last_word, accented = out[-1]
    return [*out[:-1], (last_word + ELLIPSIS, accented)]


def fit(title: str, style: Style, band: Rect, canvas_h: int, measurer_for
        ) -> tuple[list[list[Segment]], int]:
    """
    Lay a title into `band`.

    `measurer_for(size)` returns something with `.width(text)` for that pixel
    size -- injected so the caller owns font loading and this stays testable
    with a stub.

    Returns (lines of segments, chosen pixel size).
    """
    spec = style.headline
    segments = accent_segments(title.strip(), spec["accent_rule"])
    if not segments:
        return [], int(round(spec["size_pct"] * canvas_h))

    start = int(round(spec["size_pct"] * canvas_h))
    floor = max(1, int(round(spec["min_size_pct"] * canvas_h)))
    max_px = band.w * 0.92          # side breathing room inside the band
    max_lines = spec["max_lines"]

    size = start
    lines: list[list[Segment]] = []
    while size >= floor:
        measure = measurer_for(size).width
        lines = _wrap(segments, measure, max_px, spec["wrap"])
        fits_height = len(lines) * size * LINE_SPACING <= band.h
        fits_width = all(measure(" ".join(w for w, _ in l)) <= max_px
                         for l in lines)
        if len(lines) <= max_lines and fits_height and fits_width:
            return lines, size
        size -= 2

    # At the floor and still too big: keep the allowed lines and cut the last.
    size = floor
    measure = measurer_for(size).width
    lines = _wrap(segments, measure, max_px, spec["wrap"])
    if len(lines) > max_lines:
        log.info("headline: %r needs %d lines at the %dpx floor; ellipsizing "
                 "to %d", title[:40], len(lines), size, max_lines)
        kept = lines[:max_lines]
        # Everything that did not fit joins the last kept line before trimming,
        # so the ellipsis lands after real words rather than mid-wrap.
        tail = [seg for line in lines[max_lines:] for seg in line]
        kept[-1] = _ellipsize([*kept[-1], *tail], measure, max_px)
        lines = kept
    else:
        lines = [_ellipsize(l, measure, max_px)
                 if measure(" ".join(w for w, _ in l)) > max_px else l
                 for l in lines]
    return lines, size
