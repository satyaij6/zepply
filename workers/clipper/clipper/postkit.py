"""
The words that go WITH a clip: titles, caption, hashtags, cover text -- and,
for the long video itself, a title, description and YouTube chapters.

One call for the whole batch rather than one per clip. The model writes better
titles when it can see the set (it stops giving five clips the same opener),
and chapters need the whole transcript anyway.

This stage is an extra, never a gate. A failure here logs and returns None:
the clips are the product, and losing a finished render because a caption
could not be written would be the wrong trade.

Runs BEFORE the render, because the cover image carries the cover text.
Cached by the selected plans' spans, so `--from cut` re-renders without paying
for the copy again.
"""
from __future__ import annotations

import hashlib
import json
import logging

from pydantic import BaseModel, Field

from .config import Paths, Settings
from .errors import ClipperError, TransientError
from .models import ClipPlan, Word
from .retry import with_retry

log = logging.getLogger(__name__)

CACHE_VERSION = 1
# Transcript lines for chapters: one per this many seconds of speech.
LINE_SECONDS = 20.0

SYSTEM = """\
You write the post copy for short vertical clips cut from a long video by an
Indian creator or business. The speech is usually Telugu mixed with English.

Write in the language mix the speaker uses, in LATIN script: English words as
English, Telugu words romanised the way people type them on Instagram ("chala
mandi", "ee area lo"). Search and hashtags on Instagram and YouTube work on
Latin text, which is why.

Rules:
- Titles: 5 per clip, each under 70 characters, each a different angle
  (question, bold claim, number, curiosity gap, plain benefit). No clickbait the
  clip does not pay off. No emoji in titles.
- Caption: 1-3 short lines for Instagram/TikTok. Open with the hook, end with a
  light call to action (follow, comment, save). At most two emoji.
- Hashtags: 5-8, lowercase, no spaces, without the '#'. Mix broad and niche;
  include a location or language tag only when the clip supports it.
- Cover text: 2-6 words for the thumbnail, punchy, readable at a glance. Mark
  the one or two words that carry it with *asterisks*.
- Never use the phrase "24/7". Never name AI tools or vendors.
- For the full video: 3 title options, a YouTube description (3-6 short
  paragraphs, no hashtags inside it), and chapters. The first chapter starts
  at 0. Chapters are at least 30 seconds apart, 4-12 of them, titled in 2-6
  words. Use the timestamps shown in the transcript.
"""


class ClipKit(BaseModel):
    clip: int = Field(description="The clip's number as given")
    titles: list[str]
    caption: str
    hashtags: list[str]
    cover_text: str


class Chapter(BaseModel):
    start_seconds: float
    title: str


class SourceKit(BaseModel):
    titles: list[str]
    description: str
    chapters: list[Chapter]


class Kit(BaseModel):
    clips: list[ClipKit]
    source: SourceKit


