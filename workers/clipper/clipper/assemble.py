"""
Stage 4b: turn a model's clip plans into something renderable, or reject them.

score.py decides what a clip IS. This stage decides whether that decision is
physically coherent -- spans that do not overlap, land in range, are long enough
to read as intentional, and add up to a watchable length -- and marks how the
seams between them should be rendered.

Validation runs TWICE. The model proposes spans by word index, and boundary.py
then moves both edges to land on clean speech boundaries, which changes every
duration. So `validate_plan` runs once here on raw word times as a cheap filter,
and again after boundary as the authoritative check. A plan that drifts out of
range while being snapped is rejected there, with the drift recorded.

Nothing in this module knows what a `format` means. The valid set is whatever
prompts/hook_rubric.txt declares.
"""
from __future__ import annotations

import logging

from .config import Settings
from .models import ROLES, ClipPlan, Join, Span, Word

log = logging.getLogger(__name__)


# ------------------------------------------------------------------ helpers

def span_times(span: Span, words: list[Word]) -> tuple[float, float]:
    """Raw word-clock extent, before boundary snapping."""
    return words[span.start_word_i].start, words[span.end_word_i].end


def _overlaps(a: tuple[float, float], b: tuple[float, float]) -> float:
    lo, hi = max(a[0], b[0]), min(a[1], b[1])
    return max(0.0, hi - lo)


# ------------------------------------------------------------------ validation

def validate_plan(
    plan: ClipPlan, words: list[Word], formats: dict[str, str], settings: Settings,
    *, snapped: bool = False,
) -> str | None:
    """
    Return None if the plan is renderable, else a human reason for rejection.

    `snapped` selects which clock to measure: raw word times before boundary
    has run, resolved source times after.
    """
    if plan.format not in formats:
        return (f"format {plan.format!r} is not declared in the rubric "
                f"(valid: {', '.join(sorted(formats))})")

    if not plan.spans:
        return "plan has no spans"
    if len(plan.spans) > settings.max_spans:
        return (f"{len(plan.spans)} spans exceeds max_spans={settings.max_spans}; "
                f"beyond that it reads as a slideshow, not a clip")

    last = len(words) - 1
    for n, span in enumerate(plan.spans):
        if not (0 <= span.start_word_i <= span.end_word_i <= last):
            return (f"span {n} has out-of-range or non-monotonic indices "
                    f"[{span.start_word_i}..{span.end_word_i}], transcript is 0..{last}")
        if span.role not in ROLES:
            return f"span {n} has unknown role {span.role!r} (valid: {', '.join(ROLES)})"

    hooks = [n for n, s in enumerate(plan.spans) if s.role == "hook"]
    if len(hooks) != 1:
        return (f"expected exactly one span with role 'hook', found {len(hooks)}; "
                f"every format has to earn attention in the first two seconds")
    if hooks[0] != 0:
        return f"the hook span is at playback position {hooks[0]}, it must be first"

    if not plan.theme.strip():
        return "theme is empty"
    if not plan.suggested_title.strip():
        return "suggested_title is empty"

    # Overlap is checked in SOURCE time, never playback order -- two spans that
    # play far apart can still be the same piece of source.
    extents = [
        (span.source_start, span.source_end) if snapped else span_times(span, words)
        for span in plan.spans
    ]
    for i in range(len(extents)):
        for j in range(i + 1, len(extents)):
            shared = _overlaps(extents[i], extents[j])
            if shared > 0.01:
                return (f"spans {i} and {j} overlap by {shared:.2f}s in the source "
                        f"({extents[i][0]:.1f}-{extents[i][1]:.1f} vs "
                        f"{extents[j][0]:.1f}-{extents[j][1]:.1f})")

    for n, (lo, hi) in enumerate(extents):
        if hi - lo < settings.min_span_seconds:
            return (f"span {n} is {hi - lo:.1f}s, under the {settings.min_span_seconds}s "
                    f"minimum; shorter spans read as choppy rather than intentional")

    if snapped:
        total = plan.total_duration
    else:
        total = sum(hi - lo for lo, hi in extents)
    if not (settings.plan_min_duration <= total <= settings.plan_max_duration):
        return (f"total duration {total:.1f}s is outside "
                f"{settings.plan_min_duration:.0f}-{settings.plan_max_duration:.0f}s"
                + (" after boundary snapping" if snapped else ""))

    if snapped and any(not s.ok for s in plan.spans):
        bad = next(s for s in plan.spans if not s.ok)
        return f"a span could not be snapped cleanly: {bad.note}"

    return None


