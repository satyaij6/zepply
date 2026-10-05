"""
Stage 5: decide the exact in/out points of every span. Not part of scoring.

Scoring answers "is this worth cutting"; this answers "where exactly does the
cut land". Keeping them apart means a bad cut is debuggable without re-running
the LLM, and the rules retune independently of the rubric.

Two things make this harder than it was when a clip was one window:

* **Both edges of every span matter.** A clean end followed by a span that
  starts mid-breath still sounds spliced. Inside a compilation that seam is far
  more audible than a rough single cut, because the viewer has no reason to
  expect a jump there.

* **A crossfade blends both sides at once.** If a span starts on its first
  phoneme, the dissolve overlaps live speech from two different places and you
  hear two voices. Each join edge therefore needs real silence on its inside,
  not merely a defensible snap point. `lead_silence` and `tail_silence` record
  how much is actually available so assemble can downgrade a fade to a cut
  rather than render a mess.

End-rule priority, measured rather than assumed: sentence-final punctuation
beats pause length. On a real 20-minute source, of 273 inter-word gaps >= 0.4s
77% fall mid-sentence, and the correlation gets *worse* as the gap grows --
gaps >= 1.0s land on a sentence end 0% of the time, because long pauses in this
material are dramatic beats, not full stops.
"""
from __future__ import annotations

import logging

from .config import Settings
from .models import ClipPlan, Span, Word

log = logging.getLogger(__name__)


# ------------------------------------------------------------------ helpers

def gap_before(words: list[Word], i: int) -> float:
    """Silence in front of word i. The head of the recording counts as open."""
    if i <= 0:
        return 999.0
    return max(words[i].start - words[i - 1].end, 0.0)


def gap_after(words: list[Word], i: int) -> float:
    if i >= len(words) - 1:
        return 999.0
    return max(words[i + 1].start - words[i].end, 0.0)


def ends_sentence(word: Word, terminators: str) -> bool:
    return word.text.rstrip().endswith(tuple(terminators))


def starts_sentence(words: list[Word], i: int, terminators: str) -> bool:
    return i == 0 or ends_sentence(words[i - 1], terminators)


# ------------------------------------------------------------------ start edge

def _resolve_start(
    span: Span, words: list[Word], settings: Settings, *, is_first: bool,
    trace: list[str],
) -> tuple[int, float, str, bool]:
    """Returns (word index, time, rule, clean)."""
    i = span.start_word_i
    word = words[i]
    room = gap_before(words, i)
    trace.append(
        f"start candidate [{i}] {word.text!r} at {word.start:.2f}s "
        f"({room:.2f}s of silence in front)"
    )

    if is_first:
        # The opening of a clip: hunt backwards for a breath to start on, as
        # before. This is the behaviour that already reads well.
        hook_start = word.start
        for j in range(i, 0, -1):
            distance = hook_start - words[j].start
            if distance > settings.start_lookback_max + 0.5:
                break
            if gap_before(words, j) >= settings.start_pause_min:
                trace.append(
                    f"start snap_pause: {gap_before(words, j):.2f}s pause "
                    f"{distance:.2f}s before the hook, starting at {words[j].start:.2f}s"
                )
                return j, words[j].start, "snap_pause", True
        start = max(0.0, hook_start - settings.hook_backoff)
        trace.append(
            f"start hook_minus_backoff: no pause >= {settings.start_pause_min}s within "
            f"{settings.start_lookback_max}s; start = hook - {settings.hook_backoff}s "
            f"= {start:.2f}s"
        )
        return i, start, "hook_minus_backoff", True

    # A later span opens on a seam. It must begin where a listener would accept
    # a new thought starting, or the join sounds like a splice.
    on_sentence = starts_sentence(words, i, settings.sentence_terminators)
    air = min(room, settings.fade_duration + 0.05)
    start = max(0.0, word.start - air)

    if on_sentence and room >= settings.start_pause_min:
        trace.append(
            f"start sentence_and_pause: begins a sentence after {room:.2f}s of "
            f"silence; opening {air:.2f}s early at {start:.2f}s for the join"
        )
        return i, start, "sentence_and_pause", True
    if on_sentence:
        trace.append(
            f"start sentence_start: begins a sentence but only {room:.2f}s of "
            f"silence in front; opening {air:.2f}s early at {start:.2f}s"
        )
        return i, start, "sentence_start", True
    if room >= settings.start_pause_min:
        trace.append(
            f"start pause_start: mid-sentence, but {room:.2f}s of silence in front; "
            f"opening {air:.2f}s early at {start:.2f}s"
        )
        return i, start, "pause_start", True

    trace.append(
        f"start REJECTED: [{i}] {word.text!r} neither begins a sentence nor follows "
        f"a pause >= {settings.start_pause_min}s (only {room:.2f}s). Joining here "
        f"would open mid-breath and sound spliced."
    )
    return i, word.start, "unclean", False


