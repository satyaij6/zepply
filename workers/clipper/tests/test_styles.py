"""
Layout presets: geometry, validation, and the guard that style A did not move.

The whole risk of this feature is geometry. When a style insets the video, two
things that used to be canvas-relative stop being so -- the reframe crop's
aspect, and where a caption sits -- and getting either wrong produces a clip
that renders fine and is wrong: captions on the black band, or a shot framed
for an aspect the box does not have.

So the tests here are mostly arithmetic, deliberately: they run without media
and without ffmpeg, which means they run on every change rather than only when
someone has the reference footage.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper import styles
from clipper.captions import Cue, write_ass, Measurer
from clipper.config import ASSETS_DIR, Settings
from clipper.errors import ConfigError
from clipper.styles import Rect, caption_margin_v

W, H = 1080, 1920


def write_style(tmp_path: Path, body: str, name: str = "probe") -> Path:
    path = tmp_path / f"{name}.toml"
    path.write_text(body, encoding="utf-8")
    return path


MINIMAL = """
[canvas]
bg = "#000000"
[video]
mode = "full"
[headline]
enabled = false
[captions]
font = "Peddana-Regular.ttf"
script = "telugu"
size_pct = 0.05
fill = "#FFFFFF"
outline = "#000000"
outline_px = 4
box = false
anchor = "canvas"
pos = "bottom"
inset_pct = 0.12
max_width = 0.86
bold = true
shadow_px = 2
fade_in_ms = 180
fade_out_ms = 60
"""


# ------------------------------------------------------------- the presets

def test_both_shipped_styles_load():
    found = styles.available()
    assert {"clean", "headline"} <= set(found), found
    for name in ("clean", "headline"):
        styles.get(name)


def test_clean_is_full_bleed():
    rect = styles.get("clean").video_rect(W, H)
    assert (rect.x, rect.y, rect.w, rect.h) == (0.0, 0.0, float(W), float(H))


def test_headline_video_is_square_and_centred_horizontally():
    rect = styles.get("headline").video_rect(W, H)
    assert rect.w == float(W)
    assert abs(rect.aspect - 1.0) < 0.01, rect.aspect
    assert rect.bottom <= H


# ------------------------------------------------------------- the margin

def test_margin_is_canvas_relative_for_a_canvas_anchor():
    canvas = Rect(0, 0, W, H)
    assert caption_margin_v(canvas, H, 0.12, "bottom") == int(round(H * 0.12))


def test_margin_is_measured_back_through_an_inset_rect():
    """
    The formula that decides whether a caption lands on the video or the black.

    A 1080x1080 box at y=432 ends at 1512, leaving 408px of canvas beneath it.
    A caption 6% up from the box's own bottom must therefore sit 408 + 64.8
    from the canvas edge -- not 6% of the canvas, which would be 115 and put it
    well below the picture.
    """
    rect = Rect(0, 432, 1080, 1080)
    got = caption_margin_v(rect, H, 0.06, "bottom")
    assert got == int(round(1920 - 1512 + 1080 * 0.06)) == 473
    naive = int(round(H * 0.06))
    assert got != naive


@pytest.mark.parametrize("inset", [0.0, 0.05, 0.2, 0.45])
def test_a_video_anchored_caption_always_sits_inside_the_video(inset):
    style = styles.get("headline")
    rect = style.video_rect(W, H)
    margin = caption_margin_v(rect, H, inset, "bottom")
    # Convert the ASS margin back to a canvas y for the caption's baseline.
    baseline_y = H - margin
    assert rect.top <= baseline_y <= rect.bottom, (
        f"caption baseline {baseline_y} is outside the video {rect}")


# ------------------------------------------------------- caption box in rect

def caption_box(settings: Settings, text: str) -> Rect:
    """Where the caption will actually be drawn, from the ASS we emit."""
    layout = settings.layout_style
    cap = layout.captions
    anchor = layout.caption_anchor(W, H)
    size = int(round(cap["size_pct"] * H))
    measurer = Measurer(ASSETS_DIR / cap["font"], size)
    width = measurer.width(text)
    margin_v = caption_margin_v(anchor, H, cap["inset_pct"], cap["pos"])
    bottom = H - margin_v
    # Box height: the glyph box plus the border the style draws around it.
    height = size * 1.25 + 2 * cap["outline_px"]
    return Rect((W - width) / 2 - cap["outline_px"], bottom - height,
                width + 2 * cap["outline_px"], height)


@pytest.mark.parametrize("text", [
    "ఒక", "నీ కొడుకు అయితే?", "సూసైడ్ అంటే త్యాగం కాదు అహంకారం అని",
])
def test_style_b_caption_box_lies_inside_the_video_rect(text):
    """The requirement: a caption may never be drawn on the black canvas."""
    settings = Settings(style_preset="headline")
    rect = settings.layout_style.video_rect(W, H)
    box = caption_box(settings, text)
    assert rect.contains(box), f"caption {box} escapes the video {rect}"


# ------------------------------------------------------------- the headline

@pytest.mark.parametrize("title", [
    "A",
    "Fear vs Clarity",
    "Money vs Meaning in the film industry today",
    "పొడవైన తెలుగు శీర్షిక ఇది చాలా పొడవుగా ఉంటుంది " * 6,
])
def test_headline_never_overlaps_the_video(title):
    from clipper import headline

    style = styles.get("headline")
    band = style.headline_band(W, H)
    font = ASSETS_DIR / style.headline["font"]
    lines, size = headline.fit(title, style, band, H,
                               lambda px: Measurer(font, px))
    used = len(lines) * size * styles.LINE_SPACING
    assert used <= band.h + 0.5, (
        f"{len(lines)} lines at {size}px need {used:.0f}px, band is {band.h:.0f}")
    assert band.top + used <= style.video_rect(W, H).top + 0.5


def test_a_long_headline_is_shrunk_then_ellipsized():
    from clipper import headline

    style = styles.get("headline")
    band = style.headline_band(W, H)
    font = ASSETS_DIR / style.headline["font"]
    long_title = "Why every single one of these arguments about cinema fails"
    lines, size = headline.fit(long_title, style, band, H,
                               lambda px: Measurer(font, px))
    assert len(lines) <= style.headline["max_lines"]
    assert size >= int(round(style.headline["min_size_pct"] * H))


def test_the_vs_rule_accents_the_flanking_words():
    from clipper.headline import accent_segments

    got = accent_segments("Fear vs Clarity", "vs_flank")
    assert got == [("Fear", True), ("vs", False), ("Clarity", True)]


def test_no_accent_without_vs():
    from clipper.headline import accent_segments

    got = accent_segments("Money and Meaning", "vs_flank")
    assert [a for _, a in got] == [False, False, False]


# ------------------------------------------------------------- validation

def test_an_unknown_style_name_lists_what_exists():
    with pytest.raises(ConfigError) as err:
        styles.get("neon")
    message = str(err.value)
    assert "neon" in message
    assert "clean" in message and "headline" in message


def test_an_unknown_key_names_the_file_and_the_key(tmp_path):
    path = write_style(tmp_path, MINIMAL.replace(
        'fill = "#FFFFFF"', 'fill = "#FFFFFF"\ncolour = "#FF0000"'))
    with pytest.raises(ConfigError) as err:
        styles.load_style(path)
    message = str(err.value)
    assert "probe.toml" in message
    assert "captions.colour" in message
    assert "fill" in message          # the suggestion


def test_a_missing_visual_key_is_an_error_not_a_default(tmp_path):
    path = write_style(tmp_path, MINIMAL.replace('fill = "#FFFFFF"\n', ""))
    with pytest.raises(ConfigError) as err:
        styles.load_style(path)
    assert "captions.fill" in str(err.value)


def test_a_bad_value_names_the_key_and_what_was_wanted(tmp_path):
    path = write_style(tmp_path, MINIMAL.replace('max_width = 0.86',
                                                 'max_width = 4.2'))
    with pytest.raises(ConfigError) as err:
        styles.load_style(path)
    message = str(err.value)
    assert "captions.max_width" in message and "0.0 and 1.0" in message


def test_malformed_toml_is_an_error_not_a_traceback(tmp_path):
    path = write_style(tmp_path, "[canvas\nbg = ")
    with pytest.raises(ConfigError) as err:
        styles.load_style(path)
    assert "probe.toml" in str(err.value)


def test_an_inset_that_leaves_the_canvas_is_refused(tmp_path):
    body = MINIMAL.replace(
        '[video]\nmode = "full"',
        '[video]\nmode = "inset"\nx = 0.5\ny = 0.0\nw = 0.8\nh = 0.5')
    with pytest.raises(ConfigError) as err:
        styles.load_style(write_style(tmp_path, body))
    assert "video.x + video.w" in str(err.value)


def test_a_headline_over_a_full_bleed_video_is_refused(tmp_path):
    body = MINIMAL.replace(
        "[headline]\nenabled = false",
        '[headline]\nenabled = true\nfont = "Anton-Regular.ttf"\n'
        'fallback_font = "Peddana-Regular.ttf"\n'
        'size_pct = 0.05\nfill = "#FFFFFF"\naccent = "#FF0000"\n'
        'accent_rule = "none"\ny_pct = 0.05\nmax_lines = 2\n'
        'min_size_pct = 0.03\nwrap = "word"\nvalign = "top"\ngap_pct = 0.0')
    with pytest.raises(ConfigError) as err:
        styles.load_style(write_style(tmp_path, body))
    assert "video.mode" in str(err.value)


def test_a_band_too_small_for_max_lines_is_refused(tmp_path):
    body = MINIMAL.replace(
        '[video]\nmode = "full"',
        '[video]\nmode = "inset"\nx = 0.0\ny = 0.1\nw = 1.0\nh = 0.5'
    ).replace(
        "[headline]\nenabled = false",
        '[headline]\nenabled = true\nfont = "Anton-Regular.ttf"\n'
        'fallback_font = "Peddana-Regular.ttf"\n'
        'size_pct = 0.05\nfill = "#FFFFFF"\naccent = "#FF0000"\n'
        'accent_rule = "none"\ny_pct = 0.09\nmax_lines = 3\n'
        'min_size_pct = 0.04\nwrap = "word"\nvalign = "top"\ngap_pct = 0.0')
    with pytest.raises(ConfigError) as err:
        styles.load_style(write_style(tmp_path, body))
    assert "headline band" in str(err.value)


# ------------------------------------------------------------- colours

def test_hex_becomes_ass_bgr_with_inverted_alpha():
    assert styles.ass_colour("#FF2020") == "&H0020 20FF".replace(" ", "")
    assert styles.ass_colour("#FFFFFF", 1.0).startswith("&H00")
    assert styles.ass_colour("#FFFFFF", 0.0).startswith("&HFF")


def test_inline_colour_has_no_alpha():
    assert styles.ass_inline_colour("#FF2020") == "&H2020FF&"


# ------------------------------------------------------ headline alignment

def _head_row(style_name: str, title: str) -> list[str]:
    from clipper.captions import _headline_rows

    settings = Settings(style_preset=style_name)
    rows, _ = _headline_rows(title, settings.layout_style, settings,
                             [Cue(0.0, 5.0, "x")])
    # Style: Name,Font,Size,...,Alignment,MarginL,MarginR,MarginV,Encoding
    return rows[0].split(",")


@pytest.mark.parametrize("title", ["Fear vs Clarity",
                                   "I Had Nothing Left to Lose Before the Big Call"])
def test_a_bottom_aligned_headline_stands_on_the_gap_above_the_video(title):
    """
    The reference puts the title just above the picture, one line or two.

    ASS alignment 2 measures MarginV up from the canvas bottom, so the text's
    bottom edge lands at H - MarginV -- which must be the band's bottom, and
    that must be gap_pct clear of the video.
    """
    style = styles.get("headline")
    assert style.headline["valign"] == "bottom"
    fields = _head_row("headline", title)
    align, margin_v = int(fields[-5]), int(fields[-2])
    assert align == 2
    text_bottom = H - margin_v
    video_top = style.video_rect(W, H).top
    gap = style.headline["gap_pct"] * H
    assert abs(text_bottom - (video_top - gap)) <= 1
    assert text_bottom < video_top


def test_a_top_aligned_headline_hangs_from_the_band_top(tmp_path, monkeypatch):
    style = styles.get("headline")
    top = styles.Style(**{**style.__dict__,
                          "headline": {**style.headline, "valign": "top"}})
    from clipper.captions import _headline_rows

    settings = Settings(style_preset="headline")
    rows, _ = _headline_rows("Fear vs Clarity", top, settings, [Cue(0.0, 5.0, "x")])
    fields = rows[0].split(",")
    assert int(fields[-5]) == 8
    assert int(fields[-2]) == int(round(top.headline_band(W, H).top))


def test_an_enabled_headline_without_valign_is_refused(tmp_path):
    from clipper.config import ROOT

    body = (ROOT / "styles" / "headline.toml").read_text(encoding="utf-8")
    body = "\n".join(l for l in body.splitlines() if not l.startswith("valign"))
    with pytest.raises(ConfigError) as err:
        styles.load_style(write_style(tmp_path, body))
    assert "headline.valign" in str(err.value)