# ------------------------------------------------------------------ normalising

def merge_adjacent(plan: ClipPlan, words: list[Word], settings: Settings) -> None:
    """
    Fuse spans that are really one span.

    Two spans consecutive in playback and near-adjacent in source are
    continuous speech. Rendering a transition across them produces an audible
    seam in the middle of a sentence -- a defect the viewer reads as a mistake,
    not as editing.
    """
    merged: list[Span] = []
    for span in plan.spans:
        if merged:
            prev = merged[-1]
            gap = words[span.start_word_i].start - words[prev.end_word_i].end
            contiguous = span.start_word_i >= prev.end_word_i
            if contiguous and 0 <= gap <= settings.merge_gap:
                plan.notes.append(
                    f"merged spans at {words[prev.end_word_i].end:.1f}s "
                    f"({gap:.2f}s apart in source) -- continuous speech needs no join"
                )
                merged[-1] = Span(
                    start_word_i=prev.start_word_i, end_word_i=span.end_word_i,
                    role=prev.role, label=prev.label or span.label,
                )
                continue
        merged.append(span)
    plan.spans = merged


def assign_joins(plan: ClipPlan, words: list[Word], settings: Settings) -> None:
    """
    Decide how each seam is rendered. joins[k] sits between span k and k+1.

    A card is only ever used where the incoming span carries a label, because a
    title card with nothing to title is just a stall.
    """
    plan.joins = []
    for prev, nxt in zip(plan.spans, plan.spans[1:]):
        gap = words[nxt.start_word_i].start - words[prev.end_word_i].end
        forward = nxt.start_word_i > prev.end_word_i
        if nxt.label:
            # A labelled dissolve: transition like a fade, plus an overlay.
            plan.joins.append(Join("card", settings.fade_duration, nxt.label))
        elif forward and 0 <= gap <= settings.hard_join_max_gap:
            # A short forward skip reads as a cut; dissolving it looks like an
            # apology for a jump the viewer would not otherwise notice.
            plan.joins.append(Join("hard", settings.hard_duration))
        else:
            plan.joins.append(Join("fade", settings.fade_duration))


# ------------------------------------------------------------------ layout

def lay_out(plan: ClipPlan) -> None:
    """
    Place every span on the assembled timeline.

    A crossfade OVERLAPS its two sides, so it shortens the result; a card is its
    own interval and lengthens it. Getting this sign wrong desynchronises every
    caption after the first join.
    """
    offset = 0.0
    for n, span in enumerate(plan.spans):
        span.playback_start = round(offset, 4)
        span.playback_end = round(offset + span.duration, 4)
        offset = span.playback_end
        if n < len(plan.joins):
            offset -= plan.joins[n].duration

    order = plan.source_order
    for n, span in enumerate(plan.spans):
        span.source_order = order[n]


def join_windows(plan: ClipPlan) -> list[tuple[float, float]]:
    """
    Intervals on the assembled timeline that belong to a seam.

    No caption may overlap one: during a crossfade two different moments are on
    screen at once, and during a card the span's own words are not being spoken.
    """
    windows: list[tuple[float, float]] = []
    for n, join in enumerate(plan.joins):
        if n + 1 >= len(plan.spans):
            break
        boundary = plan.spans[n].playback_end
        windows.append((boundary - join.duration, boundary))
    return windows


# ------------------------------------------------------------------ stage

