"""
Word timings -> caption cues -> .ass (for burning) and .srt (as a sidecar).

Cues are capped by **rendered width**, not word count. Telugu romanizes long --
"Vetukutunnaav" is one word and thirteen characters -- so a fixed three-words-
per-cue rule overflows a 1080px frame on some lines and wastes two thirds of it
on others. Width is measured with the same pinned font that libass will use, so
the measurement and the render agree.

The .ass file is written next to the video with a bare relative filename,
because ffmpeg's subtitle filters treat ':' as an argument separator and a
Windows absolute path (C:\\...) breaks the filtergraph.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from pathlib import Path

from . import headline, styles
from .config import ASSETS_DIR, Settings
from .models import Word

log = logging.getLogger(__name__)

# ASS alignment codes (numpad layout): 2 = bottom centre, 5 = middle, 8 = top.
ALIGNMENT = {"bottom": 2, "center": 5, "top": 8}

# Drop-shadow alpha for an un-boxed caption, as an opacity. 1 - 144/255
# reproduces the &H90 this tool has always written; see write_ass.
SHADOW_OPACITY = 1.0 - 144 / 255


@dataclass
class Cue:
    start: float          # seconds, relative to the clip
    end: float
    text: str


# ------------------------------------------------------------------ measuring

class Measurer:
    """
    Rendered width of a string in the pinned caption font.

    Falls back to a character-count heuristic if Pillow or the font is missing,
    so caption generation degrades rather than fails -- but says so loudly,
    because the fallback will occasionally overflow.
    """

    def __init__(self, font_path: Path, font_size: int):
        self.font = None
        self.font_size = font_size
        try:
            from PIL import ImageFont

            self.font = ImageFont.truetype(str(font_path), font_size)
        except Exception as exc:  # noqa: BLE001 - any failure means fall back
            log.warning(
                "captions: cannot measure text with %s (%s); falling back to a "
                "character-count estimate, which may overflow the frame",
                font_path.name, exc,
            )

    def width(self, text: str) -> float:
        if self.font is not None:
            return self.font.getlength(text)
        return len(text) * self.font_size * 0.55


_FAMILY_CACHE: dict[Path, str] = {}


def _family_of(font_path: Path) -> str:
    """
    Family name as recorded in the font file.

    A style file names a FILE, because that is what gets staged next to the
    render; ASS needs the family name libass matches on. Reading it from the
    font removes the chance of the two disagreeing -- which shows up as a
    silent fallback to some system face, not as an error.
    """
    if font_path not in _FAMILY_CACHE:
        try:
            from PIL import ImageFont

            _FAMILY_CACHE[font_path] = ImageFont.truetype(
                str(font_path), 16).getname()[0]
        except Exception as exc:  # noqa: BLE001
            log.warning("captions: cannot read the family name from %s (%s); "
                        "using the file stem", font_path.name, exc)
            _FAMILY_CACHE[font_path] = font_path.stem
    return _FAMILY_CACHE[font_path]


# ------------------------------------------------------------------ cues

def build_cues(
    words: list[Word], clip_start: float, clip_end: float, settings: Settings,
    *, font_size: int,
) -> list[Cue]:
    """Group the words inside [clip_start, clip_end) into readable cues."""
    # Words spoken over another speaker stay in the transcript but not here: a
    # listener's "yes" inside the host's line would read as the host saying it.
    inside = [w for w in words
              if w.end > clip_start and w.start < clip_end and not w.overlap]
    if not inside:
        return []

    layout = settings.layout_style
    cap = layout.captions
    size = max(1, int(round(cap["size_pct"] * settings.out_height)))
    # Width is bounded by the ANCHOR, not the canvas: a caption inside an inset
    # video has far less room than one across a full-bleed frame, and measuring
    # against the canvas would pack cues that overflow the box.
    anchor = layout.caption_anchor(settings.out_width, settings.out_height)
    max_px = anchor.w * cap["max_width"]
    # Measure in the font that will actually draw the caption. Telugu in a
    # display face is a different width to romanised text in Noto, so sizing
    # cues against the wrong font either overflows the frame or wastes it.
    font_path = ASSETS_DIR / cap["font"]
    measurer = Measurer(font_path, size)

    def shown(w: Word) -> str:
        return w.text if cap["script"] == "telugu" else w.caption_text

    cues: list[Cue] = []
    bucket: list[Word] = []

    def flush() -> None:
        if not bucket:
            return
        cues.append(Cue(
            start=max(0.0, bucket[0].start - clip_start),
            end=max(0.0, bucket[-1].end - clip_start),
            text=" ".join(shown(w) for w in bucket),
        ))
        bucket.clear()

    for word in inside:
        trial = " ".join([*(shown(w) for w in bucket), shown(word)])
        too_wide = measurer.width(trial) > max_px
        too_long = bucket and (word.end - bucket[0].start) > settings.caption_max_seconds
        too_many_chars = (
            measurer.font is None and len(trial) > settings.caption_fallback_max_chars
        )
        if bucket and (too_wide or too_long or too_many_chars):
            flush()
        bucket.append(word)
    flush()

    return _split_overlong(cues, measurer, max_px)


def _split_overlong(cues: list[Cue], measurer: "Measurer", max_px: float) -> list[Cue]:
    """
    Break any cue still wider than the frame into fitting pieces.

    Normal cues are already width-bounded by the packing loop above; this
    catches the case that loop cannot fix -- a SINGLE token wider than the
    frame. Without it such a cue renders off both edges. The token's duration
    is divided across the pieces so the caption stays in sync.
    """
    out: list[Cue] = []
    for cue in cues:
        if measurer.width(cue.text) <= max_px:
            out.append(cue)
            continue

        pieces: list[str] = []
        current = ""
        for ch in cue.text:
            if current and measurer.width(current + ch) > max_px:
                pieces.append(current)
                current = ch
            else:
                current += ch
        if current:
            pieces.append(current)

        log.warning("captions: %r is wider than the frame; split into %d pieces",
                    cue.text[:40] + ("..." if len(cue.text) > 40 else ""), len(pieces))
        span = max(cue.end - cue.start, 0.01) / len(pieces)
        for n, piece in enumerate(pieces):
            out.append(Cue(start=cue.start + n * span,
                           end=cue.start + (n + 1) * span,
                           text=piece.strip()))
    return out


# ------------------------------------------------------- assembled timeline

MIN_CUE_SECONDS = 0.15


def build_assembled_cues(
    plan, words: list[Word], settings: Settings, *, font_size: int,
) -> list[Cue]:
    """
    Cues for a multi-span clip, in assembled time.

    Cues are built PER SPAN and then shifted onto the assembled timeline. That
    ordering is the whole trick: a cue assembled from one span's words can never
    contain a word from another span, so it is structurally impossible for a cue
    to straddle a join. Building cues across the flat word list and mapping them
    afterwards would let skipped material leak into a caption.
    """
    from .assemble import join_windows

    cues: list[Cue] = []
    for span in plan.spans:
        local = build_cues(words, span.source_start, span.source_end, settings,
                           font_size=font_size)
        for cue in local:
            cues.append(Cue(
                start=cue.start + span.playback_start,
                end=cue.end + span.playback_start,
                text=cue.text,
            ))
    return clear_join_windows(cues, join_windows(plan))


def clear_join_windows(
    cues: list[Cue], windows: list[tuple[float, float]],
) -> list[Cue]:
    """
    Keep captions out of the seams.

    During a crossfade two different moments are on screen at once; during a
    card the span's own words are not being spoken. A caption running through
    either belongs to neither side of the join.
    """
    out: list[Cue] = []
    for cue in cues:
        start, end = cue.start, cue.end
        dropped = False
        for lo, hi in windows:
            if end <= lo or start >= hi:
                continue
            if start < lo and end > hi:      # spans the whole window
                end = lo
            elif start < lo:                 # overruns into it
                end = lo
            elif end > hi:                   # starts inside it
                start = hi
            else:                            # entirely inside
                dropped = True
                break
        if dropped or end - start < MIN_CUE_SECONDS:
            log.debug("captions: dropped %r at a join window", cue.text[:30])
            continue
        out.append(Cue(start=start, end=end, text=cue.text))
    return out


def assert_no_cue_straddles_a_join(
    cues: list[Cue], windows: list[tuple[float, float]],
) -> None:
    """Continuity check. A violation means the timeline maths is wrong."""
    for cue in cues:
        for lo, hi in windows:
            overlap = min(cue.end, hi) - max(cue.start, lo)
            if overlap > 1e-6:
                raise AssertionError(
                    f"caption {cue.text[:40]!r} ({cue.start:.3f}-{cue.end:.3f}s) "
                    f"overlaps the join window ({lo:.3f}-{hi:.3f}s) by "
                    f"{overlap:.3f}s -- the assembled timeline is out of step"
                )


# ------------------------------------------------------------------ writers

def _ass_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:d}:{m:02d}:{s:05.2f}"


def _srt_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_ass(
    cues: list[Cue], dest: Path, settings: Settings, *, font_size: int,
    cards: list[Cue] | None = None, headline_text: str | None = None,
) -> Path:
    """
    Burn-in subtitle file for one clip.

    Geometry comes from the layout style: captions may be anchored to the
    CANVAS (full-bleed) or to the VIDEO RECT (inset). ASS measures margins from
    the canvas edge either way, so an anchored caption's margin is computed
    back through the rect by `styles.caption_margin_v` -- see that function for
    why it is not just `out_height * inset`.
    """
    layout = settings.layout_style
    cap = layout.captions
    W, H = settings.out_width, settings.out_height
    anchor = layout.caption_anchor(W, H)

    size = max(1, int(round(cap["size_pct"] * H)))
    align = ALIGNMENT.get(cap["pos"], 2)
    margin_v = styles.caption_margin_v(anchor, H, cap["inset_pct"], cap["pos"])
    # Left/right margins are canvas-absolute too, so an anchored caption has to
    # be pushed in by the anchor's own offset before its max_width applies.
    # Floored, not rounded: rounding up would make the ASS margin tighter
    # than the width build_cues packed cues to, and libass would be the
    # one deciding where a line breaks.
    side = math.floor((anchor.w * (1.0 - cap["max_width"])) / 2)
    margin_l = int(round(anchor.left + side))
    margin_r = int(round(W - anchor.right + side))

    fill = styles.ass_colour(cap["fill"])
    outline = styles.ass_colour(cap["outline"])
    if cap["box"]:
        # BorderStyle 3 is the only way ASS gives a filled plate rather than an
        # outline -- and libass fills that plate with OutlineColour, not
        # BackColour. Measured: Outline red + Back green renders a RED box.
        # Writing box_color into BackColour alone left every box the solid
        # outline colour, whatever the style's box_color and box_opacity said.
        # BackColour gets the same value so a declared shadow box matches.
        plate = styles.ass_colour(cap["box_color"], cap["box_opacity"])
        border_style, outline, back = 3, plate, plate
    else:
        # BorderStyle 1 uses BackColour for the drop shadow. The alpha is the
        # one this tool has always used (&H90 = 144); expressed as an opacity
        # it is 1 - 144/255, and rounding to a tidier 0.44 lands on &H8F and
        # changes every shadowed pixel. Not a value to prettify.
        border_style, back = 1, styles.ass_colour("#000000", SHADOW_OPACITY)

    font_path = ASSETS_DIR / cap["font"]
    family = _family_of(font_path)
    bold = -1 if cap["bold"] else 0
    card_size = int(size * 0.72)
    card_margin = int(anchor.h * 0.10)
    # \fad is per-event, not a style property, so it rides on the text. Kept
    # off the Card style: a span label is already soft, and fading it too reads
    # as a glitch rather than a label.
    fade_in, fade_out = int(cap["fade_in_ms"]), int(cap["fade_out_ms"])
    fade = (f"{{\\fad({fade_in},{fade_out})}}" if fade_in or fade_out else "")

    style_rows = [
        f"Style: Cap,{family},{size},{fill},&H000000FF,{outline},"
        f"{back},{bold},0,0,0,100,100,0,0,{border_style},{cap['outline_px']:.0f},"
        f"{cap['shadow_px']:.0f},{align},{margin_l},{margin_r},{margin_v},1",
        f"Style: Card,{family},{card_size},&H0000E5FF,&H000000FF,"
        f"&H00000000,&HA0000000,-1,0,0,0,100,100,0,0,1,5,2,8,60,60,"
        f"{card_margin},1",
    ]

    event_rows = [
        f"Dialogue: 0,{_ass_time(c.start)},{_ass_time(c.end)},Cap,,0,0,0,,"
        + fade + c.text.replace("\n", " ")
        for c in cues
    ]
    # A span label rides over the top of the incoming span rather than
    # interrupting it. A full-screen title card stalls a short reel the same way
    # a dip-to-black does, which is the reason a dissolve was chosen over one.
    event_rows += [
        f"Dialogue: 1,{_ass_time(c.start)},{_ass_time(c.end)},Card,,0,0,0,,"
        + c.text.replace("\n", " ")
        for c in (cards or [])
    ]

    if layout.headline["enabled"] and headline_text:
        rows, events = _headline_rows(headline_text, layout, settings, cues)
        style_rows += rows
        event_rows += events

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

; The Events format below MUST list Name between Style and MarginL. Every
; Dialogue line carries that (empty) field, so declaring nine columns for ten
; values makes libass fold Effect into Text -- and the separating comma is then
; drawn as literal text. That shipped a leading "," on every burned caption.

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{chr(10).join(style_rows)}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(header + "\n".join(event_rows) + "\n", encoding="utf-8")
    return dest


def _headline_rows(title: str, layout, settings: Settings, cues: list[Cue]):
    """Style and event rows for the headline band, or empty lists."""
    W, H = settings.out_width, settings.out_height
    band = layout.headline_band(W, H)
    spec = layout.headline
    font_path = ASSETS_DIR / spec["font"]

    lines, size = headline.fit(
        title, layout, band, H, lambda px: Measurer(font_path, px))
    if not lines:
        return [], []

    fill = styles.ass_colour(spec["fill"])
    family = _family_of(font_path)
    # ASS alignment 8 hangs text from MarginV below the top; 2 stands it on
    # MarginV above the bottom. Either way the text stays inside the band.
    if spec["valign"] == "bottom":
        align, margin_v = 2, int(round(H - band.bottom))
    else:
        align, margin_v = 8, int(round(band.top))
    row = (f"Style: Head,{family},{size},{fill},&H000000FF,&H00000000,"
           f"&H00000000,-1,0,0,0,100,100,0,0,1,0,0,{align},40,40,"
           f"{margin_v},1")

    accent = styles.ass_inline_colour(spec["accent"])
    plain = styles.ass_inline_colour(spec["fill"])
    rendered = []
    for line in lines:
        parts = []
        for word, is_accent in line:
            parts.append(f"{{\\c{accent}}}{word}" if is_accent
                         else f"{{\\c{plain}}}{word}")
        rendered.append(" ".join(parts))
    text = "\\N".join(rendered)

    # The headline belongs to the clip, not to a cue: it is up for the whole
    # thing, so a viewer who joins mid-scroll still sees what the clip is about.
    end = max((c.end for c in cues), default=0.0)
    event = (f"Dialogue: 2,{_ass_time(0.0)},{_ass_time(end)},Head,,0,0,0,,"
             + text)
    return [row], [event]


def write_srt(cues: list[Cue], dest: Path) -> Path:
    blocks = [
        f"{n}\n{_srt_time(c.start)} --> {_srt_time(c.end)}\n{c.text}\n"
        for n, c in enumerate(cues, 1)
    ]
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(blocks), encoding="utf-8")
    return dest
