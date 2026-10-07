"""
Kinetic captions: the words placed around the speaker, not stacked under them.

The "Creator Kinetic" template (docs/style_guide_creator_kinetic.md). Each
spoken word appears on its syllable in the empty space beside the head; once
per sentence or so, one word is set huge above the head and marked with the
accent like a pen -- underlined, boxed, circled, or struck through when the
sentence negates it. Where there is no room beside the face (a split shot, a
screen recording, a B-roll cutaway) the words fall back to a quiet `{ bracket }`
line low in the frame, whose braces stretch as each word arrives.

Everything here is decided in Python and emitted as plain positions and
explicit GSAP times: no measuring in the browser, no `stagger: "random"`. The
renderer captures frames in several browser processes, and any choice made at
page load would be made differently in each one.

The head's position comes from the reframe -- the same detections that chose
the crop -- so placement follows the actual framing of every shot.
"""
from __future__ import annotations

import html
import json
import logging
import math
import random
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from .config import ASSETS_DIR, Settings
from .models import ClipPlan, Word

log = logging.getLogger(__name__)

W, H = 1080, 1920
SIDE = 64                      # side margin
TOP_SAFE = 140                 # platform UI
CAPTION_Y = 1600               # bracket line centre
LOW_LIMIT = 1420               # nothing but the bracket line below this
FONT_DIR = ASSETS_DIR / "broll" / "fonts"

SMALL_MAX, SMALL_MIN = 84, 56
HERO_MAX, HERO_MIN = 220, 110
BRACKET_SIZE = 62

STOP = set("""
a an the and or but so if then than that this these those it its it's is are was were be been
being to of in on at for with from by as into about over just like very really also too do does
did done have has had i i'm you you're we they he she me my your our their them us his her am
will would can could should shall may might must not no yes ok okay oh hey um uh yeah right
ani ante antey kooda kuda aithe ayithe ki ko lo ga ra andi anni oka idi adi manam nenu nuvvu
meeru chala kani inka ippudu ala ila ee aa em emi enti undi unnadi unnai ledu kaadu kada ne
aa ee mari kada ayina valla tho ni na mana mee vaallu vallu cheppu chesi cheyyi
""".split())
NEGATION = set("not no never gone without nothing nobody none stop dont don't can't won't isn't "
               "ledu kaadu vaddu ledhu kadhu".split())


@dataclass
class Beat:
    start: float
    end: float
    words: list[tuple[float, float, str]]          # (start, end, text) in clip time
    hero: int | None = None                        # index into words
    mark: str | None = None                        # underline | box | circle | strike
    mode: str = "face"                             # face | bracket
    head: tuple[float, float, float, float] | None = None   # x, y, w, h in output px


@dataclass
class Layer:
    """What the composition needs: markup, styles, and the timeline calls."""
    html: str
    css: str
    js: str
    summary: dict = field(default_factory=dict)


# ------------------------------------------------------------------ text

@lru_cache(maxsize=64)
def _font(size: int, telugu: bool):
    from PIL import ImageFont

    name = "NotoSansTelugu.woff2" if telugu else "InterTight-Latin.woff2"
    return ImageFont.truetype(str(FONT_DIR / name), size)


_TELUGU = re.compile(r"[ఀ-౿]")


def text_width(text: str, size: int, *, weight_pad: float = 1.06) -> float:
    """Rendered width in px; padded because the browser draws heavier weights."""
    return _font(size, bool(_TELUGU.search(text))).getlength(text) * weight_pad


def _plain(text: str) -> str:
    return re.sub(r"[^\w']", "", text.lower())


# ------------------------------------------------------------------ beats

def clip_words(plan: ClipPlan, words: list[Word], script: str) -> list[tuple[float, float, str, int]]:
    """(start, end, shown text, global index) in clip time, speech over others excluded."""
    out = []
    for span in plan.spans:
        for w in words:
            if w.overlap or not (span.source_start <= w.start < span.source_end):
                continue
            a = span.playback_start + (w.start - span.source_start)
            b = span.playback_start + (min(w.end, span.source_end) - span.source_start)
            out.append((a, b, w.text if script == "telugu" else w.caption_text, w.i))
    out.sort()
    return out


