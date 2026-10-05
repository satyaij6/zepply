"""
Speech over another speaker's turn: kept in the transcript, out of captions,
and never allowed to invent a pause.

Measured on a two-person podcast: 15 of Sarvam's diarized entries were a
listener speaking INSIDE the host's segment -- every one entirely contained,
and some real content ("they give an accelerator") rather than "hmm". Grouped
by segment, the aligned words then ran host words to 602s, the interjection
back at 579s, then the next segment; the prefilter read 579.7 -> 602.8 as a
23-second pause where the host was talking continuously.

The rule is overlap with a DIFFERENT speaker, not duration: what makes a
segment unrenderable is that it is simultaneous, not that it is short.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.models import Word
from clipper.prefilter import boundaries
from clipper.transcribe import order_words, simultaneous


# ------------------------------------------------------------- the rule

def test_an_interjection_inside_another_speakers_turn_is_simultaneous():
    segs = [(572.8, 602.8, "host", "1"), (579.37, 579.69, "yes", "2")]
    assert simultaneous(segs) == [False, True]


def test_a_long_contained_phrase_is_still_simultaneous():
    """Your point: real content running past any length cutoff is still flagged."""
    segs = [(1124.1, 1154.1, "host", "1"),
            (1140.0, 1143.5, "they give an accelerator", "2")]   # 3.5s
    assert simultaneous(segs) == [False, True]


def test_same_speaker_overlap_is_not_simultaneous():
    segs = [(0.0, 30.0, "a", "1"), (10.0, 12.0, "b", "1")]
    assert simultaneous(segs) == [False, False]


def test_a_brief_edge_overlap_at_a_turn_change_is_not_simultaneous():
    """Normal turn-taking clips a word at the seam; neither turn is lost."""
    segs = [(0.0, 10.0, "a", "1"), (9.7, 20.0, "b", "2")]
    assert simultaneous(segs) == [False, False]


def test_coverage_from_several_other_segments_adds_up():
    segs = [(0.0, 4.0, "mine", "1"), (0.0, 1.5, "x", "2"), (1.5, 3.0, "y", "3")]
    assert simultaneous(segs)[0] is True     # 3.0 of 4.0 covered


# ------------------------------------------------------------- ordering

def w(i, start, end, text="w"):
    return Word(i=i, text=text, start=start, end=end, roman=text)


def the_measured_shape():
    """Host segment, the listener's 'yes' inside it, then the next segment."""
    host = [w(0, 578.0, 578.5), w(1, 578.6, 579.2), w(2, 579.5, 580.0),
            w(3, 601.9, 602.8)]
    yes = [w(4, 579.37, 579.69, "yes")]
    nxt = [w(5, 602.9, 603.4), w(6, 603.5, 604.0)]
    per_segment = [["h"] * 4, ["yes"], ["n"] * 2]
    return host + yes + nxt, per_segment, [False, True, False]


def test_segment_grouped_order_creates_a_fake_pause():
    """The bug, reproduced: this is what the prefilter used to see."""
    words, _, _ = the_measured_shape()
    gaps = [b.start - a.end for a, b in zip(words, words[1:])]
    assert max(gaps) > 20.0          # 579.69 -> 602.9


def test_time_order_removes_the_fake_pause():
    words, per_segment, overlapped = the_measured_shape()
    ordered = order_words(words, per_segment, overlapped)
    gaps = [b.start - a.end for a, b in zip(ordered, ordered[1:])]
    # The only gap left over a second is the host's own (580.0 -> 601.9).
    assert all(g < 22.0 for g in gaps)
    assert [x.start for x in ordered] == sorted(x.start for x in ordered)


def test_prefilter_no_longer_opens_a_window_on_the_invented_pause():
    words, per_segment, overlapped = the_measured_shape()
    before = boundaries(words, pause_gap=0.6)
    after = boundaries(order_words(words, per_segment, overlapped), pause_gap=0.6)
    # Before: a boundary at the next segment's first word, from a 23s gap that
    # never happened. After: boundaries only where the audio actually paused.
    assert 5 in before
    ordered = order_words(words, per_segment, overlapped)
    assert all(ordered[i].start - ordered[i - 1].end > 0.6
               for i in after if 0 < i < len(ordered))


def test_indices_are_rewritten_to_match_the_new_order():
    words, per_segment, overlapped = the_measured_shape()
    ordered = order_words(words, per_segment, overlapped)
    assert [x.i for x in ordered] == list(range(len(ordered)))


def test_only_the_simultaneous_segments_words_are_flagged():
    words, per_segment, overlapped = the_measured_shape()
    ordered = order_words(words, per_segment, overlapped)
    assert [x.text for x in ordered if x.overlap] == ["yes"]


def test_nothing_is_dropped():
    words, per_segment, overlapped = the_measured_shape()
    assert len(order_words(words, per_segment, overlapped)) == len(words)


# ------------------------------------------------------------- captions

def test_captions_leave_simultaneous_words_out():
    from clipper.captions import build_cues
    from clipper.config import Settings

    words, per_segment, overlapped = the_measured_shape()
    ordered = order_words(words, per_segment, overlapped)
    cues = build_cues(ordered, 570.0, 610.0,
                      Settings(style_preset="roman"), font_size=64)
    assert "yes" not in " ".join(c.text for c in cues)


# ------------------------------------------------------------- persistence

def test_the_flag_survives_a_round_trip():
    word = Word(i=0, text="avunu", start=1.0, end=1.3, roman="avunu", overlap=True)
    assert Word.from_dict(word.to_dict()).overlap is True


def test_transcripts_written_before_the_flag_still_load():
    old = {"i": 0, "text": "a", "start": 0.0, "end": 1.0, "roman": "a"}
    assert Word.from_dict(old).overlap is False
