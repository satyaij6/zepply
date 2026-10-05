"""
Does the caption render path actually shape Telugu, or does it break clusters?

Naive burn-in decomposes conjuncts: instead of the single ligature క్ష you get
క + a visible virama + ష, or worse, dotted-circle placeholders. It still looks
like "text" in a thumbnail, so it is easy to ship five broken clips without
noticing.

The check needs no golden image and no human eye. A correctly shaped conjunct
is ONE ligature and is therefore markedly NARROWER than the same consonants
rendered separately. If shaping fails, the conjunct renders as two or three
glyphs plus a virama mark and comes out WIDER. Measuring ink width tells the
two apart unambiguously.

Run:  python -m pytest tests/test_telugu_shaping.py -v
      python tests/test_telugu_shaping.py          (standalone, no pytest)
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "assets" / "NotoSansTelugu-Regular.ttf"
FONT_FAMILY = "Noto Sans Telugu"

W, H = 1400, 400
FONT_SIZE = 120

# ka + virama + ssa -> the single ligature క్ష ("ksha").
CONJUNCT = "\u0c15\u0c4d\u0c37"
# The same two consonants with NO virama: two independent glyphs, always wider.
SEPARATE = "\u0c15\u0c37"

# Conjuncts that must each collapse into a cluster rather than spraying marks.
CLUSTERS = {
    "ksha": "\u0c15\u0c4d\u0c37",
    "stra": "\u0c38\u0c4d\u0c24\u0c4d\u0c30",
    "dda": "\u0c26\u0c4d\u0c26",
    "jnya": "\u0c1c\u0c4d\u0c1e",
    "ntra": "\u0c02\u0c24\u0c4d\u0c30",
}

# Real code-mixed caption line: Telugu script + Roman English in one cue.
CODE_MIXED = "\u0c08 flat price \u0c0e\u0c02\u0c24?"

ASS_TEMPLATE = """[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Def,{family},{size},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,10,10,10,1

[Events]
Format: Layer, Start, End, Style, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:10.00,Def,,0,0,0,,{text}
"""


# ------------------------------------------------------------------ preflight

def _ffmpeg_has_libass() -> bool:
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True
    ).stdout
    return any(line.split()[1:2] == ["ass"] for line in out.splitlines() if line.strip())


def require_render_stack() -> None:
    """Fail loudly and specifically -- a broken render stack must never be a skip."""
    if shutil.which("ffmpeg") is None:
        pytest.fail("ffmpeg not on PATH; captions cannot be burned at all.")
    if not _ffmpeg_has_libass():
        pytest.fail(
            "This ffmpeg has no 'ass' filter (built without --enable-libass).\n"
            "Telugu captions WILL render incorrectly. Install an ffmpeg built with "
            "libass + libharfbuzz + libfribidi."
        )
    if not FONT.exists():
        pytest.fail(
            f"Missing pinned font: {FONT}\n"
            "Download Noto Sans Telugu into assets/ (see SETUP.md). The font is "
            "pinned deliberately -- fontconfig name lookup is unreliable on Windows "
            "and silently falls back to a font with no Telugu coverage."
        )


# ------------------------------------------------------------------ rendering

def render(text: str, workdir: Path, shaping: str = "complex") -> Image.Image:
    """
    Burn `text` through the real ffmpeg+libass path and return the frame.

    ffmpeg is invoked with cwd=workdir and bare relative filenames on purpose:
    the subtitles/ass filter treats ':' as an argument separator, so a Windows
    absolute path like C:\\... breaks the filtergraph. Staying relative sidesteps
    the whole escaping problem instead of fighting it.

    `shaping` is libass's shaper: "complex" runs HarfBuzz (correct for Indic),
    "simple" bypasses it. Production must always use complex; "simple" exists
    here only as the negative control that proves this suite can fail.
    """
    fonts = workdir / "fonts"
    fonts.mkdir(exist_ok=True)
    if not (fonts / FONT.name).exists():
        shutil.copy(FONT, fonts / FONT.name)

    ass = workdir / "sub.ass"
    ass.write_text(
        ASS_TEMPLATE.format(w=W, h=H, family=FONT_FAMILY, size=FONT_SIZE, text=text),
        encoding="utf-8",
    )

    out = workdir / "frame.png"
    out.unlink(missing_ok=True)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:d=1",
        "-vf", f"ass=sub.ass:fontsdir=fonts:shaping={shaping}",
        "-frames:v", "1", "frame.png",
    ]
    proc = subprocess.run(cmd, cwd=workdir, capture_output=True, text=True)
    if proc.returncode != 0 or not out.exists():
        raise AssertionError(f"ffmpeg render failed:\n{proc.stderr}")
    return Image.open(out).convert("L")


def ink_bbox(img: Image.Image):
    """Bounding box of drawn pixels on the black backdrop."""
    return img.point(lambda p: 255 if p > 40 else 0).getbbox()


def ink_width(text: str, workdir: Path, shaping: str = "complex") -> int:
    box = ink_bbox(render(text, workdir, shaping))
    if box is None:
        raise AssertionError(
            f"Nothing rendered for {text!r} (U+{' U+'.join(f'{ord(c):04X}' for c in text)}). "
            "The font has no coverage for these codepoints, or libass silently "
            "substituted a font that doesn't."
        )
    return box[2] - box[0]


@pytest.fixture(scope="module")
def workdir():
    require_render_stack()
    with tempfile.TemporaryDirectory() as tmp:
        yield Path(tmp)


# --------------------------------------------------------------------- tests

def test_conjunct_forms_a_ligature(workdir):
    """క్ష must shape into one cluster, not ka + virama + ssa side by side."""
    conjunct = ink_width(CONJUNCT, workdir)
    separate = ink_width(SEPARATE, workdir)
    ratio = conjunct / separate
    assert ratio < 0.85, (
        f"TELUGU SHAPING IS BROKEN.\n"
        f"  క్ష (conjunct, should be ONE ligature): {conjunct}px\n"
        f"  కష (two separate consonants):          {separate}px\n"
        f"  ratio {ratio:.2f} -- expected < 0.85\n"
        f"A conjunct at least as wide as the separate pair means the virama did "
        f"not combine the consonants: libass is rendering decomposed glyphs or "
        f"dotted-circle placeholders. Captions burned in this state are wrong."
    )


@pytest.mark.parametrize("name,text", sorted(CLUSTERS.items()))
def test_each_cluster_renders(name, text, workdir):
    """Every conjunct must put ink on screen -- no tofu, no empty frame."""
    width = ink_width(text, workdir)
    assert width > FONT_SIZE * 0.25, (
        f"Cluster {name} ({text!r}) rendered only {width}px wide at "
        f"font size {FONT_SIZE}. Suspiciously narrow -- likely a missing glyph."
    )


def test_code_mixed_line_renders_both_scripts(workdir):
    """A real caption cue mixes Telugu script and Roman English in one line."""
    mixed = ink_width(CODE_MIXED, workdir)
    telugu_only = ink_width("\u0c08 \u0c0e\u0c02\u0c24?", workdir)
    assert mixed > telugu_only, (
        f"Code-mixed line ({mixed}px) is not wider than its Telugu-only subset "
        f"({telugu_only}px). The Roman text 'flat price' did not render -- the "
        f"pinned font may lack Latin coverage and no fallback was applied."
    )


def test_virama_is_not_drawn_as_a_separate_mark(workdir):
    """
    Adding a virama between two consonants must not make the run wider.
    If it does, the virama is being drawn as its own visible glyph, which is
    exactly the decomposed-cluster failure this suite exists to catch.
    """
    with_virama = ink_width(CONJUNCT, workdir)
    without = ink_width(SEPARATE, workdir)
    assert with_virama < without, (
        f"Adding U+0C4D VIRAMA widened the run ({without}px -> {with_virama}px). "
        f"The virama is rendering as a standalone mark instead of joining the "
        f"consonants into a conjunct."
    )


def test_detector_actually_catches_broken_shaping(workdir):
    """
    Guard on the guard. Every assertion above is a width comparison, and a width
    comparison that can never fail is worse than no test at all -- it reports
    green while clips burn garbage.

    libass's "simple" shaper skips HarfBuzz, which is precisely the decomposed-
    cluster failure mode in production. Render the same conjunct through it and
    confirm the ratio check would fire. Measured on this box: 0.54 with complex
    shaping, 1.00 with simple.
    """
    broken_conjunct = ink_width(CONJUNCT, workdir, shaping="simple")
    broken_separate = ink_width(SEPARATE, workdir, shaping="simple")
    broken_ratio = broken_conjunct / broken_separate

    good_ratio = ink_width(CONJUNCT, workdir) / ink_width(SEPARATE, workdir)

    assert broken_ratio >= 0.85, (
        f"NEGATIVE CONTROL FAILED. With HarfBuzz shaping disabled the conjunct "
        f"ratio was {broken_ratio:.2f}, which still passes the < 0.85 check. "
        f"That means test_conjunct_forms_a_ligature cannot detect broken shaping "
        f"and its green result is meaningless."
    )
    assert good_ratio < broken_ratio, (
        f"Correct shaping ({good_ratio:.2f}) did not produce a narrower conjunct "
        f"than broken shaping ({broken_ratio:.2f}); the measurement is not "
        f"discriminating between the two."
    )


# ------------------------------------------------------------------ standalone

if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
