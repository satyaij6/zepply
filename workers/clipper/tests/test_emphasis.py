"""
Punch-ins: chosen from loud words, kept off seams and splits, rendered as a
frame-exact zoom.
"""
import wave

import numpy as np

from clipper.config import Settings
from clipper.emphasis import Punch, choose, zoom_chain
from clipper.models import ClipPlan, Join, Span, Word
from clipper.reframe.path import FramePlan, Run

RATE = 16000


def _audio(tmp_path, loud_at: list[float], seconds: float = 60.0):
    """Quiet tone with loud bursts at the given times."""
    t = np.arange(int(seconds * RATE)) / RATE
    amp = np.full_like(t, 0.05)
    for at in loud_at:
        amp[(t >= at) & (t < at + 0.4)] = 0.6
    data = (amp * np.sin(2 * np.pi * 220 * t) * 32767).astype("<i2")
    path = tmp_path / "audio.wav"
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        wf.writeframes(data.tobytes())
    return path


def _words(seconds: float = 60.0):
    # One 0.4s word every 0.5s, so every loud burst lands on one word.
    return [Word(i=i, text=f"word{i}", start=i * 0.5, end=i * 0.5 + 0.4)
            for i in range(int(seconds / 0.5))]


def _plan(spans, joins=()):
    plan = ClipPlan(id="p01", format="single_take", theme="t", spans=spans,
                    hook_score=8, coherence_score=8, standalone_score=8,
                    reason="r", suggested_title="t", joins=list(joins))
    return plan


def _span(a, b, playback_start=0.0):
    s = Span(start_word_i=0, end_word_i=1, role="hook", source_start=a, source_end=b)
    s.playback_start = playback_start
    s.playback_end = playback_start + (b - a)
    return s


def test_loud_words_become_punches_spaced_apart(tmp_path):
    audio = _audio(tmp_path, [10.0, 12.0, 30.0, 45.0])
    punches = choose(_plan([_span(0, 60)]), _words(), audio, Settings())
    starts = [round(p.start) for p in punches]
    # 12.0 is inside the minimum gap after 10.0, so only one of that pair.
    assert len(punches) == 3
    assert starts[1:] == [30, 45]
    assert all(b.start - a.start >= Settings().punch_min_gap for a, b in zip(punches, punches[1:]))


def test_no_punches_when_switched_off(tmp_path):
    audio = _audio(tmp_path, [10.0, 30.0])
    s = Settings()
    s.punch_ins = False
    assert choose(_plan([_span(0, 60)]), _words(), audio, s) == []


def test_no_punch_on_a_split_run(tmp_path):
    audio = _audio(tmp_path, [10.0, 30.0])
    fp = FramePlan(fps=25, crop_w=405, crop_h=720, source_w=1280, source_h=720)
    fp.runs = [Run(0, 20, "split"), Run(20, 60, "single")]
    punches = choose(_plan([_span(0, 60)]), _words(), audio, Settings(), frame_plans=[fp])
    assert [round(p.start) for p in punches] == [30]


def test_no_punch_across_a_join(tmp_path):
    audio = _audio(tmp_path, [10.0, 30.0])
    a, b = _span(0, 20, 0.0), _span(25, 60, 19.75)
    plan = _plan([a, b], [Join("fade", 0.25)])
    # Source 25.0 plays at 19.75; a loud word right at the seam must be skipped.
    audio = _audio(tmp_path, [25.0, 45.0])
    punches = choose(plan, _words(), audio, Settings())
    assert all(not (19.0 < p.start < 20.5) for p in punches)


def test_zoom_chain_is_empty_without_punches():
    assert zoom_chain([], Settings(), 25) == ""


def test_zoom_chain_keeps_output_size_and_timing():
    chain = zoom_chain([Punch(2.0, 3.5, "x")], Settings(), 25)
    assert chain.startswith("zoompan=")
    assert ":d=1:" in chain                       # one frame out per frame in
    assert f"s={Settings().video_w}x{Settings().video_h}" in chain
    assert "between((on/25),2.000,3.500)" in chain
