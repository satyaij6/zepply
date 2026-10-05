"""
A run's crop must belong to the person its KEY names.

`plan.active` is a parallel array recording who was active per frame.
`absorb_short_runs` rewrites KEYS and leaves `active` untouched, so after a
fold the two disagree. Reading the identity from `active` then looks up the
OLD identity's locks using the NEW identity's key, finds no match, and falls
back to a lock belonging to the wrong person -- silently, because a fallback
is a legitimate path for a frame with no detection.

Measured on a real clip: a 6-frame opening shot of speaker B folded forward
into the 8.5s shot of speaker A that followed, and the whole 8.5s was then
framed with B's lock. Ten seconds of a microphone and an empty chair while the
person speaking sat outside the crop.

The identity is already encoded in the key ("<identity>.<framing>"), so taking
it from there makes the desync unrepresentable.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.config import Settings
from clipper.reframe.active import Assignment, Identity, Track
from clipper.reframe.detect import Face
from clipper.reframe.path import build_plan

SOURCE_W, SOURCE_H = 1280, 720
FPS = 25.0
DET_FPS = 5.0


def track_of(cx: float, t0: float, seconds: float, *, size=110.0,
             cy=260.0) -> Track:
    faces, times = [], []
    for i in range(int(seconds * DET_FPS) + 1):
        faces.append(Face(x=cx - size / 2, y=cy - size / 2, w=size, h=size,
                          score=0.9, landmarks=[], mouth_motion=0.5))
        times.append(t0 + i / DET_FPS)
    return Track(id=0, times=times, faces=faces)


def test_a_folded_head_does_not_borrow_the_other_speakers_lock():
    """
    B is visible for a fraction of a second, then A for a long stretch.

    The opening sliver is absorbed; what follows must still be framed on A.
    """
    # B on screen for a sliver at the head; A from 0.3s to the end. The head
    # must be short enough to be absorbed (<= 0.25s), which is what creates
    # the key/active disagreement.
    b = Identity(id=1, tracks=[track_of(960.0, 0.0, 0.1)])
    a = Identity(id=0, tracks=[track_of(320.0, 0.3, 11.0)])

    plan = build_plan(
        [a, b],
        {"0": Assignment("0", 0, 1.0, "")},
        [(0.0, 11.0, "0")],
        source_w=SOURCE_W, source_h=SOURCE_H,
        start=0.0, duration=11.0, fps=FPS, settings=Settings(),
    )

    assert plan.runs, "no runs produced"
    first = plan.runs[0]
    # The sliver is absorbed, so one run covers the clip...
    assert first.lock_key.startswith("0."), (
        f"head absorbed into a run keyed {first.lock_key}; expected A's lock")
    # ...and it must be framed on A (~320, so a 405-wide crop starts near 117),
    # NOT on B's lock near 757, which is the failure being pinned.
    assert first.crop_x < 500, (
        f"first run framed at x={first.crop_x:.0f}, which is B's side of the "
        f"frame; it should follow A at ~320")


def test_every_single_run_is_framed_on_the_identity_its_key_names():
    """The general invariant, across a plan with several alternations."""
    a = Identity(id=0, tracks=[track_of(320.0, 0.0, 4.0),
                               track_of(320.0, 6.0, 5.0)])
    b = Identity(id=1, tracks=[track_of(960.0, 4.2, 1.6)])

    plan = build_plan(
        [a, b],
        {"0": Assignment("0", 0, 1.0, "")},
        [(0.0, 11.0, "0")],
        source_w=SOURCE_W, source_h=SOURCE_H,
        start=0.0, duration=11.0, fps=FPS, settings=Settings(),
    )

    for run in plan.runs:
        if run.kind != "single":
            continue
        ident = int(str(run.lock_key).split(".")[0])
        locks = plan.locks.get(ident, [])
        assert any(abs(l.crop_x(405.0, SOURCE_W) - run.crop_x) < 1.0
                   for l in locks), (
            f"run at {run.start:.2f}s has key {run.lock_key} but its crop "
            f"x={run.crop_x:.0f} matches no lock of identity {ident}")
