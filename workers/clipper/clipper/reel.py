"""
The "Comment for link" reel: the speaker in a card on a brand canvas, a
headline panel above them, and a "Comment WORD" end card.

docs/style_guide_creator_reels.md, layout B. The canvas is the brand colour
darkened until cream type reads on it; the top panel carries short section
headlines ("HOW TO APPLY / SIGN IN & APPLY") that change as the explanation
moves on; the last seconds show the keyword people comment to get the link --
the same keyword as the Zepply comment->DM trigger the app creates for it.

Section headlines come from one small Claude call per clip. Without it (no
key, no credit, a refusal) the panel shows the clip's cover text for the whole
clip, which is still a correct reel, just a less chaptered one.
"""
from __future__ import annotations

import colorsys
import hashlib
import html
import json
import logging
from pathlib import Path

from pydantic import BaseModel, Field

from .config import Settings
from .errors import TransientError
from .models import ClipPlan, Word
from .retry import with_retry

log = logging.getLogger(__name__)

W, H = 1080, 1920
CARD = (108, 990, 864, 846)     # x, y, w, h of the speaker card
PANEL_TOP, PANEL_BOTTOM = 150, 860


class Section(BaseModel):
    start_word: int = Field(description="Global index of the word where this section starts")
    kicker: str = Field(description="2-4 words, spaced caps label, e.g. HOW TO APPLY")
    headline: str = Field(description="2-5 words, the point of this section, e.g. SIGN IN & APPLY")


class Panels(BaseModel):
    sections: list[Section]


SYSTEM = """\
You write the on-screen chapter headlines for a short vertical reel. The top of
the frame shows a small label (the kicker) above a big headline, and they
change as the speaker moves from one point to the next -- like chapters.

Return 2 to 5 sections for the clip, in order. The first starts at the clip's
first word. Each kicker is 2-4 words (what part of the story this is: "THE
OFFER", "HOW TO APPLY", "WHO CAN USE IT"); each headline is 2-5 words saying
the point plainly and concretely ("FREE FOR 12 MONTHS", "SIGN IN & APPLY").
Write in English, in the words a viewer would search for. Never invent facts,
numbers or names the speaker did not say. No emoji, no "24/7".
"""


def canvas_from(accent: str | None) -> tuple[str, str]:
    """(canvas, type colour): the brand hue, darkened until cream type reads on it."""
    hex_ = (accent or "#3C1848").lstrip("#")
    r, g, b = (int(hex_[i:i + 2], 16) / 255 for i in (0, 2, 4))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    r2, g2, b2 = colorsys.hls_to_rgb(h, 0.17, min(0.62, max(0.35, s)))
    return "#%02X%02X%02X" % (round(r2 * 255), round(g2 * 255), round(b2 * 255)), "#F3E7CF"


def _timed(plan: ClipPlan, words: list[Word]) -> list[tuple[float, Word]]:
    out = []
    for span in plan.spans:
        for w in words:
            if not w.overlap and span.source_start <= w.start < span.source_end:
                out.append((span.playback_start + w.start - span.source_start, w))
    out.sort(key=lambda p: p[0])
    return out


def plan_panels(plan: ClipPlan, words: list[Word], settings: Settings, *,
                fallback: str, cache_dir: Path | None) -> list[tuple[float, str, str]]:
    """(clip time, kicker, headline) per section; one section on any failure."""
    timed = _timed(plan, words)
    single = [(0.0, "", fallback.upper())]
    if len(timed) < 12:
        return single
    numbered = " ".join(f"[{w.i}] {w.caption_text or w.text}" for _, w in timed)
    prompt = (f"Clip length {plan.total_duration:.0f}s. Theme: {plan.theme}\n"
              f"Words (numbered; use these numbers for start_word):\n{numbered}")
    key = hashlib.sha256((SYSTEM + prompt + settings.postkit_model).encode()).hexdigest()[:16]
    cache = cache_dir / f"panels_{key}.json" if cache_dir else None
    try:
        if cache is not None and cache.exists():
            panels = Panels.model_validate_json(cache.read_text(encoding="utf-8"))
        else:
            panels = _ask(settings, prompt)
            if cache is not None:
                cache.write_text(panels.model_dump_json(indent=1), encoding="utf-8")
    except Exception as exc:  # noqa: BLE001 - headlines are an extra
        log.warning("reel: no section headlines (%s); using the cover text", exc)
        return single
    at = {w.i: t for t, w in timed}
    out: list[tuple[float, str, str]] = []
    for sec in sorted(panels.sections, key=lambda s: s.start_word):
        t = at.get(sec.start_word)
        if t is None or (out and t - out[-1][0] < 2.5):
            continue
        out.append((0.0 if not out else t, sec.kicker.strip().upper()[:32], sec.headline.strip().upper()[:48]))
    return out or single


def _ask(settings: Settings, prompt: str) -> Panels:
    import anthropic

    from .http import ensure_tls

    ensure_tls()
    client = anthropic.Anthropic(api_key=settings.require_anthropic())

    def once() -> Panels:
        try:
            with client.messages.stream(
                model=settings.postkit_model, max_tokens=4000, system=SYSTEM,
                output_config={"effort": "low"},
                messages=[{"role": "user", "content": prompt}], output_format=Panels,
            ) as stream:
                response = stream.get_final_message()
        except (anthropic.RateLimitError, anthropic.APIConnectionError,
                anthropic.InternalServerError) as exc:
            raise TransientError(f"Claude call failed: {type(exc).__name__}") from exc
        if response.parsed_output is None:
            raise TransientError(f"no structured output (stop_reason={response.stop_reason})")
        return response.parsed_output

    return with_retry(once, what="reel panels", attempts=3, base_delay=2.0)


