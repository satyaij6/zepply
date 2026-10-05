"""
Every shipped style must pair its script with a font that can draw it.

`script` is the part of a caption style that is not cosmetic. "telugu" burns
the ASR's own text; "roman" burns the transliteration. Transliteration happens
either way -- the forced aligner's label set is Roman, so word timings cannot
exist without it -- which makes Telugu captions free rather than a trade.

The trap is the pairing. Of the families here only Peddana (93/128) and Noto
Sans Telugu (100/128) carry the Telugu block. GFS Didot, Roboto, TikTok Sans
and Zalando Sans Expanded carry NONE of it, so pairing one with script="telugu"
renders every caption as .notdef boxes -- a clip of tofu that looks correct in
every log and fails only when somebody watches it.

These run over whatever is in styles/, so a style added later is covered
without touching this file.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper import styles
from clipper.config import ASSETS_DIR

TELUGU_BLOCK = range(0x0C00, 0x0C80)
LATIN = range(0x41, 0x5B)

SHIPPED = sorted(styles.available())


def covered(font_path: Path, codes) -> int:
    from fontTools.ttLib import TTFont

    font = TTFont(str(font_path), fontNumber=0, lazy=True)
    cmap: set[int] = set()
    for table in font["cmap"].tables:
        cmap |= set(table.cmap.keys())
    font.close()
    return sum(1 for c in codes if c in cmap)


@pytest.mark.parametrize("name", SHIPPED)
def test_every_shipped_style_loads(name):
    styles.get(name)


@pytest.mark.parametrize("name", SHIPPED)
def test_caption_font_exists(name):
    style = styles.get(name)
    assert (ASSETS_DIR / style.captions["font"]).exists(), (
        f"{name}: {style.captions['font']} is not in assets/")


@pytest.mark.parametrize("name", SHIPPED)
def test_caption_font_can_draw_its_script(name):
    style = styles.get(name)
    path = ASSETS_DIR / style.captions["font"]
    assert covered(path, LATIN) == len(LATIN), f"{name}: cannot draw Latin"
    if style.captions["script"] == "telugu":
        got = covered(path, TELUGU_BLOCK)
        assert got > 80, (
            f"{name} burns Telugu but {style.captions['font']} covers only "
            f"{got}/128 of the block -- captions would render as boxes")


@pytest.mark.parametrize("name", SHIPPED)
def test_headline_font_exists_when_enabled(name):
    style = styles.get(name)
    if style.headline["enabled"]:
        assert (ASSETS_DIR / style.headline["font"]).exists()


def test_a_latin_only_font_is_never_paired_with_telugu():
    """Asserted across the whole directory, not just the styles shipped today."""
    for name in SHIPPED:
        style = styles.get(name)
        path = ASSETS_DIR / style.captions["font"]
        if covered(path, TELUGU_BLOCK) == 0:
            assert style.captions["script"] == "roman", (
                f"{name}: {style.captions['font']} has no Telugu glyphs and "
                f"must not declare script = \"telugu\"")


def test_at_least_one_telugu_and_one_roman_style_ship():
    scripts = {styles.get(n).captions["script"] for n in SHIPPED}
    assert {"telugu", "roman"} <= scripts, scripts
