"""
Telugu script -> Roman, one word at a time.

Two hard requirements shape this module.

1. **Per-word calls, not per-sentence.** Sarvam's transliteration is
   context-sensitive: వెతుకుతున్నావ్ comes back as "Vetukutunnaav" on its own
   but as "shodhhuktnav" inside a sentence. Worse, some inputs SPLIT -- with
   spoken_form, ఓఆర్ఆర్ becomes three tokens. A split anywhere silently shifts
   every word index after it, and since word indices carry the timings, that
   desynchronizes the entire caption track.

2. **One word in, one word out.** Every input word gets exactly one output
   slot, enforced structurally by calling per word. A slot's text may itself
   contain a space (the API occasionally expands an abbreviation); that is
   allowed and logged, because it keeps the slot count -- and therefore the
   timing alignment -- intact.

The on-disk cache does the heavy lifting on cost: ad copy and property
walkthroughs repeat vocabulary heavily, so most words are paid for once ever.
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

from .config import ROOT
from .errors import ASRError, TransientError
from .http import RETRYABLE_STATUS, ensure_tls
from .retry import with_retry

log = logging.getLogger(__name__)

TRANSLITERATE_URL = "https://api.sarvam.ai/transliterate"
CACHE_PATH = ROOT / ".cache" / "translit" / "te-IN_to_en-IN.json"
SAVE_EVERY = 25          # flush the cache to disk this often

# Sarvam's transliteration occasionally degenerates into a repetition loop:
# వచ్చింది (8 chars) came back as 383 characters of "Aa aa aa aa ...". Median
# expansion across a real 20-minute source is 1.00x, so anything past a few x
# is pathological rather than merely verbose.
#
# This is not a cosmetic problem. An over-long token breaks TWO stages: the
# caption cue becomes far wider than the frame, and CTC forced alignment fails
# outright because the target character count exceeds the available audio
# frames -- taking the whole surrounding segment's timings down with it.
MAX_EXPANSION = 6.0
MIN_EXPANSION_FLOOR = 24       # never flag very short outputs


def collapse_repeats(text: str) -> str:
    """Collapse consecutively repeated tokens: 'Aa aa aa aa' -> 'Aa'."""
    out: list[str] = []
    for token in text.split():
        if not out or token.lower() != out[-1].lower():
            out.append(token)
    return " ".join(out)


def is_degenerate(source: str, out: str) -> bool:
    limit = max(MIN_EXPANSION_FLOOR, MAX_EXPANSION * len(source))
    return len(out) > limit

# Words with no Telugu codepoints are already Roman (English loanwords the ASR
# left alone, numbers, punctuation). Sending them wastes a call and risks the
# API "correcting" them.
_TELUGU = re.compile(r"[ఀ-౿]")


class Transliterator:
    def __init__(
        self,
        api_key: str,
        *,
        cache_path: Path = CACHE_PATH,
        source_language: str = "te-IN",
        target_language: str = "en-IN",
        # Measured: Sarvam's transliterate endpoint rate-limits on CONCURRENCY,
        # not on request rate. Three parallel workers produced constant 429s;
        # serial requests succeeded 6/6 even with zero delay between them. So
        # go serial and don't bother sleeping.
        concurrency: int = 1,
        min_interval: float = 0.0,
        timeout: float = 60.0,
    ):
        self.api_key = api_key
        self.cache_path = cache_path
        self.source_language = source_language
        self.target_language = target_language
        self.concurrency = concurrency
        # Sarvam rate-limits per-word transliteration aggressively. A small
        # client-side floor between requests costs seconds over a whole video
        # and avoids the 429 storm that made words fall back untransliterated.
        self.min_interval = min_interval
        self._last_call = 0.0
        self._pace = threading.Lock()
        self.timeout = timeout
        self._lock = threading.Lock()
        self._cache: dict[str, str] = self._load_cache()
        self._session = requests.Session()
        self.stats = {"cached": 0, "fetched": 0, "passthrough": 0, "expanded": 0, "failed": 0,
                      "degenerate": 0}
        self._since_save = 0

    # ------------------------------------------------------------- cache

    def _load_cache(self) -> dict[str, str]:
        if not self.cache_path.exists():
            return {}
        try:
            return json.loads(self.cache_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            log.warning("transliteration cache at %s is corrupt; starting fresh",
                        self.cache_path)
            return {}

    def save_cache(self) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.cache_path.with_suffix(".tmp")
        with self._lock:
            payload = json.dumps(self._cache, ensure_ascii=False, indent=0)
        tmp.write_text(payload, encoding="utf-8")
        tmp.replace(self.cache_path)

    # ------------------------------------------------------------- api

    def _throttle(self) -> None:
        with self._pace:
            wait = self.min_interval - (time.monotonic() - self._last_call)
            if wait > 0:
                time.sleep(wait)
            self._last_call = time.monotonic()

    def _call(self, word: str) -> str:
        ensure_tls()

        def once() -> str:
            self._throttle()
            try:
                resp = self._session.post(
                    TRANSLITERATE_URL,
                    headers={"api-subscription-key": self.api_key,
                             "Content-Type": "application/json"},
                    json={
                        "input": word,
                        "source_language_code": self.source_language,
                        "target_language_code": self.target_language,
                    },
                    timeout=self.timeout,
                )
            except (requests.Timeout, requests.ConnectionError) as exc:
                raise TransientError(f"{type(exc).__name__} transliterating {word!r}") from exc

            if resp.status_code in RETRYABLE_STATUS:
                raise TransientError(
                    f"HTTP {resp.status_code} transliterating {word!r}",
                    status=resp.status_code,
                )
            if not resp.ok:
                raise ASRError(
                    f"HTTP {resp.status_code} from transliterate: {resp.text[:300]}",
                    hint="Check SARVAM_API_KEY and the language codes.",
                )
            out = (resp.json() or {}).get("transliterated_text")
            if not isinstance(out, str) or not out.strip():
                raise ASRError(f"transliterate returned no text for {word!r}")
            return out.strip()

        return with_retry(
            once, what=f"transliterate({word[:16]})",
            attempts=6, base_delay=2.0, max_delay=45.0,
        )

    def _resolve(self, word: str) -> str:
        stripped = word.strip()
        if not stripped:
            return word
        if not _TELUGU.search(stripped):
            self.stats["passthrough"] += 1
            return stripped

        with self._lock:
            hit = self._cache.get(stripped)
        if hit is not None:
            self.stats["cached"] += 1
            return hit

        try:
            out = self._call(stripped)
        except (ASRError, TransientError) as exc:
            # One unromanizable word must not sink a whole video. Keep the
            # original so the slot -- and every timing after it -- survives.
            log.warning("transliteration failed for %r (%s); keeping original", stripped, exc)
            self.stats["failed"] += 1
            return stripped

        if is_degenerate(stripped, out):
            # Often transient: వచ్చింది returned 383 junk characters once and a
            # clean result on the very next call. Ask again before degrading.
            log.debug("transliteration degenerated for %r; retrying once", stripped)
            try:
                retry = self._call(stripped)
            except (ASRError, TransientError):
                retry = out
            if not is_degenerate(stripped, retry):
                log.info("transliteration recovered for %r on retry -> %r",
                         stripped, retry)
                out = retry

        if is_degenerate(stripped, out):
            collapsed = collapse_repeats(out)
            if not is_degenerate(stripped, collapsed):
                log.warning(
                    "transliteration degenerated for %r (%d chars); collapsed "
                    "repeats -> %r", stripped, len(out), collapsed,
                )
                out = collapsed
            else:
                # Keeping the original Telugu costs one un-romanized caption
                # word; keeping the runaway string costs the whole segment's
                # alignment and an unreadable cue.
                log.warning(
                    "transliteration degenerated for %r (%d chars, %.0fx); "
                    "keeping the original word",
                    stripped, len(out), len(out) / max(len(stripped), 1),
                )
                self.stats["degenerate"] += 1
                return stripped

        if " " in out:
            self.stats["expanded"] += 1
            log.debug("transliteration expanded %r -> %r (kept in one slot)", stripped, out)

        with self._lock:
            self._cache[stripped] = out
            self._since_save += 1
            due = self._since_save >= SAVE_EVERY
            if due:
                self._since_save = 0
        self.stats["fetched"] += 1
        # Persist as we go. A 20-minute source is ~1200 distinct words and
        # several minutes of calls; saving only at the end means an interrupted
        # run discards every word it already paid for.
        if due:
            self.save_cache()
        return out

    # ------------------------------------------------------------- public

    def words(self, words: list[str]) -> list[str]:
        """
        Romanize a word list, preserving length exactly.

        Resolves the *distinct* words once and then maps back. A 20-minute
        source has thousands of word occurrences but far fewer distinct words,
        and mapping the pool over every occurrence makes duplicates race each
        other past the cache -- every copy of a common word issues its own
        request before the first one returns. Deduplicating first cuts the call
        count hard, which is what keeps Sarvam from rate-limiting the run.

        Raises if the invariant is ever violated -- that is a bug worth stopping
        for, not something to paper over, because the alternative is captions
        that drift further out of sync the longer the clip runs.
        """
        if not words:
            return []

        distinct = list(dict.fromkeys(words))
        log.info("transliterate: %d words, %d distinct (%.0f%% saved by dedup)",
                 len(words), len(distinct),
                 100 * (1 - len(distinct) / len(words)) if words else 0)

        with ThreadPoolExecutor(max_workers=self.concurrency) as pool:
            resolved = list(pool.map(self._resolve, distinct))
        table = dict(zip(distinct, resolved))
        out = [table[w] for w in words]

        if len(out) != len(words):
            raise ASRError(
                f"Transliteration changed the word count: {len(words)} in, {len(out)} out",
                hint="Word indices carry the timings; a count change desyncs every caption.",
            )
        self.save_cache()
        log.info(
            "transliterate: %d words (%d cached, %d fetched, %d already roman, "
            "%d expanded, %d failed)",
            len(words), self.stats["cached"], self.stats["fetched"],
            self.stats["passthrough"], self.stats["expanded"], self.stats["failed"],
        )
        return out