def assemble(
    plans: list[ClipPlan], words: list[Word], formats: dict[str, str],
    settings: Settings,
) -> tuple[list[ClipPlan], list[ClipPlan]]:
    """Pre-boundary pass. Returns (accepted, rejected)."""
    accepted: list[ClipPlan] = []
    rejected: list[ClipPlan] = []

    for plan in plans:
        merge_adjacent(plan, words, settings)
        reason = validate_plan(plan, words, formats, settings, snapped=False)
        if reason:
            plan.ok = False
            plan.rejected_reason = reason
            rejected.append(plan)
            log.info("assemble: rejected %s -- %s", plan.id, reason)
            continue
        assign_joins(plan, words, settings)
        for span in plan.spans:
            span.source_start, span.source_end = span_times(span, words)
        lay_out(plan)
        accepted.append(plan)

    accepted, dupes = dedupe(accepted, settings)
    rejected.extend(dupes)

    log.info("assemble: %d plans accepted, %d rejected", len(accepted), len(rejected))
    return accepted, rejected


def dedupe(plans: list[ClipPlan], settings: Settings) -> tuple[list[ClipPlan], list[ClipPlan]]:
    """
    Drop plans that are substantially the same footage.

    Deduplication is on SOURCE OVERLAP, not on theme text. Overlap is
    objective; theme strings written by separate calls rarely match, and
    fuzzy-matching them just adds a new way to be wrong.
    """
    kept: list[ClipPlan] = []
    dropped: list[ClipPlan] = []
    for plan in sorted(plans, key=lambda p: p.hook_score, reverse=True):
        clash = None
        for other in kept:
            shared = sum(
                _overlaps((a.source_start, a.source_end), (b.source_start, b.source_end))
                for a in plan.spans for b in other.spans
            )
            shorter = min(plan.total_duration, other.total_duration)
            if shorter > 0 and shared / shorter > settings.plan_dedup_overlap:
                clash = other
                break
        if clash is not None:
            plan.ok = False
            plan.rejected_reason = (
                f"covers substantially the same source as {clash.id} "
                f"(kept, hook {clash.hook_score:.1f} vs {plan.hook_score:.1f})"
            )
            dropped.append(plan)
        else:
            kept.append(plan)
    return kept, dropped


def enforce_join_headroom(plan: ClipPlan, settings: Settings) -> None:
    """
    Downgrade any fade that does not have real silence on both sides.

    A crossfade blends both spans at once. Without at least its own duration of
    silence inside each edge it dissolves live speech from two different places
    over each other -- two voices at once, which reads as a broken export
    rather than as editing. A hard cut needs no headroom, so the fade becomes a
    cut instead of becoming a defect.
    """
    for n, join in enumerate(plan.joins):
        if join.type != "fade" or n + 1 >= len(plan.spans):
            continue
        outgoing = plan.spans[n].tail_silence
        incoming = plan.spans[n + 1].lead_silence
        need = join.duration
        if outgoing < need or incoming < need:
            plan.notes.append(
                f"join {n} downgraded fade -> hard: needs {need:.2f}s of silence "
                f"each side, has {outgoing:.2f}s out / {incoming:.2f}s in. "
                f"Crossfading here would overlap live speech from both spans."
            )
            plan.joins[n] = Join("hard", settings.hard_duration)


def finalize(
    plans: list[ClipPlan], words: list[Word], formats: dict[str, str],
    settings: Settings,
) -> tuple[list[ClipPlan], list[ClipPlan]]:
    """Post-boundary pass: re-lay-out and re-validate against snapped times."""
    accepted: list[ClipPlan] = []
    rejected: list[ClipPlan] = []
    for plan in plans:
        enforce_join_headroom(plan, settings)
        lay_out(plan)
        reason = validate_plan(plan, words, formats, settings, snapped=True)
        if reason:
            plan.ok = False
            plan.rejected_reason = reason
            rejected.append(plan)
            log.info("assemble: rejected %s after snapping -- %s", plan.id, reason)
        else:
            accepted.append(plan)
    return accepted, rejected


def plans_payload(
    accepted: list[ClipPlan], rejected: list[ClipPlan], formats: dict[str, str],
    rubric_hash: str,
) -> dict:
    return {
        "rubric_sha256": rubric_hash,
        "formats_declared": sorted(formats),
        "accepted": len(accepted),
        "rejected": len(rejected),
        "plans": [p.to_dict() for p in accepted],
        "rejected_plans": [p.to_dict() for p in rejected],
    }
