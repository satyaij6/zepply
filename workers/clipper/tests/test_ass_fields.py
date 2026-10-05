"""
The Events format must declare exactly as many columns as a Dialogue supplies.

ASS splits a Dialogue line on commas up to the number of declared fields and
treats the remainder as Text. The standard Events format is:

    Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text

Omitting `Name` declares nine columns while every Dialogue line still carries
ten values, so libass folds Effect into Text -- and the comma that separated
them is drawn as literal text. Every caption this tool burned came out as
",Heroes Kodukule Heroes" instead of "Heroes Kodukule Heroes", visible in the
render and in screenshots, for as long as the header was wrong.

A renderer never complains about this: the line parses, the timing is right,
the styling is right, and one stray glyph appears at the head of every cue.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.captions import Cue, write_ass
from clipper.config import Settings

EXPECTED = ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR",
            "MarginV", "Effect", "Text"]


def written(tmp_path: Path, **kw) -> str:
    cues = [Cue(start=0.0, end=1.0, text="Heroes Kodukule Heroes")]
    dest = write_ass(cues, tmp_path / "c.ass", Settings(**kw), font_size=64)
    return dest.read_text(encoding="utf-8")


def format_columns(body: str) -> list[str]:
    line = next(l for l in body.splitlines() if l.startswith("Format: Layer"))
    return [c.strip() for c in line.split(":", 1)[1].split(",")]


def test_the_events_format_lists_every_column():
    body = written(Path("."), style_preset="roman")
    assert format_columns(body) == EXPECTED


def test_a_dialogue_supplies_exactly_the_declared_number_of_values(tmp_path):
    body = written(tmp_path, style_preset="roman")
    columns = len(format_columns(body))
    line = next(l for l in body.splitlines() if l.startswith("Dialogue:"))
    values = line.split(":", 1)[1].split(",", columns - 1)
    assert len(values) == columns


def test_the_text_field_is_not_prefixed_with_a_stray_comma(tmp_path):
    """The symptom, asserted directly: what a viewer actually reads."""
    body = written(tmp_path, style_preset="roman")
    columns = len(format_columns(body))
    for line in body.splitlines():
        if not line.startswith("Dialogue:"):
            continue
        text = line.split(":", 1)[1].split(",", columns - 1)[-1]
        # Strip any override block; what remains is what the viewer sees.
        while text.startswith("{") and "}" in text:
            text = text.split("}", 1)[1]
        assert not text.startswith(","), f"caption starts with a comma: {text!r}"
        assert text.startswith("Heroes"), text


@pytest.mark.parametrize("style", ["clean", "roman", "tiktok"])
def test_no_style_reintroduces_the_comma(tmp_path, style):
    body = written(tmp_path / style, style_preset=style)
    assert format_columns(body) == EXPECTED


# ------------------------------------------------------------- box colour

def test_a_caption_box_is_drawn_in_the_styles_box_colour(tmp_path):
    """
    libass fills a BorderStyle 3 plate with OutlineColour, not BackColour.

    Measured with Outline red and Back green: the box came out red. Writing the
    box colour to BackColour alone left every box the solid outline colour, so
    a style asking for a see-through dark plate got an opaque black one.
    Rendered, not string-matched, because the bug was in what the field means.
    """
    import shutil
    import subprocess

    from PIL import Image

    from clipper.config import ASSETS_DIR

    if shutil.which("ffmpeg") is None:
        pytest.skip("ffmpeg not on PATH")

    settings = Settings(style_preset="headline")
    cap = settings.layout_style.captions
    assert cap["box"] and cap["box_opacity"] < 1.0

    cues = [Cue(start=0.0, end=2.0, text="Okati")]
    ass = write_ass(cues, tmp_path / "c.ass", settings, font_size=64)
    fonts = tmp_path / "fonts"
    fonts.mkdir()
    shutil.copy(ASSETS_DIR / cap["font"], fonts)
    png = tmp_path / "f.png"
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
         f"color=c=0x808080:s={settings.out_width}x{settings.out_height}:d=2",
         "-vf", f"ass={ass.name}:fontsdir=fonts", "-ss", "1", "-frames:v", "1",
         png.name],
        cwd=tmp_path, check=True)

    grey = 0x80
    expected = round(grey * (1.0 - cap["box_opacity"]))   # black plate over grey
    pixels = list(Image.open(png).convert("L").getdata())
    plate = sum(1 for p in pixels if abs(p - expected) <= 4)
    solid = sum(1 for p in pixels if p <= 4)
    assert plate > 2000, f"no {expected}-grey plate: box_opacity was not applied"
    assert solid < plate / 10, "the plate rendered as solid outline colour"