# ------------------------------------------------------------------ end edge

def _resolve_end(
    span: Span, words: list[Word], start: float, settings: Settings,
    *, trace: list[str],
) -> tuple[int, float, str, bool]:
    payoff_i = span.end_word_i
    terms = settings.sentence_terminators
    pad = settings.end_pad
    trace.append(
        f"end candidate [{payoff_i}] {words[payoff_i].text!r} ends at "
        f"{words[payoff_i].end:.2f}s"
    )

    def close_on(i: int, rule: str, why: str) -> tuple[int, float, str, bool]:
        # Never pad into the next word: the clip would end on half a syllable
        # of speech that belongs to material we are not showing.
        room = gap_after(words, i)
        end = words[i].end + min(room, pad)
        trace.append(f"end {rule}: {why} -> {end:.2f}s "
                     f"(pad {min(room, pad):.2f}s of {room:.2f}s available)")
        return i, end, rule, True

    horizon = words[payoff_i].end + settings.sentence_search
    lo, hi = settings.plan_min_duration, settings.plan_max_duration * settings.end_overshoot

    # 1. A finished sentence, at or after the payoff. Strongest signal by far.
    for word in words[payoff_i:]:
        if word.end > horizon:
            break
        if not ends_sentence(word, terms):
            continue
        if word.end + pad - start > hi:
            break
        return close_on(word.i, "sentence_forward",
                        f"{word.text!r} ends a sentence at {word.end:.2f}s")

    # 2. A long pause ahead. Weak evidence on its own (10% land on a sentence
    #    end) but better than stopping on a word boundary with no signal.
    for i in range(payoff_i, len(words) - 1):
        if words[i].end - words[payoff_i].end > settings.end_pause_strong_window:
            break
        room = gap_after(words, i)
        if room >= settings.end_pause_strong and words[i].end + pad - start <= hi:
            return close_on(i, "pause_strong",
                            f"{room:.2f}s pause after [{i}] "
                            f"(>= {settings.end_pause_strong}s)")
    trace.append(
        f"end: no pause >= {settings.end_pause_strong}s within "
        f"{settings.end_pause_strong_window}s of the payoff"
    )

    # 3. Any usable pause.
    for i in range(payoff_i, len(words) - 1):
        if words[i].end - words[payoff_i].end > settings.sentence_search:
            break
        room = gap_after(words, i)
        if room >= settings.start_pause_min and words[i].end + pad - start <= hi:
            return close_on(i, "pause_weak",
                            f"{room:.2f}s pause after [{i}] (may stop mid-sentence)")

    # 4. An earlier sentence end, trimming the span.
    for word in reversed(words[:payoff_i + 1]):
        if word.end + pad - start < lo:
            break
        if ends_sentence(word, terms):
            i, end, rule, ok = close_on(
                word.i, "sentence_back",
                f"nothing ahead fits; falling back to {word.text!r}"
            )
            trace.append(f"  NOTE: this cuts before the payoff word [{payoff_i}]")
            return i, end, rule, ok

    return close_on(payoff_i, "payoff_plus_pad", "no boundary found in either direction")


# ------------------------------------------------------------------ public

def resolve_span(
    span: Span, words: list[Word], settings: Settings, *, is_first: bool,
) -> Span:
    trace: list[str] = []
    _, start, start_rule, start_clean = _resolve_start(
        span, words, settings, is_first=is_first, trace=trace
    )
    end_i, end, end_rule, _ = _resolve_end(span, words, start, settings, trace=trace)

    span.source_start = round(start, 3)
    span.source_end = round(max(end, start + 0.05), 3)
    span.start_rule = start_rule
    span.end_rule = end_rule
    span.lead_silence = round(gap_before(words, span.start_word_i), 3)
    span.tail_silence = round(gap_after(words, end_i), 3)
    span.trace = trace

    if not start_clean:
        span.ok = False
        span.note = (f"start edge could not snap cleanly ([{span.start_word_i}] "
                     f"{words[span.start_word_i].text!r})")
    elif span.duration < settings.min_span_seconds:
        span.ok = False
        span.note = (f"resolved to {span.duration:.1f}s, under the "
                     f"{settings.min_span_seconds}s minimum")
    return span


def resolve_plan(plan: ClipPlan, words: list[Word], settings: Settings) -> ClipPlan:
    for n, span in enumerate(plan.spans):
        resolve_span(span, words, settings, is_first=(n == 0))
        if not span.ok:
            log.info("boundary: %s span %d rejected -- %s", plan.id, n, span.note)
    return plan


def resolve_plans(
    plans: list[ClipPlan], words: list[Word], settings: Settings,
) -> list[ClipPlan]:
    for plan in plans:
        resolve_plan(plan, words, settings)
    bad = sum(1 for p in plans for s in p.spans if not s.ok)
    log.info("boundary: resolved %d plans (%d spans failed to snap)", len(plans), bad)
    return plans
