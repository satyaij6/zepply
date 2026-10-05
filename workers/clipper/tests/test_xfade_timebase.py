"""
Spans with different run counts must still be joinable.

`concat` emits at timebase 1/1000000; a single run passed straight through
keeps 1/25. When a multi-span plan mixes the two, xfade refuses to configure:

    First input link main timebase (1/25) do not match the corresponding
    second input link xfade timebase (1/1000000)

That is not a hypothetical -- it cost a rendered clip. p02 of the first
70-minute source had a 1-run span and a 7-run span, and produced a 0-byte
clip_01.mp4 while every other clip rendered fine.

The reason it went unnoticed is what these tests exist to prevent: a plan
whose spans all have ONE run agrees at 1/25, and a plan whose spans all
concat agrees at 1/1000000. Both uniform cases pass. Only the MIX breaks, so
any test that builds symmetric spans will keep passing while the bug is live.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.assembler_render import build_filtergraph
from clipper.config import Settings
from clipper.models import ClipPlan, Join, Span
from clipper.reframe.path import FramePlan, Run
from clipper.reframe.render import build_span_graph

FPS = 25


def frame_plan(run_count: int) -> FramePlan:
    """A plan with `run_count` single-framing runs back to back."""
    runs = [
        Run(start=float(n) * 2.0, end=float(n) * 2.0 + 2.0, kind="single",
            identity=0, crop_x=100.0 * n, crop_y=0.0)
        for n in range(run_count)
    ]
    return FramePlan(fps=float(FPS), crop_w=405, crop_h=720,
                     source_w=1280, source_h=720, runs=runs,
                     xs=[0.0] * (run_count * FPS * 2),
                     active=[0] * (run_count * FPS * 2))


def span_output_chain(run_count: int) -> str:
    """The last graph part for a span -- the one that fixes its timebase."""
    parts, out, _ = build_span_graph(
        frame_plan(run_count), Settings(), first_input=0,
        label="s0", fps=FPS,
    )
    assert parts[-1].endswith(f"[{out}]"), parts[-1]
    return parts[-1]


@pytest.mark.parametrize("run_count", [1, 2, 7])
def test_every_span_output_pins_the_timebase(run_count):
    """
    One run or many, the span output must declare settb.

    Without it the single-run span leaves 1/25 and the concat span leaves
    1/1000000, and whichever pair xfade sees first decides whether the clip
    renders or comes out empty.
    """
    assert f"settb=1/{FPS}" in span_output_chain(run_count)


def test_a_one_run_span_and_a_concat_span_agree_on_timebase():
    """The exact asymmetry that produced the 0-byte clip."""
    single = span_output_chain(1)
    concat = span_output_chain(7)

    assert f"settb=1/{FPS}" in single
    assert f"settb=1/{FPS}" in concat
    # Same normalisation, so xfade sees two links it can configure.
    assert single.split("]", 1)[1] == concat.split("]", 1)[1]


def test_assembled_graph_joins_asymmetric_spans():
    """End to end through the assembler: 1-run span xfaded with a 7-run span."""
    a = Span(start_word_i=0, end_word_i=1, role="hook")
    a.source_start, a.source_end = 0.0, 10.0
    b = Span(start_word_i=2, end_word_i=3, role="payoff")
    b.source_start, b.source_end = 60.0, 74.0
    plan = ClipPlan(id="p02", format="setup_payoff", theme="t", spans=[a, b],
                    hook_score=8, coherence_score=7, standalone_score=7,
                    reason="r", suggested_title="t")
    plan.joins = [Join("fade", 0.4)]
    from clipper.assemble import lay_out
    lay_out(plan)

    graph, vlabel, _ = build_filtergraph(
        plan, Settings(), ass_name=None, fps=FPS,
        frame_plans=[frame_plan(1), frame_plan(7)],
    )

    # Both span outputs reach xfade timebase-normalised.
    xfade = [c for c in graph.split(";") if "xfade" in c]
    assert len(xfade) == 1, xfade
    inputs = re.match(r"\[([^\]]+)\]\[([^\]]+)\]xfade", xfade[0])
    assert inputs, xfade[0]
    for label in inputs.groups():
        producer = [c for c in graph.split(";") if c.endswith(f"[{label}]")]
        assert producer, f"no producer for [{label}] in graph"
        assert f"settb=1/{FPS}" in producer[0], producer[0]
