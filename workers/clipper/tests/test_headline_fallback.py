"""
A headline must be able to draw its own titles, by declaration not by luck.

libass substitutes a missing glyph from whatever else is in the fonts
directory. The first render of the `headline` style drew its Telugu correctly
only because the CAPTION font happened to be staged beside it -- Anton carries
0/128 of the Telugu block. Swap the caption font for a Latin-only face and the
same headline becomes a row of .notdef boxes, with nothing in any log to say
why, because substitution failing is not an error.

So two things are asserted here:

* the PAIR (font + declared fallback) covers every script the titles use, and a
  style whose pair cannot is refused at load rather than at viewing;
* the fallback is actually STAGED next to the render, since a declaration that
  does not reach the fonts directory changes nothing.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper import styles
from clipper.config import ASSETS_DIR, Settings
from clipper.errors import ConfigError
from clipper.styles import LATIN, TELUGU_BLOCK, _covers

INSET_HEADLINE = """
[canvas]
bg = "#000000"
[video]
mode = "inset"
x = 0.0
y = 0.225
w = 1.0
h = 0.5625
[headline]
enabled = true
font = "{font}"
fallback_font = "{fallback}"
size_pct = 0.052
fill = "#FFFFFF"
accent = "#FF2020"
accent_rule = "vs_flank"
y_pct = 0.09
max_lines = 2
min_size_pct = 0.034
wrap = "word"
valign = "top"
gap_pct = 0.0
[captions]
font = "Peddana-Regular.ttf"
script = "{script}"
size_pct = 0.03
fill = "#101010"
outline = "#FFFFFF"
outline_px = 1
box = true
box_color = "#F4F4F4"
box_opacity = 1.0
anchor = "video"
pos = "bottom"
inset_pct = 0.06
max_width = 0.8
bold = true
shadow_px = 2
fade_in_ms = 180
fade_out_ms = 60
"""


def write(tmp_path: Path, *, font, fallback, script="telugu") -> Path:
    path = tmp_path / "probe.toml"
    path.write_text(INSET_HEADLINE.format(font=font, fallback=fallback,
                                          script=script), encoding="utf-8")
    return path


# ------------------------------------------------------------- the premise

def test_anton_really_cannot_draw_telugu():
    """The premise the whole guard rests on, asserted rather than assumed."""
    assert _covers(ASSETS_DIR / "Anton-Regular.ttf", TELUGU_BLOCK) == 0
    assert _covers(ASSETS_DIR / "Anton-Regular.ttf", LATIN) == len(LATIN)


def test_peddana_covers_telugu():
    assert _covers(ASSETS_DIR / "Peddana-Regular.ttf", TELUGU_BLOCK) > 80


# ------------------------------------------------------------- the checks

def test_a_latin_only_pair_is_refused_for_telugu_titles(tmp_path):
    """Anton + Roboto: neither draws Telugu, so the style cannot load."""
    with pytest.raises(ConfigError) as err:
        styles.load_style(write(tmp_path, font="Anton-Regular.ttf",
                                fallback="Roboto-Variable.ttf"))
    message = str(err.value)
    assert "Telugu" in message
    assert "Anton-Regular.ttf" in message and "Roboto-Variable.ttf" in message


def test_a_latin_only_pair_is_fine_for_roman_titles(tmp_path):
    """The same pair is legitimate when the captions are romanised."""
    styles.load_style(write(tmp_path, font="Anton-Regular.ttf",
                            fallback="Roboto-Variable.ttf", script="roman"))


def test_the_declared_pair_is_accepted(tmp_path):
    styles.load_style(write(tmp_path, font="Anton-Regular.ttf",
                            fallback="Peddana-Regular.ttf"))


def test_a_missing_fallback_file_is_named(tmp_path):
    with pytest.raises(ConfigError) as err:
        styles.load_style(write(tmp_path, font="Anton-Regular.ttf",
                                fallback="NotAFont-Regular.ttf"))
    assert "NotAFont-Regular.ttf" in str(err.value)


def test_the_fallback_must_be_declared(tmp_path):
    body = INSET_HEADLINE.format(font="Anton-Regular.ttf",
                                 fallback="Peddana-Regular.ttf",
                                 script="telugu")
    body = body.replace('fallback_font = "Peddana-Regular.ttf"\n', "")
    path = tmp_path / "probe.toml"
    path.write_text(body, encoding="utf-8")
    with pytest.raises(ConfigError) as err:
        styles.load_style(path)
    assert "headline.fallback_font" in str(err.value)


# ------------------------------------------------------------- the staging

def test_both_headline_faces_are_staged(tmp_path):
    """A declaration that never reaches the fonts directory changes nothing."""
    from clipper.cut import _stage_font

    style = styles.get("headline")
    out = tmp_path / "render"
    out.mkdir()
    _stage_font(out, ASSETS_DIR / style.captions["font"])
    _stage_font(out, ASSETS_DIR / style.headline["font"])
    _stage_font(out, ASSETS_DIR / style.headline["fallback_font"])

    staged = {p.name for p in (out / "fonts").iterdir()}
    assert style.headline["font"] in staged
    assert style.headline["fallback_font"] in staged


def test_the_shipped_headline_style_can_draw_its_titles():
    """End to end on the style that actually ships."""
    style = styles.get("headline")
    primary = ASSETS_DIR / style.headline["font"]
    fallback = ASSETS_DIR / style.headline["fallback_font"]
    for codes, name in ((LATIN, "Latin"), (TELUGU_BLOCK, "Telugu")):
        best = max(_covers(primary, codes), _covers(fallback, codes))
        assert best >= len(codes) * styles.COVERAGE_FLOOR, name
