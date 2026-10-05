"""
A clip must not open on a flash.

`absorb_short_runs` folds a too-short run into the one before it, which leaves
the FIRST run with nothing to fold into -- so it survives at any length. On a
35s clip from a 70-minute source the head run was 0.24s (6 frames at 25fps) on
one speaker before cutting to the other, and the render opened with a visible
flash across the frame.

The head run has to fold FORWARD instead. These tests pin that, and pin the
cases where folding forward must NOT happen: a long opening run is a real shot,
and a short one whose successor cannot legally cover it stays put.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.reframe.path import absorb_short_runs

FPS = 25.0
MIN_RUN = 2.0


def runs_of(keys: list) -> list[tuple]:
    """(key, frame count) per run -- what the renderer turns into shots."""
    out: list[tuple] = []
    for k in keys:
        if out and out[-1][0] == k:
            out[-1] = (k, out[-1][1] + 1)
        else:
            out.append((k, 1))
    return out


def test_a_six_frame_opening_run_is_absorbed_forward():
    """The exact shape that flashed: 6 frames on B, then a long hold on A."""
    keys = ["B"] * 6 + ["A"] * 200
    got = absorb_short_runs(keys, FPS, MIN_RUN)

    assert runs_of(got) == [("A", 206)]
    assert got[0] == "A", "the clip still opens on the flash"


def test_a_long_opening_run_is_left_alone():
    keys = ["B"] * 100 + ["A"] * 200
    got = absorb_short_runs(keys, FPS, MIN_RUN)
    assert runs_of(got) == [("B", 100), ("A", 200)]


def test_the_head_is_not_folded_into_a_successor_that_cannot_cover_it():
    """
    `is_valid` exists to stop a merge that would show an empty frame.

    A head run shorter than `trivial` (0.25s) is absorbed regardless, because
    a few frames can show nothing at all -- so this uses a 1.2s head, short
    enough to absorb but long enough that the guard has to be respected.
    """
    head = int(1.2 * FPS)
    keys = ["B"] * head + ["A"] * 200

    # A is never a legal framing for the head frames.
    def is_valid(key, frame):
        return not (key == "A" and frame < head)

    got = absorb_short_runs(keys, FPS, MIN_RUN, is_valid)
    assert runs_of(got) == [("B", head), ("A", 200)]


def test_a_trivial_head_is_absorbed_even_when_the_guard_objects():
    """Two frames can show nothing at all, so they go either way."""
    keys = ["B"] * 2 + ["A"] * 200
    got = absorb_short_runs(keys, FPS, MIN_RUN, lambda key, frame: False)
    assert runs_of(got) == [("A", 202)]


def test_a_single_run_clip_is_untouched():
    keys = ["A"] * 50
    assert absorb_short_runs(keys, FPS, MIN_RUN) == keys


def test_cascading_short_heads_all_collapse():
    """Folding the head forward can expose another short head."""
    keys = ["C"] * 3 + ["B"] * 4 + ["A"] * 200
    got = absorb_short_runs(keys, FPS, MIN_RUN)
    assert runs_of(got) == [("A", 207)]
