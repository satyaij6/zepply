"""
Neighbouring runs that render the same crop must not be cut apart.

Runs are keyed by LOCK, so the nearest lock can change without the crop moving.
Measured on one clip: two adjacent runs both rendered x=611 and were still
separate runs, which reports a cut no viewer can see, pays for an extra decode
and adds a concat boundary for nothing.

Merging on rendered geometry changes no pixels. It also matters for the
diagnostics -- "9 run(s), 8 cut(s)" overstated the visible cuts, which is
misleading when the whole point of the log line is judging how choppy a clip is.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.reframe.path import (
    FramePlan, Panel, Run, _coalesce_identical_runs, _geometry_of,
)


def plan_with(*runs: Run) -> FramePlan:
    p = FramePlan(fps=25.0, crop_w=405, crop_h=720, source_w=1280, source_h=720)
    p.runs = list(runs)
    return p


def single(t0: float, t1: float, x: float, *, key: str = "0.0") -> Run:
    return Run(t0, t1, "single", key, 0, crop_x=x, crop_y=0.0)


def test_two_runs_with_the_same_crop_become_one():
    """The measured case: different lock key, identical geometry."""
    p = plan_with(single(0.0, 8.72, 611.0, key="1.0"),
                  single(8.72, 10.24, 611.0, key="1.1"))
    _coalesce_identical_runs(p)
    assert len(p.runs) == 1
    assert p.runs[0].start == 0.0 and p.runs[0].end == 10.24


def test_runs_with_different_crops_are_kept():
    p = plan_with(single(0.0, 5.0, 611.0), single(5.0, 8.0, 158.0))
    _coalesce_identical_runs(p)
    assert len(p.runs) == 2


def test_a_chain_of_identical_runs_collapses_to_one():
    p = plan_with(single(0.0, 2.0, 611.0, key="a"),
                  single(2.0, 4.0, 611.0, key="b"),
                  single(4.0, 6.0, 611.0, key="c"))
    _coalesce_identical_runs(p)
    assert len(p.runs) == 1
    assert p.runs[0].end == 6.0


def test_identical_crops_either_side_of_a_different_one_stay_separate():
    """A real cut away and back is two shots, not one."""
    p = plan_with(single(0.0, 3.0, 611.0), single(3.0, 5.0, 158.0),
                  single(5.0, 8.0, 611.0))
    _coalesce_identical_runs(p)
    assert [r.crop_x for r in p.runs] == [611.0, 158.0, 611.0]


def test_split_runs_compare_on_panel_geometry():
    def split(t0, t1, x0, x1):
        return Run(t0, t1, "split", "split", 0, panels=[
            Panel(identity=0, crop_x=x0, crop_y=0.0, crop_w=595.0, crop_h=529.0),
            Panel(identity=2, crop_x=x1, crop_y=0.0, crop_w=595.0, crop_h=529.0),
        ])

    same = plan_with(split(0.0, 2.0, 0.0, 685.0), split(2.0, 4.0, 0.0, 685.0))
    _coalesce_identical_runs(same)
    assert len(same.runs) == 1

    moved = plan_with(split(0.0, 2.0, 0.0, 685.0), split(2.0, 4.0, 20.0, 685.0))
    _coalesce_identical_runs(moved)
    assert len(moved.runs) == 2


def test_a_split_and_a_single_never_merge():
    p = plan_with(
        Run(0.0, 2.0, "split", "split", 0, panels=[
            Panel(identity=0, crop_x=0.0, crop_y=0.0, crop_w=595.0, crop_h=529.0),
            Panel(identity=2, crop_x=685.0, crop_y=0.0, crop_w=595.0, crop_h=529.0),
        ]),
        single(2.0, 4.0, 0.0),
    )
    _coalesce_identical_runs(p)
    assert len(p.runs) == 2


def test_one_run_and_no_runs_are_left_alone():
    one = plan_with(single(0.0, 5.0, 611.0))
    _coalesce_identical_runs(one)
    assert len(one.runs) == 1

    none = plan_with()
    _coalesce_identical_runs(none)
    assert none.runs == []


def test_geometry_ignores_the_lock_key():
    a = single(0.0, 1.0, 611.0, key="1.0")
    b = single(1.0, 2.0, 611.0, key="9.9")
    assert _geometry_of(a) == _geometry_of(b)
