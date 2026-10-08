"""
Presets for layout and caption look, loaded from styles/*.toml.

TOML rather than JSON for one reason that matters here: these files are
hand-authored and every threshold in this project carries a *why*. A style file
without `# the accent only fires on "vs" titles` is one you re-derive in three
months. `tomllib` is stdlib from 3.11, so it also costs no dependency.

**Geometry is the whole point of this module.** A style may inset the video in a
larger canvas, and when it does, two things that used to be canvas-relative stop
being so:

* the reframe crops to the VIDEO RECT's aspect, not the canvas's -- get this
  wrong and the crop is computed for 9:16 while the box is 1:1, so the framing
  is wrong in a way that looks like a tracking bug;
* captions anchored to the video sit inside that rect, and ASS margins are
  measured from the CANVAS edge, so the margin has to be computed back through
  the rect. `caption_margin_v` is that formula, and it is unit-tested on its
  own because it is the one line where "captions on black" comes from.

Nothing visual defaults silently. A missing or unknown key is an error naming
the file and the key: a style that half-loads produces a clip that looks
plausible and is wrong, which is worse than one that refuses to load.
"""
from __future__ import annotations

import difflib
import re
import tomllib
from dataclasses import dataclass
from pathlib import Path

from .errors import ConfigError

STYLES_DIR = Path(__file__).resolve().parent.parent / "styles"

_HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")

# Line advance as a multiple of font size, used both to fit the headline
# and to check at load time that the band can hold max_lines.
LINE_SPACING = 1.2


# ------------------------------------------------------------------ geometry

