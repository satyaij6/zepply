"""
A short shot the previous framing cannot cover must fold FORWARD, not survive.

`min_run` promises that no shot shorter than 2s reaches the render: "Holding
the previous, correct shot for another second beats a 1.3s flash of the wrong
thing." Backward-only folding cannot keep that promise. When the SOURCE cuts
cameras, the previous lock genuinely does not contain the face any more, so
`is_valid` vetoes the merge and the short shot survives -- which is the 1-2s
flash seen in every rendered clip of a multi-camera source.

Measured on one 35s clip: runs of 0.24s, 1.52s, 1.52s, 1.48s and 1.52s all
survived a min_run of 2.0s.

Folding forward reaches the correct framing slightly early instead. These tests
pin that, and pin that a merge neither neighbour can cover is still left alone
rather than forced.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.reframe.path import absorb_short_runs

FPS = 25.0
MIN_RUN = 2.0


def runs_of(keys: list) -> list[tuple]:
    out: list[tuple] = []
    for k in keys:
        if out and out[-1][0] == k:
            out[-1] = (k, out[-1][1] + 1)
        else:
            out.append((k, 1))
    return out


def test_a_short_run_folds_forward_when_backward_is_vetoed():
    """The flash case: A cannot cover the gap, C can."""
    a, b, c = 100, int(1.5 * FPS), 100
    keys = ["A"] * a + ["B"] * b + ["C"] * c

    # The previous shot (A) never covers B's frames; the next one (C) does.
    def is_valid(key, frame):
        if key == "A" and a <= frame < a + b:
            return False
        return True

    got = absorb_short_runs(keys, FPS, MIN_RUN, is_valid)
    assert runs_of(got) == [("A", a), ("C", b + c)], runs_of(got)


def test_backward_still_wins_when_it_is_allowed():
    """Extending the previous shot stays the preferred move."""
    a, b, c = 100, int(1.5 * FPS), 100
    keys = ["A"] * a + ["B"] * b + ["C"] * c

    got = absorb_short_runs(keys, FPS, MIN_RUN, lambda key, frame: True)
    assert runs_of(got) == [("A", a + b), ("C", c)], runs_of(got)


def test_a_run_neither_neighbour_can_cover_is_left_alone():
    """The empty-frame guard is not overridden -- a real shot survives."""
    a, b, c = 100, int(1.5 * FPS), 100
    keys = ["A"] * a + ["B"] * b + ["C"] * c

    def is_valid(key, frame):
        return not (key in ("A", "C") and a <= frame < a + b)

    got = absorb_short_runs(keys, FPS, MIN_RUN, is_valid)
    assert runs_of(got) == [("A", a), ("B", b), ("C", c)], runs_of(got)


def test_the_measured_clip_02_shape_collapses():
    """
    The real run list from clip_02, where five shots beat min_run=2.0.

    Alternating A/B where neither can cover the other's frames leaves the
    genuine cuts; what must go are the sub-2s slivers whose neighbour on one
    side can cover them.
    """
    # 0.24 B | 8.48 A | 1.52 B | 3.48 A  -- B's short shots are coverable by A
    spans = [("B", 0.24), ("A", 8.48), ("B", 1.52), ("A", 3.48)]
    keys: list[str] = []
    for key, dur in spans:
        keys += [key] * int(round(dur * FPS))

    got = absorb_short_runs(keys, FPS, MIN_RUN)
    assert runs_of(got) == [("A", len(keys))], runs_of(got)
