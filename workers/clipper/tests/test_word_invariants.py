"""
The one invariant the whole pipeline rests on: one input word, one output slot.

Word indices carry the timings. hook_start_word_index points into the flat word
list, boundary.py snaps to words[i].start, and captions are cut from word spans.
If any stage adds, drops, or reorders a slot, every timing after that point
shifts and the captions drift further out of sync the longer the clip runs --
silently, with no error anywhere.

These tests use stubs, not the network or the 1.2GB alignment model, so they run
in milliseconds on every commit.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.align import AlignedSpan, _normalize, _to_words
from clipper.errors import ASRError
from clipper.models import Word

LABELS = frozenset("aienoutsrmkldghybpwcvjzf'qx")


# ------------------------------------------------------- normalization

@pytest.mark.parametrize("raw,expected", [
    ("ORR", "orr"),
    ("Vetukutunnaav", "vetukutunnaav"),
    ("Baalaiya", "baalaiya"),
    ("flat.", "flat"),
    ("2BHK", "bhk"),          # digits are not in the label set
    ("...", ""),              # empties out -- must still get a slot
])
def test_normalize_reduces_to_label_alphabet(raw, expected):
    assert _normalize(raw, LABELS) == expected


def test_normalize_folds_accents_rather_than_dropping_words():
    """An accented romanization must not vanish into an empty token."""
    assert _normalize("Ánvitha", LABELS) == "anvitha"


# ------------------------------------------------------- slot preservation

def test_every_input_word_gets_exactly_one_output_slot():
    roman = ["neo", "polis", "daggara", "hi", "rice"]
    spans = {i: AlignedSpan(i * 1.0, i * 1.0 + 0.5, 0.9) for i in range(len(roman))}
    out = _to_words(roman, None, spans, total=10.0)
    assert len(out) == len(roman)
    assert [w.i for w in out] == [0, 1, 2, 3, 4]


def test_unalignable_tokens_still_occupy_a_slot():
    """
    A token the aligner cannot consume (punctuation, bare digits) must not be
    dropped. Dropping index 2 would make every later index point at the wrong
    word -- the exact silent desync this suite exists to prevent.
    """
    roman = ["neo", "polis", "...", "hi", "rice"]
    spans = {0: AlignedSpan(0.0, 0.5, .9), 1: AlignedSpan(0.6, 1.0, .9),
             3: AlignedSpan(1.6, 2.0, .9), 4: AlignedSpan(2.1, 2.5, .9)}
    out = _to_words(roman, None, spans, total=5.0)

    assert len(out) == 5
    assert out[2].text == "..."
    assert out[1].end <= out[2].start <= out[2].end <= out[3].start, (
        "interpolated slot must sit between its neighbours without overlapping"
    )


def test_output_carries_original_script_not_the_romanization():
    """
    Alignment runs on Roman text, but captions and scoring need the original
    words back. The romanization is scaffolding, not the payload.
    """
    original = ["నియో", "పోలిస్"]
    roman = ["neo", "polis"]
    spans = {0: AlignedSpan(0.0, 0.4, .9), 1: AlignedSpan(0.5, 0.9, .9)}
    out = _to_words(roman, original, spans, total=2.0)
    assert [w.text for w in out] == original


def test_mismatched_lengths_raise_rather_than_silently_truncate():
    with pytest.raises(ASRError, match="differ in length"):
        _to_words(["a", "b", "c"], ["x", "y"], {}, total=1.0)


def test_timings_are_monotonic_even_when_spans_are_missing():
    roman = [f"w{i}" for i in range(8)]
    spans = {0: AlignedSpan(0.0, 0.3, .9), 7: AlignedSpan(4.0, 4.4, .9)}
    out = _to_words(roman, None, spans, total=5.0)
    starts = [w.start for w in out]
    assert starts == sorted(starts), f"word starts went backwards: {starts}"
    assert all(w.end >= w.start for w in out), "a word ended before it began"


# ------------------------------------------------------- transliteration

def test_transliterator_preserves_word_count(monkeypatch):
    """
    Sarvam transliteration is context sensitive and can split a token
    (spoken_form turns ఓఆర్ఆర్ into three words). Per-word calls make the slot
    count structurally safe; this pins that behaviour.
    """
    from clipper.transliterate import Transliterator

    tl = Transliterator("fake-key", cache_path=Path("/nonexistent/cache.json"))
    # Simulate the API expanding one word into three tokens.
    monkeypatch.setattr(tl, "_call", lambda w: "O Aar Aar" if w == "ఓఆర్ఆర్" else "X")

    words = ["ఓఆర్ఆర్", "బెస్ట్", "ప్రాజెక్ట్"]
    out = tl.words(words)

    assert len(out) == len(words), "expansion leaked extra slots"
    assert out[0] == "O Aar Aar", "expansion should stay inside its single slot"


def test_already_roman_words_are_not_sent_to_the_api(monkeypatch):
    """Round-tripping English through transliteration wastes calls and risks
    the API 'correcting' text that was already correct."""
    from clipper.transliterate import Transliterator

    tl = Transliterator("fake-key", cache_path=Path("/nonexistent/cache.json"))
    called: list[str] = []

    def spy(word):
        called.append(word)
        return "SHOULD-NOT-HAPPEN"

    monkeypatch.setattr(tl, "_call", spy)
    out = tl.words(["ORR", "2BHK", "Hyderabad"])

    assert called == [], f"sent already-Roman words to the API: {called}"
    assert out == ["ORR", "2BHK", "Hyderabad"]


def test_failed_transliteration_keeps_the_original_word(monkeypatch):
    """One bad word must not sink the video, and must not lose its slot."""
    from clipper.transliterate import Transliterator

    tl = Transliterator("fake-key", cache_path=Path("/nonexistent/cache.json"))

    def boom(word):
        raise ASRError("simulated API failure")

    monkeypatch.setattr(tl, "_call", boom)
    monkeypatch.setattr(tl, "save_cache", lambda: None)

    words = ["నియో", "పోలిస్"]
    out = tl.words(words)
    assert out == words
    assert tl.stats["failed"] == 2


# ------------------------------------------------------- degenerate output

def test_degenerate_transliteration_is_detected():
    """
    Sarvam sometimes loops: వచ్చింది (8 chars) came back as 383 characters of
    "Aa aa aa ...". Left alone it breaks two stages at once -- the caption cue
    overflows the frame, and CTC alignment fails because the target character
    count exceeds the audio frames, losing the whole segment's timings.
    """
    from clipper.transliterate import collapse_repeats, is_degenerate

    runaway = " ".join(["Aa"] * 128)
    assert is_degenerate("\u0c35\u0c1a\u0c4d\u0c1a\u0c3f\u0c02\u0c26\u0c3f", runaway)
    assert collapse_repeats(runaway) == "Aa"
    # Normal output must not be flagged -- median real expansion is ~1.0x.
    assert not is_degenerate("\u0c2c\u0c46\u0c38\u0c4d\u0c1f\u0c4d", "Best")
    assert not is_degenerate("\u0c15\u0c28\u0c46\u0c15\u0c4d\u0c1f\u0c3f\u0c35\u0c3f\u0c1f\u0c40", "Connectivity")
    # A short word with a slightly long romanization is fine.
    assert not is_degenerate("\u0c07\u0c02\u0c1f\u0c3f", "Inti House")


def test_overlong_cue_is_split_to_fit_the_frame():
    """
    A single token wider than the frame cannot be fixed by the packing loop,
    which only breaks BETWEEN words. Without an explicit split it renders off
    both edges of the video.
    """
    from clipper.captions import Cue, _split_overlong

    class FakeMeasurer:
        font = object()

        def width(self, text):
            return len(text) * 10.0

    cue = Cue(start=1.0, end=2.0, text="X" * 100)
    out = _split_overlong([cue], FakeMeasurer(), max_px=200.0)

    assert len(out) > 1, "an over-wide single token was left unsplit"
    assert all(len(c.text) * 10.0 <= 200.0 for c in out), "a piece still overflows"
    assert out[0].start == 1.0 and abs(out[-1].end - 2.0) < 1e-6, (
        "splitting must preserve the original time span"
    )
    assert "".join(c.text for c in out) == cue.text, "splitting lost characters"
