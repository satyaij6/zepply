"""
Stage 6: final ordering.

    final = 0.5*hook + 0.3*standalone + 0.2*coherence, scaled by choppiness

Overlap removal already happened in assemble.dedupe, which compares plans by
source overlap rather than by theme text -- overlap is objective, whereas theme
strings written in one pass rarely match exactly and fuzzy-matching them just
adds a new way to be wrong. This stage only orders what survived.

**Choppiness is applied HERE, not only in the prefilter.** The prefilter's
regions are hints in the scoring prompt, not constraints: the model sees the
whole transcript and is free to propose a span no region covers. Measured -- a
run whose 30 vetted regions all sat under 11.8 source cuts/min still produced
an 88.5s clip at 13.6, because the span it chose overlapped none of them and
`plan_max_duration` allows 90s against the prefilter's 75s window. Penalising
the regions biases what gets suggested; penalising the final spans is what
actually decides which clips get cut.
"""
from __future__ import annotations

import logging

from . import scenes
from .config import Settings
from .models import ClipPlan

log = logging.getLogger(__name__)


def choppiness_of(plan: ClipPlan, cuts: list[float], settings: Settings) -> float:
    """
    Source cuts per minute across a plan's spans, weighted by their length.

    Weighted rather than averaged: a compilation of one calm 40s span and one
    frantic 5s span is mostly calm, and a plain mean would say otherwise.
    """
    total = sum(s.source_end - s.source_start for s in plan.spans)
    if total <= 0:
        return 0.0
    return sum(
        scenes.cuts_per_minute(cuts, s.source_start, s.source_end)
        * (s.source_end - s.source_start)
        for s in plan.spans
    ) / total


def rank(plans: list[ClipPlan], settings: Settings,
         cuts: list[float] | None = None) -> list[ClipPlan]:
    def score_of(p: ClipPlan) -> float:
        base = p.final(settings.w_hook, settings.w_standalone,
                       settings.w_coherence)
        if not cuts:
            return base
        return base * scenes.choppiness_factor(
            choppiness_of(p, cuts, settings), settings)

    ordered = sorted(plans, key=score_of, reverse=True)
    for p in ordered:
        base = p.final(settings.w_hook, settings.w_standalone,
                       settings.w_coherence)
        note = ""
        if cuts:
            rate = choppiness_of(p, cuts, settings)
            factor = scenes.choppiness_factor(rate, settings)
            note = f"  {rate:.0f} cuts/min"
            if factor < 1.0:
                note += f" x{factor:.2f} -> {base * factor:.2f}"
        log.info("rank: %s %-14s %.2f  %d span(s)  %.1fs%s  %s",
                 p.id, p.format, base, len(p.spans), p.total_duration, note,
                 p.suggested_title[:40])
    return ordered