def _clock(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


def timed_transcript(words: list[Word]) -> str:
    """The transcript as `[m:ss] text` lines, one per LINE_SECONDS."""
    lines, bucket, start = [], [], None
    for w in words:
        if w.overlap:
            continue
        if start is None:
            start = w.start
        bucket.append(w.text)
        if w.end - start >= LINE_SECONDS:
            lines.append(f"[{_clock(start)}] {' '.join(bucket)}")
            bucket, start = [], None
    if bucket and start is not None:
        lines.append(f"[{_clock(start)}] {' '.join(bucket)}")
    return "\n".join(lines)


def clip_text(plan: ClipPlan, words: list[Word]) -> str:
    parts = []
    for span in plan.spans:
        parts.append(" ".join(w.text for w in words
                              if span.source_start <= w.start < span.source_end
                              and not w.overlap))
    return " ... ".join(parts)


def build_prompt(plans: list[ClipPlan], words: list[Word], *, niche: str | None,
                 duration: float | None) -> str:
    blocks = []
    for n, plan in enumerate(plans, 1):
        blocks.append(
            f"CLIP {n} ({plan.total_duration:.0f}s, format {plan.format})\n"
            f"Theme: {plan.theme}\nWorking title: {plan.suggested_title}\n"
            f"Words: {clip_text(plan, words)}"
        )
    head = [f"There are {len(plans)} clips. Return one entry per clip, numbered 1-{len(plans)}."]
    if niche:
        head.append(f"The creator's niche: {niche}.")
    if duration:
        head.append(f"The full video runs {_clock(duration)}.")
    return "\n".join([
        *head, "", *("\n\n".join(blocks).splitlines()), "",
        "FULL VIDEO TRANSCRIPT (for the full-video title, description and chapters):",
        timed_transcript(words),
    ])


def _cache_key(plans: list[ClipPlan], niche: str | None) -> str:
    raw = json.dumps([[(s.source_start, s.source_end) for s in p.spans] for p in plans]
                     + [niche or "", CACHE_VERSION])
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _call(settings: Settings, prompt: str) -> Kit:
    import anthropic

    from .http import ensure_tls

    ensure_tls()
    client = anthropic.Anthropic(api_key=settings.require_anthropic())

    def once() -> Kit:
        try:
            with client.messages.stream(
                model=settings.postkit_model,
                max_tokens=settings.postkit_max_tokens,
                system=SYSTEM,
                thinking={"type": "adaptive"},
                output_config={"effort": "low"},
                messages=[{"role": "user", "content": prompt}],
                output_format=Kit,
            ) as stream:
                response = stream.get_final_message()
        except (anthropic.RateLimitError, anthropic.APIConnectionError,
                anthropic.InternalServerError) as exc:
            raise TransientError(f"Claude call failed: {type(exc).__name__}",
                                 status=getattr(exc, "status_code", None)) from exc
        parsed = response.parsed_output
        if parsed is None:
            raise TransientError(f"no structured output (stop_reason={response.stop_reason})")
        return parsed

    return with_retry(once, what="post kit", attempts=3, base_delay=2.0)


def _clean_tags(tags: list[str]) -> list[str]:
    out: list[str] = []
    for t in tags:
        t = "".join(t.strip().lstrip("#").split()).lower()
        if t and t not in out:
            out.append(t)
    return out[:10]


def _normalise(kit: Kit, count: int, duration: float | None) -> dict:
    clips: dict[str, dict] = {}
    for c in kit.clips:
        if 1 <= c.clip <= count:
            clips[str(c.clip)] = {
                "titles": [t.strip() for t in c.titles if t.strip()][:5],
                "caption": c.caption.strip(),
                "hashtags": _clean_tags(c.hashtags),
                "cover_text": c.cover_text.strip(),
            }
    chapters = sorted(kit.source.chapters, key=lambda ch: ch.start_seconds)
    cleaned: list[dict] = []
    for ch in chapters:
        start = max(0.0, float(ch.start_seconds))
        if duration and start >= duration:
            continue
        if cleaned and start - cleaned[-1]["start"] < 10:
            continue  # YouTube ignores chapters closer than 10s
        cleaned.append({"start": round(start), "title": ch.title.strip()})
    if cleaned:
        cleaned[0]["start"] = 0  # YouTube requires the first at 0:00
    if len(cleaned) < 3:
        cleaned = []  # YouTube needs at least three to show any
    return {
        "clips": clips,
        "source": {
            "titles": [t.strip() for t in kit.source.titles if t.strip()][:5],
            "description": kit.source.description.strip(),
            "chapters": cleaned,
        },
    }


def chapters_text(chapters: list[dict]) -> str:
    """Chapters as YouTube wants them pasted into a description."""
    return "\n".join(f"{_clock(c['start'])} {c['title']}" for c in chapters)


def ensure(plans: list[ClipPlan], words: list[Word], paths: Paths, settings: Settings,
           *, duration: float | None = None) -> dict | None:
    """The post kit for these plans: cached, freshly written, or None on failure."""
    if not settings.postkit or not plans:
        return None
    key = _cache_key(plans, settings.niche)
    cache = paths.work / "postkit.json"
    if cache.exists():
        try:
            payload = json.loads(cache.read_text(encoding="utf-8"))
            if payload.get("key") == key:
                log.info("postkit: reusing cached copy")
                return payload["kit"]
        except (json.JSONDecodeError, KeyError):
            pass
    try:
        prompt = build_prompt(plans, words, niche=settings.niche, duration=duration)
        kit = _normalise(_call(settings, prompt), len(plans), duration)
    except (ClipperError, Exception) as exc:  # noqa: BLE001 - copy must never cost the clips
        log.warning("postkit: could not write post copy (%s); clips go out without it", exc)
        return None
    from .store import write_json

    write_json(cache, {"key": key, "kit": kit})
    log.info("postkit: copy for %d clips, %d chapters", len(kit["clips"]),
             len(kit["source"]["chapters"]))
    return kit