def make_beats(timed: list[tuple[float, float, str, int]], *, max_words: int = 4,
               max_seconds: float = 1.8, gap: float = 0.35) -> list[Beat]:
    """Group words into short phrases: a pause, a full stop, 4 words or 1.8 s ends one."""
    beats: list[Beat] = []
    cur: list[tuple[float, float, str]] = []
    for a, b, text, _ in timed:
        if cur and (a - cur[-1][1] >= gap or len(cur) >= max_words
                    or b - cur[0][0] > max_seconds or cur[-1][2].rstrip().endswith((".", "?", "!"))):
            beats.append(Beat(cur[0][0], cur[-1][1], cur))
            cur = []
        cur.append((a, b, text))
    if cur:
        beats.append(Beat(cur[0][0], cur[-1][1], cur))
    for k, beat in enumerate(beats):
        nxt = beats[k + 1].start if k + 1 < len(beats) else beat.end + 0.7
        beat.start = max(0.0, beat.start - 0.04)
        beat.end = min(nxt - 0.04, beat.end + 0.7)
    return beats


def choose_heroes(beats: list[Beat], energy: dict[int, float], timed, *,
                  min_gap: float = 3.5) -> None:
    """At most one big word per beat, spaced out, picked by loudness and length."""
    index_of = {(round(a, 3), text): gi for a, _, text, gi in timed}
    values = list(energy.values())
    mean = sum(values) / len(values) if values else 0.0
    std = (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5 if values else 0.0
    marks = ["underline", "box", "circle"]
    last, n_marks = -1e9, 0
    for beat in beats:
        if beat.start - last < min_gap:
            continue
        best, best_score = None, 0.0
        for k, (a, _, text) in enumerate(beat.words):
            word = _plain(text)
            if len(word) < 4 or word in STOP or word in NEGATION:
                continue
            gi = index_of.get((round(a, 3), text))
            z = (energy.get(gi, mean) - mean) / std if std > 1e-9 else 0.0
            score = z + 0.12 * min(len(word), 10) + (0.8 if any(c.isdigit() for c in word) else 0.0)
            if score > best_score:
                best, best_score = k, score
        if best is None or best_score < 0.9:
            continue
        beat.hero = best
        word = _plain(beat.words[best][2])
        if any(_plain(t) in NEGATION for _, _, t in beat.words):
            beat.mark = "strike"
        elif any(c.isdigit() for c in word):
            beat.mark = "box"
        else:
            mark = marks[n_marks % len(marks)]
            if mark == "circle" and len(word) > 8:
                mark = "underline"
            beat.mark = mark
            n_marks += 1
        last = beat.start


# ------------------------------------------------------------------ geometry

DEFAULT_HEAD = (340.0, 470.0, 400.0, 520.0)


def head_at(t: float, plan: ClipPlan, frame_plans: list | None, ctx,
            settings: Settings) -> tuple[float, float, float, float] | None | str:
    """
    The speaker's head in output pixels at clip time t, "none" when the shot is
    not a single framed person (split, screen, cutaway), or None when unknown.
    """
    for n, span in enumerate(plan.spans):
        if not (span.playback_start <= t < span.playback_start + span.duration + 1e-6):
            continue
        fp = frame_plans[n] if frame_plans and n < len(frame_plans) else None
        if fp is None:
            return None
        rel = t - span.playback_start
        run = next((r for r in fp.runs if r.start <= rel < r.end), fp.runs[-1] if fp.runs else None)
        if run is None or run.kind != "single":
            return "none"
        det = getattr(ctx, "detections", None)
        if det is None or not det.samples:
            return None
        src_t = span.source_start + rel
        sample = min(det.samples, key=lambda s: abs(s.t - src_t))
        if abs(sample.t - src_t) > 0.6 or not sample.faces:
            return None
        k = ctx.proxy_scale
        cx0, cy0, cw, ch = run.crop_x, run.crop_y, fp.crop_w, fp.crop_h
        inside = [f for f in sample.faces
                  if cx0 <= f.cx * k <= cx0 + cw and cy0 <= f.cy * k <= cy0 + ch]
        if not inside:
            return None
        f = max(inside, key=lambda f: f.w * f.h)
        s = settings.video_w / cw
        x, y, w, h = (f.x * k - cx0) * s, (f.y * k - cy0) * s, f.w * k * s, f.h * k * s
        # A face box stops at the hairline and the ears; the head does not.
        return (x - 0.2 * w, y - 0.45 * h, 1.4 * w, 1.6 * h)
    return None


def _wrap(words: list[str], width: float, size: int) -> list[list[str]] | None:
    lines: list[list[str]] = [[]]
    for w in words:
        trial = " ".join([*lines[-1], w])
        if lines[-1] and text_width(trial, size) > width:
            lines.append([w])
        else:
            lines[-1].append(w)
    if any(text_width(" ".join(l), size) > width for l in lines):
        return None
    return lines


def fit_column(words: list[str], width: float, max_lines: int = 3) -> tuple[int, list[list[str]]] | None:
    size = SMALL_MAX
    while size >= SMALL_MIN:
        lines = _wrap(words, width, size)
        if lines and len(lines) <= max_lines:
            return size, lines
        size -= 4
    return None


def fit_hero(text: str, width: float, height: float) -> int | None:
    size = min(HERO_MAX, int(height * 0.85))
    while size >= HERO_MIN:
        if text_width(text, size) <= width:
            return size
        size -= 6
    return None


# ------------------------------------------------------------------ emit

def _esc(s: str) -> str:
    return html.escape(s, quote=True)


def _q(t: float) -> str:
    return f"{max(0.0, t):.3f}"


def _mark_svg(mark: str, w: float, s: float, el_id: str) -> str:
    """The pen stroke for a hero word, in the word's own pixels (no stretching)."""
    if mark == "underline":
        d = (f"M {-0.03*w:.1f} {1.0*s:.1f} C {0.3*w:.1f} {0.9*s:.1f}, {0.7*w:.1f} {1.08*s:.1f}, "
             f"{1.03*w:.1f} {0.95*s:.1f}")
    elif mark == "strike":
        d = (f"M {-0.05*w:.1f} {0.66*s:.1f} C {0.35*w:.1f} {0.58*s:.1f}, {0.66*w:.1f} {0.5*s:.1f}, "
             f"{1.05*w:.1f} {0.36*s:.1f}")
    else:  # circle: a loose loop that overshoots its start, like a pen
        cx, cy, rx, ry = w / 2, 0.56 * s, w / 2 + 0.22 * s, 0.68 * s
        pts = []
        for i in range(15):
            a = -0.35 + i * (2 * 3.14159 + 0.55) / 14
            pts.append((cx + rx * math.cos(a) * (1 + 0.03 * i / 14), cy + ry * math.sin(a)))
        d = "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    return (f'<svg class="mk" id="{el_id}" width="{w:.0f}" height="{1.2*s:.0f}" '
            f'viewBox="0 0 {w:.0f} {1.2*s:.0f}"><path pathLength="1" d="{d}"/></svg>')