def _esc(s: str) -> str:
    return html.escape(s, quote=True)


def layer(duration: float, *, card: bool, sections: list[tuple[float, str, str]],
          keyword: str | None, accent: str, canvas: str, ink: str):
    """
    The reel's own layer (kinetic.Layer): the headline panel when `card`, and
    the end card when there is a keyword. The canvas and the speaker card are
    applied to the composition shell by broll.assemble.
    """
    from .kinetic import Layer

    parts, calls = [], []
    end_at = max(0.0, duration - 3.2) if keyword else duration
    if card:
        for n, (t, kicker, headline) in enumerate(sections):
            nxt = sections[n + 1][0] if n + 1 < len(sections) else end_at
            if nxt - t < 0.6:
                continue
            sid = f"rp{n}"
            parts.append(f'<div class="rp" id="{sid}"><div class="kick">{_esc(kicker)}</div>'
                         f'<div class="head">{_esc(headline)}</div></div>')
            calls.append(f'tl.fromTo("#{sid}", {{opacity:0, y:40}}, {{opacity:1, y:0, duration:0.35, '
                         f'ease:"power3.out"}}, {max(0.0, t):.3f});')
            calls.append(f'tl.to("#{sid}", {{opacity:0, y:-30, duration:0.25, ease:"power2.in"}}, '
                         f'{max(t + 0.36, nxt - 0.25):.3f});')
    if keyword:
        kw = _esc(keyword.strip().upper()[:16])
        parts.append(f'<div class="rend{" in-card" if card else ""}" id="rend">'
                     f'<div class="c1">Comment</div><div class="c2">&ldquo;{kw}&rdquo;</div>'
                     f'<div class="c3">for the link</div></div>')
        calls.append(f'tl.fromTo("#rend", {{opacity:0, scale:0.6}}, {{opacity:1, scale:1.08, duration:0.22, '
                     f'ease:"power2.out"}}, {end_at:.3f});')
        calls.append(f'tl.to("#rend", {{scale:1, duration:0.14, ease:"power2.inOut"}}, {end_at + 0.22:.3f});')

    css = f"""
#reel {{ position: absolute; inset: 0; pointer-events: none; z-index: 40; }}
#reel .rp {{ position: absolute; left: 84px; right: 84px; top: {PANEL_TOP}px; height: {PANEL_BOTTOM - PANEL_TOP}px;
  display: flex; flex-direction: column; justify-content: center; gap: 22px; color: {ink};
  font-family: "Inter Tight", "Noto Sans Telugu", sans-serif; }}
#reel .kick {{ font-size: 30px; font-weight: 700; letter-spacing: 0.18em; color: {accent}; }}
#reel .head {{ font-size: 104px; font-weight: 800; line-height: 0.98; letter-spacing: -0.02em; }}
#reel .rend {{ position: absolute; left: 60px; right: 60px; top: 520px; text-align: center; color: #FFFFFF;
  font-family: "Inter Tight", sans-serif; transform-origin: 50% 50%;
  text-shadow: 0 0 2px rgba(0,0,0,.5), 0 6px 30px rgba(0,0,0,.55); }}
#reel .rend.in-card {{ top: {PANEL_TOP + 120}px; color: {ink}; text-shadow: none; }}
#reel .c1 {{ font-size: 54px; font-weight: 600; }}
#reel .c2 {{ font-size: 168px; font-weight: 900; line-height: 1; letter-spacing: -0.02em; color: {accent}; }}
#reel .c3 {{ font-size: 46px; font-weight: 600; margin-top: 10px; }}
"""
    if not parts:
        return None
    return Layer(html='<div id="reel">\n' + "\n".join(parts) + "\n</div>", css=css,
                 js="\n".join(calls), summary={"sections": len(sections) if card else 0,
                                               "end_card": bool(keyword)})


def shell_css(canvas: str) -> str:
    """Canvas behind everything and the speaker card -- overrides the full-bleed video."""
    x, y, w, h = CARD
    return f"""
#stage {{ background: {canvas}; }}
#video-wrap {{ left: {x}px; top: {y}px; width: {w}px; height: {h}px; border-radius: 34px;
  box-shadow: 0 24px 60px rgba(0,0,0,.35); }}
#video-wrap video {{ object-position: 50% 30%; }}
"""


def merge(*layers):
    """Several layers into one (kinetic.Layer)."""
    from .kinetic import Layer

    real = [l for l in layers if l is not None]
    if not real:
        return None
    summary: dict = {}
    for l in real:
        summary.update(l.summary)
    return Layer(html="\n".join(l.html for l in real), css="\n".join(l.css for l in real),
                 js="\n".join(l.js for l in real), summary=summary)


def summary_json(sections) -> str:
    return json.dumps([{"start": round(t, 2), "kicker": k, "headline": h} for t, k, h in sections])
