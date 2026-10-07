"""
B-roll assembly: what Claude returns is checked before it can cost a render,
and the composition around it always has the shape HyperFrames needs.
"""
from clipper.broll import Design, Moment, assemble, clip_words, sanitize, timed_lines
from clipper.models import ClipPlan, Span, Word


def _moment(i, start, end, layout="cutaway", html=None, animation=None):
    return Moment(id=f"m{i}", start=start, end=end, layout=layout, idea="x",
                  html=html or f'<div id="m{i}-a" style="position:absolute;inset:0"></div>',
                  css=f"#m{i} .a {{ color: red; }}",
                  animation=animation or f'tl.fromTo(el.querySelector("#m{i}-a"), {{opacity:0}}, {{opacity:1, duration:0.4}}, T);')


def test_sanitize_keeps_good_moments_in_order():
    design = Design(moments=[_moment(2, 20, 24), _moment(1, 5, 9)])
    assert [m.id for m in sanitize(design, 40)] == ["m1", "m2"]


def test_sanitize_enforces_pacing():
    design = Design(moments=[
        _moment(1, 0.5, 4),      # covers the hook
        _moment(2, 10, 18),      # too long
        _moment(3, 20, 24),
        _moment(4, 24.5, 28),    # crowds m3
        _moment(5, 37, 39.5),    # runs into the last second
    ])
    assert [m.id for m in sanitize(design, 40)] == ["m3"]


def test_sanitize_rejects_unsafe_or_nondeterministic_code():
    design = Design(moments=[
        _moment(1, 5, 9, html='<img src="https://x.y/a.png">'),
        _moment(2, 12, 16, animation="tl.to(el, {x: Math.random()}, T);"),
        _moment(3, 20, 24, animation="setTimeout(() => {}, 10);"),
        _moment(4, 28, 32, layout="fullscreen"),
        _moment(5, 34, 37),
    ])
    assert [m.id for m in sanitize(design, 40)] == ["m5"]


def test_assemble_builds_one_timed_composition(tmp_path):
    moments = [_moment(1, 5, 9), _moment(2, 14, 18, layout="split")]
    html = assemble(moments, tmp_path, duration=40.0, fps=25).read_text(encoding="utf-8")
    assert 'data-composition-id="broll"' in html and 'window.__timelines["broll"]' in html
    assert 'data-duration="40.000"' in html and 'data-fps="25"' in html
    assert html.count('class="moment clip"') == 2
    assert 'id="m2" data-start="14.000" data-duration="4.000"' in html
    # A split moves the speaker with a transform, never top/height
    assert 'tl.fromTo("#video-wrap", { y: 0 }' in html
    assert "top: 960" not in html
    # Each moment runs isolated, so one broken animation cannot stop the rest
    assert html.count("try { (function (tl, T, D, el, gsap, rand)") == 2


def test_clip_words_are_in_assembled_time():
    a = Span(start_word_i=0, end_word_i=1, role="hook", source_start=100.0, source_end=110.0)
    a.playback_start = 0.0
    b = Span(start_word_i=2, end_word_i=3, role="body", source_start=200.0, source_end=210.0)
    b.playback_start = 9.75
    plan = ClipPlan(id="p", format="f", theme="t", spans=[a, b], hook_score=1,
                    coherence_score=1, standalone_score=1, reason="r", suggested_title="t")
    words = [Word(i=0, text="ఒకటి", start=101.0, end=101.5, roman="okati"),
             Word(i=1, text="x", start=150.0, end=150.5),                # outside both spans
             Word(i=2, text="two", start=202.0, end=202.5),
             Word(i=3, text="yes", start=203.0, end=203.2, overlap=True)]  # someone else
    timed = clip_words(plan, words)
    assert [(round(s, 2), w.text) for s, _, w in timed] == [(1.0, "ఒకటి"), (11.75, "two")]
    assert timed_lines(timed).splitlines()[0] == "[1.00-1.50] okati | ఒకటి"


def test_split_only_where_one_person_fills_the_frame():
    from clipper.broll import solo_windows
    from clipper.reframe.path import FramePlan, Run

    span = Span(start_word_i=0, end_word_i=1, role="hook", source_start=0.0, source_end=40.0)
    span.playback_start = 0.0
    plan = ClipPlan(id="p", format="f", theme="t", spans=[span], hook_score=1,
                    coherence_score=1, standalone_score=1, reason="r", suggested_title="t")
    fp = FramePlan(fps=25, crop_w=405, crop_h=720, source_w=1280, source_h=720)
    fp.runs = [Run(0, 12, "single"), Run(12, 25, "split"), Run(25, 40, "single")]
    solo = solo_windows(plan, [fp])
    assert solo == [(0, 12), (25, 40)]
    design = Design(moments=[_moment(1, 5, 9, layout="split"),     # one person: kept
                             _moment(2, 14, 18, layout="split"),    # stacked shot: dropped
                             _moment(3, 28, 32, layout="cutaway")])
    assert [m.id for m in sanitize(design, 40, solo)] == ["m1", "m3"]
    assert [m.id for m in sanitize(design, 40, [])] == ["m3"]
