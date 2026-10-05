"""
Choppiness has to be applied to the SPANS, not only to the prefilter regions.

The regions are hints in the scoring prompt, not constraints: the model sees
the whole transcript and may propose a span no region covers. Measured -- a run
whose 30 vetted regions all sat under 11.8 source cuts/min still produced an
88.5s clip at 13.6, because its span overlapped none of them and
`plan_max_duration` (90s) exceeds the prefilter window (75s).

So the prefilter biases what gets suggested and ranking decides what gets cut.
Both need the measure; these tests cover the ranking half.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.config import Settings
from clipper.models import ClipPlan, Span
from clipper.rank import choppiness_of, rank


def plan(pid: str, *, hook: float, spans: list[tuple[float, float]]) -> ClipPlan:
    made = []
    for n, (a, b) in enumerate(spans):
        s = Span(start_word_i=n * 2, end_word_i=n * 2 + 1, role="hook")
        s.source_start, s.source_end = a, b
        made.append(s)
    return ClipPlan(id=pid, format="single_take", theme="t", spans=made,
                    hook_score=hook, coherence_score=hook,
                    standalone_score=hook, reason="r", suggested_title=pid)


def every(step: float, upto: float) -> list[float]:
    """A cut every `step` seconds."""
    out, t = [], 0.0
    while t < upto:
        out.append(t)
        t += step
    return out


def test_no_cuts_leaves_the_order_alone():
    calm = plan("a", hook=7.0, spans=[(0.0, 60.0)])
    strong = plan("b", hook=8.0, spans=[(60.0, 120.0)])
    assert [p.id for p in rank([calm, strong], Settings())] == ["b", "a"]


def test_a_choppy_plan_loses_to_a_calmer_lower_scoring_one():
    """The measured case: 8.00 at 14 cuts/min lost to 7.50 at 6."""
    cuts = every(4.3, 200.0)          # ~14/min in the first window
    choppy = plan("choppy", hook=8.0, spans=[(0.0, 90.0)])
    calm = plan("calm", hook=7.5, spans=[(300.0, 390.0)])   # no cuts out there
    order = [p.id for p in rank([choppy, calm], Settings(), cuts=cuts)]
    assert order == ["calm", "choppy"], order


def test_the_penalty_does_not_invert_a_large_score_gap():
    """A much better clip should survive being somewhat choppier."""
    cuts = every(5.0, 200.0)          # 12/min, just over the limit
    good = plan("good", hook=9.0, spans=[(0.0, 60.0)])
    weak = plan("weak", hook=5.0, spans=[(300.0, 360.0)])
    assert [p.id for p in rank([good, weak], Settings(), cuts=cuts)][0] == "good"


def test_choppiness_is_weighted_by_span_length():
    """A long calm span plus a short frantic one is mostly calm."""
    cuts = every(1.0, 10.0)           # 60/min, but only in 0-10s
    p = plan("mixed", hook=8.0, spans=[(0.0, 5.0), (100.0, 100.0 + 55.0)])
    rate = choppiness_of(p, cuts, Settings())
    # 5s at ~60/min and 55s at 0 -> about 5/min overall, not 30.
    assert rate < 10.0, rate


def test_a_plan_with_no_duration_does_not_divide_by_zero():
    p = plan("empty", hook=8.0, spans=[(10.0, 10.0)])
    assert choppiness_of(p, [1.0, 2.0], Settings()) == 0.0


def test_passing_no_cuts_matches_the_unpenalised_order():
    cuts = every(2.0, 400.0)
    plans = [plan("a", hook=8.0, spans=[(0.0, 60.0)]),
             plan("b", hook=7.0, spans=[(100.0, 160.0)])]
    assert ([p.id for p in rank(plans, Settings(), cuts=None)]
            == [p.id for p in rank(plans, Settings())])


def test_the_penalty_can_be_switched_off():
    cuts = every(1.0, 400.0)          # 60/min everywhere
    plans = [plan("a", hook=8.0, spans=[(0.0, 60.0)]),
             plan("b", hook=7.0, spans=[(100.0, 160.0)])]
    off = Settings(cut_penalty=0.0)
    assert [p.id for p in rank(plans, off, cuts=cuts)] == ["a", "b"]