def build(plan: ClipPlan, words: list[Word], settings: Settings, *, frame_plans: list | None,
          ctx, audio: Path | None, blocked: list[tuple[float, float]] = (),
          accent: str = "#3888F0", script: str = "roman", seed: int = 7) -> Layer | None:
    """The kinetic caption layer for one clip, or None when it has no words."""
    timed = clip_words(plan, words, script)
    if len(timed) < 4:
        return None
    beats = make_beats(timed)
    energy: dict[int, float] = {}
    if audio is not None and audio.exists():
        from .emphasis import word_energy

        by_i = {w.i: w for w in words}
        energy = word_energy(audio, [by_i[gi] for *_, gi in timed if gi in by_i])
    choose_heroes(beats, energy, timed)

    rng = random.Random(seed)
    parts, calls = [], []
    stats = {"beats": len(beats), "face": 0, "bracket": 0, "heroes": 0}

    for n, beat in enumerate(beats):
        mid = (beat.start + beat.end) / 2
        head = head_at(mid, plan, frame_plans, ctx, settings)
        cutaway = any(a < beat.end and beat.start < b for a, b in blocked)
        texts = [t for _, _, t in beat.words]
        bid = f"kb{n}"

        hero_html = None
        hero_box = None
        if beat.hero is not None and not cutaway and head != "none":
            hx, hy, hw, hh = head if isinstance(head, tuple) else DEFAULT_HEAD
            top_band = (TOP_SAFE, hy - 28)
            low_band = (hy + hh + 24, LOW_LIMIT)
            text = texts[beat.hero]
            for band in (top_band, low_band):
                size = fit_hero(text, W - 2 * SIDE, band[1] - band[0])
                if size:
                    wpx = text_width(text, size)
                    x = (W - wpx) / 2
                    y = band[0] + (band[1] - band[0] - size) / 2 if band is low_band else band[1] - size * 1.05
                    hero_box = (x, y, wpx, size)
                    break
            if hero_box is None:
                beat.hero, beat.mark = None, None

        rest = [k for k in range(len(texts)) if k != beat.hero]

        # ---- where the other words go
        placement: list[tuple[int, float, float, int]] = []   # (word idx, x, y, size)
        mode = "bracket"
        if not cutaway and isinstance(head, tuple) and rest:
            hx, hy, hw, hh = head
            cy = hy + hh * 0.58
            left_w = hx - 28 - SIDE
            right_w = W - SIDE - (hx + hw + 28)
            cols = [c for c, wd in (("L", left_w), ("R", right_w)) if wd >= 150]
            if cols:
                split = (len(rest) + 1) // 2 if len(cols) == 2 else len(rest)
                groups = ([rest[:split], rest[split:]] if len(cols) == 2 else [rest])
                ok = True
                for col, group in zip(cols, groups):
                    if not group:
                        continue
                    width = left_w if col == "L" else right_w
                    fit = fit_column([texts[k] for k in group], width)
                    if fit is None:
                        ok = False
                        break
                    size, lines = fit
                    lh = size * 1.12
                    top = min(max(cy - len(lines) * lh / 2, TOP_SAFE), LOW_LIMIT - len(lines) * lh)
                    k_iter = iter(group)
                    for li, line in enumerate(lines):
                        line_w = text_width(" ".join(line), size)
                        x0 = (hx - 28 - line_w) if col == "L" else (hx + hw + 28)
                        cursor = x0
                        for word in line:
                            k = next(k_iter)
                            placement.append((k, cursor, top + li * lh, size))
                            cursor += text_width(word + " ", size)
                if ok:
                    mode = "face"
                else:
                    placement = []
        hero_low = hero_box is not None and isinstance(head, tuple) and hero_box[1] > head[1] + head[3]
        if mode != "face" and not cutaway and isinstance(head, tuple) and rest and not hero_low:
            # The face fills the width (a close-up): set the words on the
            # chest, centred, a line or two -- the reference does the same.
            hx, hy, hw, hh = head
            band_top, band_bottom = hy + hh + 30, LOW_LIMIT - 20
            fit = fit_column([texts[k] for k in rest], W - 2 * SIDE, max_lines=2)
            if fit and band_bottom - band_top >= fit[0] * 1.12 * len(fit[1]):
                size, lines = fit
                lh = size * 1.12
                top = band_top + 0.25 * (band_bottom - band_top - lh * len(lines))
                k_iter = iter(rest)
                for li, line in enumerate(lines):
                    cursor = (W - text_width(" ".join(line), size)) / 2
                    for word in line:
                        placement.append((next(k_iter), cursor, top + li * lh, size))
                        cursor += text_width(word + " ", size)
                mode = "face"
        if not rest:
            mode = "face"
        beat.mode = mode
        stats[mode] += 1

        # The exit never starts before the last word has fully appeared: a
        # pop still running when the exit begins would finish after it and
        # leave the word on screen for good.
        last_in = max(a for a, _, _ in beat.words)
        exit_t = max(beat.end - 0.14, last_in + 0.08)
        pop = lambda a: max(0.02, min(0.12, exit_t - a - 0.01))  # noqa: E731
        # ---- hero
        if beat.hero is not None and hero_box is not None:
            stats["heroes"] += 1
            x, y, wpx, size = hero_box
            a = beat.words[beat.hero][0]
            text = texts[beat.hero]
            chars = "".join(f'<span class="ch" id="{bid}h{i}">{_esc(c) if c != " " else "&nbsp;"}</span>'
                            for i, c in enumerate(text))
            mark = ""
            if beat.mark == "box":
                mark = (f'<span class="hl" id="{bid}box"></span>'
                        + "".join(f'<span class="hd hd{c}" id="{bid}hd{c}"></span>' for c in "abcd"))
            elif beat.mark:
                mark = _mark_svg(beat.mark, wpx, size, f"{bid}mk")
            parts.append(f'<div class="kw hero" id="{bid}h" style="left:{x:.0f}px;top:{y:.0f}px;'
                         f'font-size:{size}px"><span class="hi">{mark}{chars}</span></div>')
            calls.append(f'tl.fromTo("#{bid}h", {{opacity:0, yPercent:8}}, {{opacity:1, yPercent:0, '
                         f'duration:{min(0.25, max(0.02, exit_t - 0.2 - a)):.3f}, ease:"power3.out"}}, {_q(a)});')
            if beat.mark == "box":
                calls.append(f'tl.fromTo("#{bid}h .hd", {{opacity:0, scale:0}}, {{opacity:1, scale:1, '
                             f'duration:0.1, ease:"power2.out"}}, {_q(a + 0.05)});')
                calls.append(f'tl.fromTo("#{bid}box", {{scaleX:0}}, {{scaleX:1, duration:0.2, '
                             f'ease:"power2.out"}}, {_q(a + 0.12)});')
            elif beat.mark:
                calls.append(f'tl.fromTo("#{bid}mk path", {{strokeDashoffset:1}}, {{strokeDashoffset:0, '
                             f'duration:0.32, ease:"power2.inOut"}}, {_q(a + 0.15)});')
            # Letters drop out in a fixed random order, decided here, not in the page.
            order = list(range(len(text)))
            rng.shuffle(order)
            for rank, i in enumerate(order):
                calls.append(f'tl.to("#{bid}h{i}", {{opacity:0, duration:0.05}}, '
                             f'{_q(exit_t - 0.2 + rank * 0.24 / max(1, len(text)))});')
            calls.append(f'tl.to("#{bid}h .mk, #{bid}h .hl, #{bid}h .hd", {{opacity:0, duration:0.1}}, '
                         f'{_q(exit_t - 0.1)});')

        # ---- the other words
        if mode == "face":
            for k, x, y, size in placement:
                a = beat.words[k][0]
                parts.append(f'<div class="kw" id="{bid}w{k}" style="left:{x:.0f}px;top:{y:.0f}px;'
                             f'font-size:{size}px">{_esc(texts[k])}</div>')
                calls.append(f'tl.fromTo("#{bid}w{k}", {{opacity:0, scale:0.96}}, {{opacity:1, scale:1, '
                             f'duration:{pop(a):.3f}, ease:"power2.out"}}, {_q(a)});')
            order = [k for k, *_ in placement]
            rng.shuffle(order)
            for rank, k in enumerate(order):
                calls.append(f'tl.to("#{bid}w{k}", {{opacity:0, duration:0.08}}, {_q(exit_t + rank * 0.03)});')
        else:
            idx = rest if beat.hero is not None and hero_box is not None else list(range(len(texts)))
            _bracket(beat, idx, texts, bid, parts, calls, exit_t, pop)

    css = f"""
#kin {{ position: absolute; inset: 0; pointer-events: none; z-index: 50; --kin-accent: {accent}; }}
#kin .kw {{ position: absolute; white-space: nowrap; color: #FFFFFF; line-height: 1;
  font-family: "Inter Tight", "Noto Sans Telugu", sans-serif; font-weight: 500; letter-spacing: -0.01em;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.45), 0 2px 18px rgba(0, 0, 0, 0.5); transform-origin: 50% 60%; }}
#kin .hero {{ font-weight: 600; letter-spacing: -0.03em; }}
#kin .hero .hi {{ position: relative; display: inline-block; }}
#kin .hero .ch {{ display: inline-block; }}
#kin .hl {{ position: absolute; left: -0.08em; right: -0.08em; top: 0.04em; bottom: -0.06em; z-index: -1;
  background: var(--kin-accent); transform-origin: 0% 50%; }}
#kin .hd {{ position: absolute; width: 12px; height: 12px; background: var(--kin-accent);
  border: 2px solid #FFFFFF; z-index: 1; }}
#kin .hda {{ left: -0.08em; top: 0.04em; margin: -6px; }} #kin .hdb {{ right: -0.08em; top: 0.04em; margin: -6px; }}
#kin .hdc {{ left: -0.08em; bottom: -0.06em; margin: -6px; }} #kin .hdd {{ right: -0.08em; bottom: -0.06em; margin: -6px; }}
#kin svg.mk {{ position: absolute; left: 0; top: 0; overflow: visible; }}
#kin svg.mk path {{ fill: none; stroke: var(--kin-accent); stroke-width: 10; stroke-linecap: round;
  stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; }}
#kin .br {{ position: absolute; top: {CAPTION_Y - BRACKET_SIZE // 2}px; font-size: {BRACKET_SIZE}px;
  font-weight: 400; color: #FFFFFF; }}
"""
    log.info("kinetic: %d beats (%d around the face, %d bracket), %d hero words",
             stats["beats"], stats["face"], stats["bracket"], stats["heroes"])
    return Layer(html='<div id="kin">\n' + "\n".join(parts) + "\n</div>", css=css,
                 js="\n".join(calls), summary=stats)


