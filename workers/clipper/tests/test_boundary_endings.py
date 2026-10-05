"""
Spans must open and close where a listener would accept it.

Measured on a real 20-minute source: of 273 inter-word gaps >= 0.4s, 77% fall
mid-sentence -- and the correlation gets WORSE as the gap grows (gaps >= 1.0s
land on a sentence end 0% of the time, because long pauses in this material are
dramatic beats rather than full stops). So "snap to the nearest pause" reliably
cuts off half-way through a sentence, which is exactly what the first render
did. Terminal punctuation is the trustworthy signal; pause length is a fallback.

The start edge matters just as much inside a compilation: a clean end followed
by a span that begins mid-breath still sounds spliced.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.boundary import resolve_span
from clipper.config import Settings
from clipper.models import Span, Word


def timeline(n: int, *, terminal_at: set[int] | None = None,
             step: float = 1.0, gap_at: dict[int, float] | None = None) -> list[Word]:
    """One word per `step` seconds, with optional extra gaps and full stops."""
    words, t = [], 0.0
    for i in range(n):
        text = f"w{i}" + ("." if i in (terminal_at or set()) else "")
        words.append(Word(i=i, text=text, start=t, end=t + step * 0.8))
        t += step + (gap_at or {}).get(i, 0.0)
    return words


# ------------------------------------------------------------------ end edge

def test_end_prefers_a_sentence_over_a_nearer_pause():
    """A 0.9s pause sits just past the payoff and a full stop sits further on.
    The pause is nearer, but it is mid-sentence."""
    words = timeline(80, terminal_at={44}, gap_at={31: 0.9})
    span = resolve_span(Span(0, 30, "hook"), words, Settings(), is_first=True)

    assert span.end_rule == "sentence_forward", span.trace
    assert words[44].end <= span.source_end <= words[45].start + 0.5


def test_end_falls_back_to_a_long_pause_when_there_is_no_punctuation():
    """ASR output without terminal punctuation must still close somewhere
    defensible rather than failing."""
    words = timeline(80, terminal_at=set(), gap_at={33: 0.9})
    span = resolve_span(Span(0, 30, "hook"), words, Settings(), is_first=True)

    assert span.end_rule in ("pause_strong", "pause_weak"), span.trace
    assert span.source_end > words[30].end


def test_end_pad_never_bleeds_into_the_next_word():
    """
    The pad must be clipped to the silence actually available. Padding a fixed
    0.4s past a word that is followed by 0.05s of silence ends the clip on half
    a syllable of speech the viewer was never meant to hear.
    """
    words = timeline(80, terminal_at={40}, step=0.5)   # ~0.1s gaps throughout
    s = Settings()
    span = resolve_span(Span(0, 30, "hook"), words, s, is_first=True)

    following = next(w for w in words if w.start > span.source_end - 1e-6)
    assert span.source_end <= following.start + 1e-6, (
        f"clip ends at {span.source_end:.3f}s, inside word {following.text!r} "
        f"which starts at {following.start:.3f}s"
    )


# ------------------------------------------------------------------ start edge

def test_a_later_span_starting_mid_breath_is_rejected():
    """
    Inside a compilation this seam is far more audible than a rough single cut,
    because the viewer has no reason to expect a jump there.
    """
    words = timeline(40, terminal_at={20}, step=0.55)   # ~0.11s gaps: no room
    span = resolve_span(Span(5, 18, "point"), words, Settings(), is_first=False)

    assert not span.ok
    assert "mid-breath" in " ".join(span.trace) or "spliced" in " ".join(span.trace)
    assert span.start_rule == "unclean"


def test_a_later_span_starting_after_a_full_stop_is_accepted():
    words = timeline(40, terminal_at={10}, gap_at={10: 0.8})
    span = resolve_span(Span(11, 25, "point"), words, Settings(), is_first=False)

    assert span.ok, span.note
    assert span.start_rule == "sentence_and_pause", span.trace


def test_a_later_span_opens_early_to_leave_room_for_the_crossfade():
    """
    A crossfade blends both sides. If the span begins on its first phoneme the
    dissolve overlaps live speech from two different places and you hear two
    voices, so the in-point backs into the preceding silence.
    """
    s = Settings()
    words = timeline(40, terminal_at={10}, gap_at={10: 0.8})
    span = resolve_span(Span(11, 25, "point"), words, s, is_first=False)

    assert span.source_start < words[11].start, "no room left for the dissolve"
    assert words[11].start - span.source_start <= s.fade_duration + 0.06
    assert span.lead_silence >= s.fade_duration


def test_first_span_keeps_the_hook_snapping_behaviour():
    """The opening of a clip already reads well; that path must not change."""
    words = timeline(60, terminal_at={40}, gap_at={9: 0.7})
    span = resolve_span(Span(12, 35, "hook"), words, Settings(), is_first=True)

    assert span.start_rule in ("snap_pause", "hook_minus_backoff"), span.trace
    assert span.ok


def test_trace_records_both_edges_for_debugging():
    words = timeline(60, terminal_at={40})
    span = resolve_span(Span(0, 30, "hook"), words, Settings(), is_first=True)
    joined = " ".join(span.trace)
    assert "start" in joined and "end" in joined
    assert any("candidate" in line for line in span.trace)
