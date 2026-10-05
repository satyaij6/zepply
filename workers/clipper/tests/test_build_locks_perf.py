"""
Clustering must stay linear in the number of detection samples.

`build_locks` grew clusters by calling statistics.median on a fresh list
comprehension after every append. That is O(n^2 log n), and on a 70-minute
source with ~20k samples per identity it dominated everything: profiled at
945 seconds of a 965-second planning pass, 1.09 BILLION function calls, to
frame one 55-second clip.

The clusters are built in ascending cx, so they are already sorted and the
median is the middle element. These tests pin BOTH halves of that claim: the
value is identical to statistics.median, and the cost no longer explodes with
sample count.
"""
from __future__ import annotations

import statistics
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.config import Settings
from clipper.reframe.active import Identity
from clipper.reframe.path import _median_cx, build_locks

SOURCE_W = 1280


from clipper.reframe.detect import Face
from clipper.reframe.active import Track


def face_at(cx: float, cy: float = 300.0, size: float = 100.0) -> Face:
    return Face(x=cx - size / 2, y=cy - size / 2, w=size, h=size,
                score=0.9, landmarks=[], mouth_motion=0.5)


@pytest.mark.parametrize("size", [1, 2, 3, 4, 5, 20, 21])
def test_median_matches_statistics_median(size):
    """Same value as what it replaced, odd and even lengths alike."""
    cluster = [(float(i), face_at(float(i) * 3.0)) for i in range(size)]
    assert _median_cx(cluster) == pytest.approx(
        statistics.median([f.cx for _, f in cluster]))


def test_median_is_exact_on_an_uneven_spread():
    cluster = [(0.0, face_at(10.0)), (1.0, face_at(10.5)),
               (2.0, face_at(400.0)), (3.0, face_at(401.0))]
    assert _median_cx(cluster) == pytest.approx(
        statistics.median([10.0, 10.5, 400.0, 401.0]))


def identity_with(n: int, *, centres=(240.0, 980.0)) -> Identity:
    """`n` samples split between two well-separated framings."""
    tracks = []
    for k, centre in enumerate(centres):
        times, faces = [], []
        for i in range(n // len(centres)):
            times.append(k * 10_000.0 + i * 0.2)
            # A little jitter, well inside framing_tolerance of its centre.
            faces.append(face_at(centre + (i % 7) - 3.0))
        tracks.append(Track(id=k, times=times, faces=faces))
    return Identity(id=0, tracks=tracks)


def test_two_framings_are_still_found():
    """The optimisation must not change what gets clustered."""
    locks = build_locks([identity_with(400)], SOURCE_W, Settings())
    made = locks[0]
    assert len(made) == 2, [l.face_cx for l in made]
    assert made[0].face_cx == pytest.approx(240.0, abs=4)
    assert made[1].face_cx == pytest.approx(980.0, abs=4)


def test_clustering_cost_grows_roughly_linearly():
    """
    Quadrupling the samples must not 16x the time.

    A generous ceiling: the point is to catch a return to quadratic, not to
    pin a constant factor on a shared CI box.
    """
    settings = Settings()

    def run(n: int) -> float:
        # Best of three: a single timing of a few milliseconds is at the mercy
        # of whatever else the machine is doing -- this failed once while a
        # two-hour podcast was being processed alongside the test run.
        ident = identity_with(n)
        best = float("inf")
        for _ in range(3):
            t = time.perf_counter()
            build_locks([ident], SOURCE_W, settings)
            best = min(best, time.perf_counter() - t)
        return best

    run(500)                      # warm up imports and caches
    small = max(run(2_000), 1e-4)
    large = run(8_000)
    ratio = large / small
    assert ratio < 12, f"4x the samples cost {ratio:.1f}x the time"


def test_twenty_thousand_samples_is_fast():
    """The real scale: ~20k samples per identity on a 70-minute source."""
    t = time.perf_counter()
    build_locks([identity_with(20_000)], SOURCE_W, Settings())
    elapsed = time.perf_counter() - t
    assert elapsed < 5.0, f"20k samples took {elapsed:.1f}s"