def _bracket(beat: Beat, idx: list[int], texts: list[str], bid: str, parts: list[str],
             calls: list[str], exit_t: float, pop) -> None:
    """`{ word word }` centred low in the frame; the braces stretch as words arrive."""
    if not idx:
        return
    s = BRACKET_SIZE
    space, pad = text_width(" ", s), 0.35 * s
    widths = [text_width(texts[k], s) for k in idx]
    brace_w = text_width("{", s)
    cx = W / 2

    def line_w(k: int) -> float:
        return sum(widths[:k + 1]) + space * k

    def word_x(j: int, k: int) -> float:
        return cx - line_w(k) / 2 + sum(widths[:j]) + space * j

    final = len(idx) - 1
    for j, k in enumerate(idx):
        parts.append(f'<div class="kw br" id="{bid}b{j}" style="left:{word_x(j, final):.0f}px">'
                     f'{_esc(texts[k])}</div>')
    lb = cx - line_w(final) / 2 - pad - brace_w
    rb = cx + line_w(final) / 2 + pad
    parts.append(f'<div class="kw br" id="{bid}bl" style="left:{lb:.0f}px">{{</div>')
    parts.append(f'<div class="kw br" id="{bid}br" style="left:{rb:.0f}px">}}</div>')

    t0 = beat.words[idx[0]][0]
    calls.append(f'tl.fromTo(["#{bid}bl", "#{bid}br"], {{opacity:0}}, {{opacity:1, duration:0.12}}, {_q(t0)});')
    for step, k in enumerate(idx):
        t = beat.words[k][0]
        shift = lambda j: word_x(j, step) - word_x(j, final)  # noqa: E731
        calls.append(f'tl.fromTo("#{bid}b{step}", {{opacity:0, x:{shift(step):.1f}}}, '
                     f'{{opacity:1, x:{shift(step):.1f}, duration:{pop(t):.3f}}}, {_q(t)});')
        for j in range(step):
            calls.append(f'tl.to("#{bid}b{j}", {{x:{shift(j):.1f}, duration:0.18, ease:"power2.out"}}, {_q(t)});')
        calls.append(f'tl.to("#{bid}bl", {{x:{(cx - line_w(step) / 2 - pad - brace_w) - lb:.1f}, '
                     f'duration:0.18, ease:"power2.out"}}, {_q(t)});')
        calls.append(f'tl.to("#{bid}br", {{x:{(cx + line_w(step) / 2 + pad) - rb:.1f}, '
                     f'duration:0.18, ease:"power2.out"}}, {_q(t)});')
    calls.append(f'tl.to("#{bid}bl, #{bid}br, ' + ", ".join(f"#{bid}b{j}" for j in range(len(idx)))
                 + f'", {{opacity:0, duration:0.12}}, {_q(exit_t)});')


def summary_json(layer: Layer | None) -> str:
    return json.dumps(layer.summary if layer else {})
