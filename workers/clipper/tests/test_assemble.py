"""
Assembly: playback order, caption continuity across joins, and no regression on
the single-span case that already worked.

The riskiest thing about multi-span clips is that every failure is silent. A
sign error in the timeline maths does not raise -- it just desynchronises every
caption after the first join, and you only find out by watching.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.assemble import assemble, join_windows, lay_out
from clipper.assembler_render import build_filtergraph
from clipper.captions import (
    Cue, assert_no_cue_straddles_a_join, build_assembled_cues, clear_join_windows,
)
from clipper.config import Settings
from clipper.models import ClipPlan, Join, Span, Word

FORMATS = {"single_take": "", "setup_payoff": "", "compilation": ""}


def words(n: int = 600, step: float = 1.0) -> list[Word]:
    return [Word(i=i, text=f"w{i}", start=i * step, end=i * step + step * 0.8,
                 roman=f"w{i}") for i in range(n)]


def plan(spans: list[Span], fmt: str = "compilation", pid: str = "p01") -> ClipPlan:
    return ClipPlan(id=pid, format=fmt, theme="a theme", spans=spans,
                    hook_score=8, coherence_score=7, standalone_score=7,
                    reason="r", suggested_title="a title")


# --------------------------------------------------- playback vs source order

def test_spans_assemble_in_playback_order_not_source_order():
    """
    The hook is the LAST thing said in the source but the FIRST thing shown.
    Assembling in source order would silently undo the model's whole decision.
    """
    w = words()
    p = plan([Span(400, 420, "hook"),      # latest in source, plays first
              Span(40, 60, "body"),
              Span(200, 220, "payoff")], fmt="setup_payoff")
    accepted, rejected = assemble([p], w, FORMATS, Settings())
    assert not rejected, [r.rejected_reason for r in rejected]
    q = accepted[0]

    starts = [s.source_start for s in q.spans]
    assert starts[0] > starts[1], "playback order was re-sorted into source order"
    assert q.source_order == [2, 0, 1]
    assert q.jumps_backwards

    offsets = [s.playback_start for s in q.spans]
    assert offsets == sorted(offsets), "assembled timeline must run forwards"
    assert offsets[0] == 0.0

    # And the render graph must consume the inputs in the same order.
    graph, _, _ = build_filtergraph(q, Settings(), ass_name=None)
    first_xfade = [c for c in graph.split(";") if "xfade" in c][0]
    assert "[v0][v1]" in first_xfade


def test_input_order_matches_span_order():
    w = words()
    q = assemble([plan([Span(400, 430, "hook"), Span(40, 65, "payoff")],
                       fmt="setup_payoff")], w, FORMATS, Settings())[0][0]
    from clipper.assembler_render import build_inputs

    args = build_inputs(q, "src.mp4")
    seeks = [float(args[i + 1]) for i, a in enumerate(args) if a == "-ss"]
    assert seeks == [q.spans[0].source_start, q.spans[1].source_start]


# --------------------------------------------------- caption continuity

def test_no_caption_cue_straddles_a_join():
    w = words()
    s = Settings()
    q = assemble([plan([Span(400, 420, "hook"),
                        Span(40, 60, "point", label="second reason"),
                        Span(200, 220, "payoff")])], w, FORMATS, s)[0][0]
    for span in q.spans:
        span.source_start = w[span.start_word_i].start
        span.source_end = w[span.end_word_i].end
    lay_out(q)

    cues = build_assembled_cues(q, w, s, font_size=64)
    assert cues, "no cues were produced"
    assert_no_cue_straddles_a_join(cues, join_windows(q))


def test_a_cue_overlapping_a_join_is_trimmed_not_shipped():
    windows = [(10.0, 10.25)]
    trimmed = clear_join_windows([Cue(9.5, 10.2, "runs into the join")], windows)
    assert trimmed[0].end == pytest.approx(10.0)

    pushed = clear_join_windows([Cue(10.1, 11.0, "starts inside the join")], windows)
    assert pushed[0].start == pytest.approx(10.25)

    swallowed = clear_join_windows([Cue(10.05, 10.2, "entirely inside")], windows)
    assert swallowed == [], "a cue inside a join window must be dropped"


def test_the_continuity_assert_actually_fires():
    """Guard on the guard -- a check that cannot fail is worse than none."""
    with pytest.raises(AssertionError, match="overlaps the join window"):
        assert_no_cue_straddles_a_join([Cue(9.9, 10.2, "bad")], [(10.0, 10.25)])


def test_caption_times_are_assembled_not_source_time():
    """
    A cue from a span that starts at 400s in the source must be timed from the
    START of the clip. Leaving it in source time would put every caption of the
    first span 400 seconds into a 60 second video.
    """
    w = words()
    s = Settings()
    q = assemble([plan([Span(400, 430, "hook"), Span(40, 65, "payoff")],
                       fmt="setup_payoff")], w, FORMATS, s)[0][0]
    for span in q.spans:
        span.source_start = w[span.start_word_i].start
        span.source_end = w[span.end_word_i].end
    lay_out(q)

    cues = build_assembled_cues(q, w, s, font_size=64)
    assert min(c.start for c in cues) < 1.0
    assert max(c.end for c in cues) <= q.total_duration + 0.5


# --------------------------------------------------- timeline maths

def test_a_crossfade_shortens_the_clip_and_a_join_window_sits_at_the_seam():
    s = Settings()
    p = plan([Span(0, 20, "hook"), Span(100, 120, "payoff")], fmt="setup_payoff")
    p.spans[0].source_start, p.spans[0].source_end = 0.0, 20.0
    p.spans[1].source_start, p.spans[1].source_end = 100.0, 120.0
    p.joins = [Join("fade", 0.25)]
    lay_out(p)

    assert p.total_duration == pytest.approx(40.0 - 0.25)
    assert p.spans[1].playback_start == pytest.approx(19.75)
    assert join_windows(p) == [pytest.approx((19.75, 20.0))]