@dataclass(frozen=True)
class Rect:
    """A box in canvas pixels."""
    x: float
    y: float
    w: float
    h: float

    @property
    def left(self) -> float: return self.x

    @property
    def top(self) -> float: return self.y

    @property
    def right(self) -> float: return self.x + self.w

    @property
    def bottom(self) -> float: return self.y + self.h

    @property
    def aspect(self) -> float: return self.w / self.h if self.h else 0.0

    def contains(self, other: "Rect", slack: float = 0.5) -> bool:
        return (other.left >= self.left - slack
                and other.top >= self.top - slack
                and other.right <= self.right + slack
                and other.bottom <= self.bottom + slack)

    def even(self) -> "Rect":
        """Snap to even pixels -- yuv420p cannot encode odd dimensions."""
        return Rect(float(int(self.x) // 2 * 2), float(int(self.y) // 2 * 2),
                    float(max(2, int(self.w) // 2 * 2)),
                    float(max(2, int(self.h) // 2 * 2)))


# ------------------------------------------------------------------ colours

def ass_colour(hex_rgb: str, alpha: float = 1.0) -> str:
    """
    '#RRGGBB' -> ASS '&HAABBGGRR'.

    ASS stores colours byte-reversed with an INVERTED alpha: 00 is opaque and
    FF is invisible. Writing an RGB hex straight into a style is the classic
    way to get blue captions that were meant to be red.
    """
    if not _HEX.match(hex_rgb):
        raise ConfigError(f"Colour {hex_rgb!r} is not '#RRGGBB'")
    r, g, b = hex_rgb[1:3], hex_rgb[3:5], hex_rgb[5:7]
    aa = int(round((1.0 - max(0.0, min(1.0, alpha))) * 255))
    return f"&H{aa:02X}{b}{g}{r}".upper()


# ------------------------------------------------------------------ schema

def ass_inline_colour(hex_rgb: str) -> str:
    r"""'#RRGGBB' -> ASS inline '&HBBGGRR&' for a \c override."""
    if not _HEX.match(hex_rgb):
        raise ConfigError(f"Colour {hex_rgb!r} is not '#RRGGBB'")
    r, g, b = hex_rgb[1:3], hex_rgb[3:5], hex_rgb[5:7]
    return f"&H{b}{g}{r}&".upper()


def _colour(v):
    if not isinstance(v, str) or not _HEX.match(v):
        raise ValueError("expected a '#RRGGBB' colour")
    return v


def _fraction(v):
    if not isinstance(v, (int, float)) or not 0.0 <= float(v) <= 1.0:
        raise ValueError("expected a number between 0.0 and 1.0")
    return float(v)


def _positive(v):
    if not isinstance(v, (int, float)) or float(v) <= 0:
        raise ValueError("expected a number greater than 0")
    return float(v)


def _positive_or_zero(v):
    if not isinstance(v, (int, float)) or isinstance(v, bool) or float(v) < 0:
        raise ValueError("expected a number of 0 or more")
    return float(v)


def _count(v):
    if not isinstance(v, int) or isinstance(v, bool) or v < 1:
        raise ValueError("expected a whole number of 1 or more")
    return v


def _flag(v):
    if not isinstance(v, bool):
        raise ValueError("expected true or false")
    return v


def _text(v):
    if not isinstance(v, str) or not v:
        raise ValueError("expected a non-empty string")
    return v


def _one_of(*allowed):
    def check(v):
        if v not in allowed:
            raise ValueError(f"expected one of {', '.join(map(repr, allowed))}")
        return v
    return check


# section -> key -> (checker, required). Everything visual is required; a
# silent default is how a style half-applies and nobody notices.
SCHEMA: dict[str, dict[str, tuple]] = {
    "canvas": {
        "bg": (_colour, True),
    },
    "video": {
        "mode": (_one_of("full", "inset"), True),
        "x": (_fraction, False),
        "y": (_fraction, False),
        "w": (_fraction, False),
        "h": (_fraction, False),
    },
    "headline": {
        "enabled": (_flag, True),
        "font": (_text, False),
        "fallback_font": (_text, False),
        "size_pct": (_fraction, False),
        "fill": (_colour, False),
        "accent": (_colour, False),
        "accent_rule": (_one_of("none", "vs_flank"), False),
        "y_pct": (_fraction, False),
        "max_lines": (_count, False),
        "min_size_pct": (_fraction, False),
        "wrap": (_one_of("word", "none"), False),
        # Which edge of the band the text hugs. "bottom" sits the title just
        # above the video whatever its line count -- a one-line title under
        # "top" leaves a line-height of black between it and the picture.
        "valign": (_one_of("top", "bottom"), False),
        # Black kept between the band's bottom and the video's top edge.
        "gap_pct": (_fraction, False),
    },
    "captions": {
        "font": (_text, True),
        "script": (_one_of("telugu", "roman"), True),
        "size_pct": (_fraction, True),
        "fill": (_colour, True),
        "outline": (_colour, True),
        "outline_px": (_positive, True),
        "box": (_flag, True),
        "box_color": (_colour, False),
        "box_opacity": (_fraction, False),
        "anchor": (_one_of("canvas", "video"), True),
        "pos": (_one_of("bottom", "center", "top"), True),
        "inset_pct": (_fraction, True),
        "max_width": (_fraction, True),
        "bold": (_flag, True),
        "shadow_px": (_positive_or_zero, True),
        "fade_in_ms": (_positive_or_zero, True),
        "fade_out_ms": (_positive_or_zero, True),
    },
}

TOP_LEVEL = {"description"}

# Sections a style may leave out, with what leaving them out means. Kinetic
# captions are drawn by the browser over the clip (clipper/kinetic.py); a
# style without the section burns its captions with libass as always.
OPTIONAL = {"kinetic": {"enabled": False}}
SCHEMA["kinetic"] = {
    "enabled": (_flag, True),
    "accent": (_colour, False),            # the pen; the Brand Kit accent overrides it
    "script": (_one_of("telugu", "roman"), False),
    # kinetic = words placed around the head; the others are centred caption
    # lines in the creator styles (see kinetic.build_lines).
    "mode": (_one_of("kinetic", "karaoke", "pill", "emphasis", "caps"), False),
}


# ------------------------------------------------------------------ style

@dataclass(frozen=True)
class Style:
    name: str
    description: str
    canvas: dict
    video: dict
    headline: dict
    captions: dict
    kinetic: dict = None  # type: ignore[assignment]

    @property
    def kinetic_on(self) -> bool:
        return bool(self.kinetic and self.kinetic.get("enabled"))

    # -------------------------------------------------------- geometry
    def video_rect(self, canvas_w: int, canvas_h: int) -> Rect:
        """Where the video is drawn, in canvas pixels."""
        if self.video["mode"] == "full":
            return Rect(0.0, 0.0, float(canvas_w), float(canvas_h))
        return Rect(self.video["x"] * canvas_w, self.video["y"] * canvas_h,
                    self.video["w"] * canvas_w,
                    self.video["h"] * canvas_h).even()

    @property
    def insets(self) -> bool:
        return self.video["mode"] == "inset"

    def headline_band(self, canvas_w: int, canvas_h: int) -> Rect:
        """
        The space a headline may occupy: from its y down to the video's top.

        Handing the fitter a box that ENDS where the video starts is what makes
        overlap unrepresentable rather than merely tested against.
        """
        rect = self.video_rect(canvas_w, canvas_h)
        top = self.headline["y_pct"] * canvas_h
        bottom = rect.top - self.headline["gap_pct"] * canvas_h
        return Rect(0.0, top, float(canvas_w), max(0.0, bottom - top))

    def caption_anchor(self, canvas_w: int, canvas_h: int) -> Rect:
        if self.captions["anchor"] == "video":
            return self.video_rect(canvas_w, canvas_h)
        return Rect(0.0, 0.0, float(canvas_w), float(canvas_h))


def caption_margin_v(anchor: Rect, canvas_h: int, inset_pct: float,
                     pos: str) -> int:
    """
    ASS MarginV for a caption anchored to `anchor`.

    ASS measures MarginV from the CANVAS edge that the alignment names, so a
    caption anchored to an inset video has to be converted back through the
    rect. For a bottom alignment that is the gap below the rect plus the inset
    *within* the rect:

        canvas_h - anchor.bottom + anchor.h * inset_pct

    Using the canvas height directly here is what puts captions on the black
    band below the video, which is why this is a function with its own test
    rather than an expression inside the ASS header.
    """
    if pos == "center":
        return 10
    inset = anchor.h * inset_pct
    if pos == "top":
        return int(round(anchor.top + inset))
    return int(round(canvas_h - anchor.bottom + inset))


# ------------------------------------------------------------------ loading

def _fail(path: Path, message: str, hint: str | None = None):
    raise ConfigError(f"{path.name}: {message}", hint=hint)


def _check_section(path: Path, section: str, data: dict) -> dict:
    spec = SCHEMA[section]
    for key in data:
        if key not in spec:
            close = difflib.get_close_matches(key, spec, n=1)
            hint = f"Did you mean {close[0]!r}? " if close else ""
            _fail(path, f"unknown key '{section}.{key}'",
                  hint + f"Valid keys in [{section}]: {', '.join(sorted(spec))}")
    out = {}
    for key, (check, required) in spec.items():
        if key not in data:
            if required:
                _fail(path, f"missing key '{section}.{key}'",
                      f"Every visual value must be stated. Valid keys in "
                      f"[{section}]: {', '.join(sorted(spec))}")
            continue
        try:
            out[key] = check(data[key])
        except ValueError as exc:
            _fail(path, f"bad value for '{section}.{key}': {exc}",
                  f"Got {data[key]!r}.")
    return out


def _check_conditionals(path: Path, style: dict) -> None:
    """Keys that are only required once another key switches them on."""
    if style["video"]["mode"] == "inset":
        for key in ("x", "y", "w", "h"):
            if key not in style["video"]:
                _fail(path, f"missing key 'video.{key}'",
                      "video.mode = \"inset\" needs x, y, w and h as "
                      "fractions of the canvas.")
        if style["video"]["x"] + style["video"]["w"] > 1.0 + 1e-9:
            _fail(path, "video.x + video.w exceeds the canvas width")
        if style["video"]["y"] + style["video"]["h"] > 1.0 + 1e-9:
            _fail(path, "video.y + video.h exceeds the canvas height")

    if style["headline"]["enabled"]:
        for key in ("font", "fallback_font", "size_pct", "fill", "accent",
                    "accent_rule", "y_pct", "max_lines", "min_size_pct",
                    "wrap", "valign", "gap_pct"):
            if key not in style["headline"]:
                _fail(path, f"missing key 'headline.{key}'",
                      "headline.enabled = true needs the full headline block.")
        if style["headline"]["min_size_pct"] > style["headline"]["size_pct"]:
            _fail(path, "headline.min_size_pct is larger than headline.size_pct",
                  "The floor cannot be above the starting size.")
        # Checked BEFORE the band: without an inset there is no video.y to
        # measure a band against, and reading one would raise a KeyError
        # instead of saying what is actually wrong with the file.
        if style["video"]["mode"] != "inset":
            _fail(path, "headline.enabled = true needs video.mode = \"inset\"",
                  "A headline has nowhere to go over a full-bleed video.")
        # The band must hold max_lines even at the smallest size the fitter is
        # allowed to shrink to. Checked in fractions so it holds at any output
        # resolution. Without this a style loads happily and the headline is
        # silently ellipsized to one line, or collides with the video.
        band = (style["video"]["y"] - style["headline"]["y_pct"]
                - style["headline"]["gap_pct"])
        needed = (style["headline"]["max_lines"]
                  * style["headline"]["min_size_pct"] * LINE_SPACING)
        if band < needed:
            _fail(path,
                  f"headline band is {band:.3f} of the canvas but "
                  f"{style['headline']['max_lines']} lines at min_size_pct "
                  f"need {needed:.3f}",
                  "Lower headline.y_pct, raise video.y, or reduce max_lines.")

    if style["headline"]["enabled"]:
        _check_headline_coverage(path, style)

    if style["captions"]["box"]:
        for key in ("box_color", "box_opacity"):
            if key not in style["captions"]:
                _fail(path, f"missing key 'captions.{key}'",
                      "captions.box = true needs box_color and box_opacity.")


TELUGU_BLOCK = range(0x0C00, 0x0C80)
LATIN = range(0x41, 0x5B)
# A face is taken to cover a script when it carries most of the block. Telugu
# fonts differ on how many archaic signs they include -- Peddana has 93 of 128,
# Noto 100 -- so an exact count would reject usable faces.
COVERAGE_FLOOR = 0.6


def _covers(font_path: Path, codes) -> int:
    from fontTools.ttLib import TTFont

    try:
        font = TTFont(str(font_path), fontNumber=0, lazy=True)
    except Exception as exc:  # noqa: BLE001 - any unreadable font is a failure
        raise ConfigError(f"Could not read the font {font_path.name}: {exc}",
                          hint=f"Expected a TTF at {font_path}.") from None
    cmap: set[int] = set()
    try:
        for table in font["cmap"].tables:
            cmap |= set(table.cmap.keys())
    finally:
        font.close()
    return sum(1 for c in codes if c in cmap)


def _check_headline_coverage(path: Path, style: dict) -> None:  # noqa: C901
    """
    The headline font AND its declared fallback must together draw the script.

    libass substitutes a missing glyph from whatever else is in the fonts
    directory, so a headline can render correctly by accident -- the first
    style shipped here drew Telugu only because the CAPTION font happened to be
    staged beside it. Change the caption font and the same headline becomes a
    row of .notdef boxes, with nothing in any log to say why.

    Declaring the fallback fixes the staging; checking the pair fixes the
    accident. A style that cannot draw its own titles is refused at load.
    """
    from .config import ASSETS_DIR

    primary = ASSETS_DIR / style["headline"]["font"]
    fallback = ASSETS_DIR / style["headline"]["fallback_font"]
    for font in (primary, fallback):
        if not font.exists():
            _fail(path, f"headline font {font.name} is missing",
                  f"Expected it at {font}.")

    needed = {"Latin": LATIN}
    # Titles come from the same source as the captions, so they carry the same
    # script -- plus Latin, because a Telugu title routinely ends in an English
    # word ("RGV Explains").
    if style["captions"]["script"] == "telugu":
        needed["Telugu"] = TELUGU_BLOCK

    for name, codes in needed.items():
        together = max(_covers(primary, codes), _covers(fallback, codes))
        if together < len(codes) * COVERAGE_FLOOR:
            _fail(path,
                  f"neither headline.font ({primary.name}) nor "
                  f"headline.fallback_font ({fallback.name}) can draw {name} "
                  f"({together}/{len(codes)} of the block)",
                  f"Titles here are {name}; pick a fallback that covers it, or "
                  f"the headline renders as empty boxes.")


def load_style(path: Path) -> Style:
    try:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as exc:
        _fail(path, f"is not valid TOML: {exc}")
    except OSError as exc:
        raise ConfigError(f"Could not read style {path}: {exc}") from None

    for key in raw:
        if key not in SCHEMA and key not in TOP_LEVEL:
            close = difflib.get_close_matches(key, list(SCHEMA) + list(TOP_LEVEL),
                                              n=1)
            hint = f"Did you mean {close[0]!r}? " if close else ""
            _fail(path, f"unknown section '{key}'",
                  hint + f"Valid sections: {', '.join(sorted(SCHEMA))}")
    for section in SCHEMA:
        if section not in raw:
            if section in OPTIONAL:
                continue
            _fail(path, f"missing section [{section}]",
                  f"Required sections: {', '.join(sorted(set(SCHEMA) - set(OPTIONAL)))}")
        if not isinstance(raw[section], dict):
            _fail(path, f"[{section}] must be a table")

    checked = {s: (_check_section(path, s, raw[s]) if s in raw else dict(OPTIONAL[s]))
               for s in SCHEMA}
    _check_conditionals(path, checked)
    return Style(name=path.stem, description=raw.get("description", ""),
                 **checked)


def available(directory: Path = STYLES_DIR) -> dict[str, Path]:
    if not directory.is_dir():
        return {}
    return {p.stem: p for p in sorted(directory.glob("*.toml"))}


def get(name: str, directory: Path = STYLES_DIR) -> Style:
    found = available(directory)
    if name not in found:
        raise ConfigError(
            f"Unknown style {name!r}",
            hint=(f"Available styles: {', '.join(sorted(found))}"
                  if found else f"No style files found in {directory}"),
        )
    return load_style(found[name])
