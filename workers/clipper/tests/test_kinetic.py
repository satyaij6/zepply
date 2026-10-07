"""
Kinetic captions: grouping, hero choice, placement around the head, and a
layer that is the same every time it is built.
"""
import re

from clipper.config import Settings
from clipper.kinetic import (
    Beat, H, LOW_LIMIT, SIDE, TOP_SAFE, W, build, choose_heroes, head_at, make_beats, text_width,
)
from clipper.models import ClipPlan, Span, Word
from clipper.reframe.detect import Detections, Face, Sample
from clipper.reframe.path import FramePlan, Run


def _plan(duration=30.0):
    s = Span(start_word_i=0, end_word_i=1, role="hook", source_start=100.0, source_end=100.0 + duration)
    s.playback_start = 0.0
    return ClipPlan(id="p", format="f", theme="t", spans=[s], hook_score=1, coherence_score=1,
                    standalone_score=1, reason="r", suggested_title="t")


def _words(texts, start=100.0, step=0.45):
    return [Word(i=k, text=t, start=start + k * step, end=start + k * step + 0.35, roman=t)
            for k, t in enumerate(texts)]


class _Ctx:
    """A one-person shot: the face sits a little left of centre in the crop."""
    def __init__(self):
        samples = [Sample(t=100.0 + k * 0.2, faces=[Face(x=560, y=150, w=150, h=180, score=0.9)])
                   for k in range(200)]
        self.detections = Detections(width=1280, height=720, fps=25.0, duration=40.0, samples=samples)
        self.proxy_scale = 1.0


def _fp(kind="single"):
    fp = FramePlan(fps=25, crop_w=405, crop_h=720, source_w=1280, source_h=720)
    fp.runs = [Run(0, 40, kind, crop_x=437.5, crop_y=0.0)]
    return fp


SENTENCE = ("so the real problem is distribution not content . nobody wants another "
            "generic video they want something specific").split()


def test_beats_break_on_pauses_full_stops_and_length():
    words = _words(["one", "two", "three", "four", "five", "six."] + ["seven", "eight"])
    timed = [(w.start - 100, w.end - 100, w.text, w.i) for w in words]
    beats = make_beats(timed)
    assert [len(b.words) for b in beats] == [4, 2, 2]
    assert all(b.end > b.start for b in beats)
    assert all(a.end <= b.start for a, b in zip(beats, beats[1:]))


def test_hero_is_a_loud_content_word_and_negation_strikes():
    words = _words(SENTENCE)
    timed = [(w.start - 100, w.end - 100, w.text, w.i) for w in words]
    beats = make_beats(timed)
    energy = {w.i: 1.0 for w in words}
    energy[[w.text for w in words].index("distribution")] = 9.0
    choose_heroes(beats, energy, timed)
    heroes = [(b.words[b.hero][2], b.mark) for b in beats if b.hero is not None]
    assert heroes[0][0] == "distribution"
    assert heroes[0][1] == "strike"           # "... not content" negates the beat
    assert all(h.lower() not in {"the", "so", "is"} for h, _ in heroes)


def test_head_is_mapped_into_the_output_frame():
    head = head_at(5.0, _plan(), [_fp()], _Ctx(), Settings())
    x, y, w, h = head
    assert 0 < x < W and 0 < y < H and w > 300           # a face 150 px wide in a 405 px crop
    assert x < W / 2 < x + w                               # roughly centred
    assert head_at(5.0, _plan(), [_fp("split")], _Ctx(), Settings()) == "none"


def test_layer_places_words_inside_the_safe_frame_and_is_deterministic():
    words = _words(SENTENCE)
    kw = dict(frame_plans=[_fp()], ctx=_Ctx(), audio=None, seed=3)
    a = build(_plan(), words, Settings(), **kw)
    b = build(_plan(), words, Settings(), **kw)
    assert a.html == b.html and a.js == b.js               # nothing decided in the page
    assert a.summary["face"] > 0
    for left, top, size in re.findall(r'left:(-?\d+)px;top:(-?\d+)px;font-size:(\d+)px', a.html):
        left, top, size = int(left), int(top), int(size)
        assert SIDE - 2 <= left <= W - SIDE and TOP_SAFE - 2 <= top <= LOW_LIMIT
    assert not re.search(r"Math\.random|from:\s*\"random\"|Date\.", a.js)


def test_split_shots_and_cutaways_fall_back_to_the_bracket_line():
    words = _words(SENTENCE)
    layer = build(_plan(), words, Settings(), frame_plans=[_fp("split")], ctx=_Ctx(), audio=None)
    assert layer.summary["face"] == 0 and layer.summary["bracket"] > 0
    assert 'class="kw br"' in layer.html and ">{</div>" in layer.html
    cut = build(_plan(), words, Settings(), frame_plans=[_fp()], ctx=_Ctx(), audio=None,
                blocked=[(0.0, 30.0)])
    assert cut.summary["face"] == 0


def test_text_width_grows_with_size_and_length():
    assert text_width("creativity", 100) > text_width("crea", 100)
    assert text_width("creativity", 120) > text_width("creativity", 100)


def test_every_word_finishes_appearing_before_its_beat_exits():
    """A pop still running at exit time would leave the word on screen for good."""
    words = _words(SENTENCE, step=0.2)          # fast speech, no pauses
    for fp in (_fp(), _fp("split")):
        layer = build(_plan(), words, Settings(), frame_plans=[fp], ctx=_Ctx(), audio=None)
        appear = {}
        for el, dur, at in re.findall(r'tl\.fromTo\("#(kb\d+[wb]\d+)".*?duration:([\d.]+).*?\}, ([\d.]+)\);', layer.js):
            appear[el] = float(at) + float(dur)
        exits = {}
        for sel, at in re.findall(r'tl\.to\("([^"]+)", \{opacity:0, duration:[\d.]+\}, ([\d.]+)\);', layer.js):
            for el in re.findall(r"#(kb\d+[wb]\d+)\b", sel):
                exits[el] = float(at)
        assert appear and set(appear) <= set(exits)
        assert all(appear[el] <= exits[el] + 1e-6 for el in appear)
