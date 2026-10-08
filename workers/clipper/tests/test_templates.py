"""
The template pieces: creator caption modes, the "Comment for link" reel layer,
and the analysis bundle that makes restyling possible.
"""
import json
import re

import pytest

from clipper import bundle, reel
from clipper.config import Paths, Settings
from clipper.kinetic import ANCHORS, CARD_ANCHOR, H, LINE_MODES, build_lines
from clipper.models import ClipPlan, Span, Word


def _plan(duration=20.0):
    s = Span(start_word_i=0, end_word_i=1, role="hook", source_start=10.0, source_end=10.0 + duration)
    s.playback_start = 0.0
    return ClipPlan(id="p", format="f", theme="pricing", spans=[s], hook_score=1, coherence_score=1,
                    standalone_score=1, reason="r", suggested_title="Why I doubled my price")


WORDS = [Word(i=k, text=t, start=10.0 + k * 0.4, end=10.0 + k * 0.4 + 0.3, roman=t)
         for k, t in enumerate("i was scared to double the price but every customer stayed".split())]


@pytest.mark.parametrize("mode", LINE_MODES)
def test_every_mode_builds_a_deterministic_layer(mode):
    a = build_lines(_plan(), WORDS, Settings(), mode=mode, audio=None)
    b = build_lines(_plan(), WORDS, Settings(), mode=mode, audio=None)
    assert a is not None and a.html == b.html and a.js == b.js
    assert a.summary["mode"] == mode and a.summary["beats"] >= 2
    assert not re.search(r"Math\.random|Date\.|setTimeout", a.js)
    # every beat both appears and leaves
    assert a.js.count("opacity:0, duration:0.08") >= a.summary["beats"]


def test_caps_uppercases_and_karaoke_lights_one_word_at_a_time():
    caps = build_lines(_plan(), WORDS, Settings(), mode="caps", audio=None)
    assert ">SCARED<" in caps.html and ">scared<" not in caps.html
    kar = build_lines(_plan(), WORDS, Settings(), mode="karaoke", audio=None)
    assert kar.html.count('class="bx"') == len(WORDS)       # a box behind every word
    assert 'color:"#111111"' in kar.js                       # the lit word turns dark on white


def test_caption_position_and_card_anchor():
    s = Settings()
    s.caption_pos = "top"
    top = build_lines(_plan(), WORDS, s, mode="pill", audio=None)
    assert f"bottom:{H - ANCHORS['top']}px" in top.html
    card = build_lines(_plan(), WORDS, Settings(), mode="pill", audio=None, anchor_y=CARD_ANCHOR)
    assert f"bottom:{H - CARD_ANCHOR}px" in card.html


def test_unknown_mode_is_refused():
    with pytest.raises(ValueError):
        build_lines(_plan(), WORDS, Settings(), mode="sparkles", audio=None)


def test_canvas_is_the_brand_hue_darkened():
    canvas, ink = reel.canvas_from("#3888F0")
    r, g, b = (int(canvas[i:i + 2], 16) for i in (1, 3, 5))
    assert b > r and max(r, g, b) < 90           # still blue, but dark enough for cream type
    assert ink == "#F3E7CF"
    assert reel.canvas_from(None)[0].startswith("#")


def test_reel_layer_has_sections_then_the_end_card():
    layer = reel.layer(30.0, card=True, sections=[(0.0, "THE OFFER", "FREE FOR 12 MONTHS"),
                                                  (12.0, "HOW", "SIGN IN & APPLY")],
                       keyword="claude", accent="#3888F0", canvas="#20123A", ink="#F3E7CF")
    assert layer.summary == {"sections": 2, "end_card": True}
    assert "FREE FOR 12 MONTHS" in layer.html and "&ldquo;CLAUDE&rdquo;" in layer.html
    end = float(re.search(r'tl\.fromTo\("#rend".*?\}, ([\d.]+)\);', layer.js).group(1))
    assert end == pytest.approx(30.0 - 3.2)
    # the last section steps aside before the end card arrives
    leaves = [float(t) for t in re.findall(r'tl\.to\("#rp1", \{opacity:0.*?\}, ([\d.]+)\);', layer.js)]
    assert leaves and leaves[0] <= end
    assert reel.layer(30.0, card=False, sections=[], keyword=None, accent="#000000",
                      canvas="#000000", ink="#FFFFFF") is None


def test_panels_fall_back_to_the_cover_text_without_claude(tmp_path):
    s = Settings()
    s.anthropic_api_key = ""
    out = reel.plan_panels(_plan(), WORDS * 2, s, fallback="Why I doubled my price", cache_dir=tmp_path)
    assert out == [(0.0, "", "WHY I DOUBLED MY PRICE")]


def test_bundle_round_trip_restores_the_analysis(tmp_path, monkeypatch):
    monkeypatch.setattr(bundle, "CACHE_DIR", tmp_path / "cache")
    src = Paths(name="clips", root=tmp_path / "run")
    src.ensure()
    src.meta.write_text(json.dumps({"audio_sha256": "abc"}), encoding="utf-8")
    for name in ("transcript.json", "ranked.json", "faces.json", "proxy.mp4"):
        (src.work / name).write_text(name, encoding="utf-8")
    (src.work / "postkit.json").write_text(json.dumps({"kit": {
        "clips": {"1": {"titles": ["a"]}, "2": {"titles": ["b"]}}, "source": {"titles": ["s"]}}}),
        encoding="utf-8")
    (src.work / "panels_123.json").write_text("{}", encoding="utf-8")
    (tmp_path / "cache").mkdir()
    (tmp_path / "cache" / "abc.json").write_text('{"turns": 1}', encoding="utf-8")
    archive = bundle.make(src, tmp_path / "bundle.tar.gz")

    dst = Paths(name="clips", root=tmp_path / "restyle")
    bundle.unpack(archive, dst, audio_sha256="new-sha")
    for name in ("transcript.json", "ranked.json", "faces.json", "proxy.mp4", "panels_123.json"):
        assert (dst.work / name).exists()
    assert (tmp_path / "cache" / "new-sha.json").read_text(encoding="utf-8") == '{"turns": 1}'
    kit = bundle.kit_for_rank(dst, 2)
    assert kit == {"clips": {"1": {"titles": ["b"]}}, "source": {"titles": ["s"]}}
