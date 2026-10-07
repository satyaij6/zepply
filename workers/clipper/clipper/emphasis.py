"""
Punch-ins: a hard zoom on the words the speaker leans on.

Short-form editors cut in tight on emphasis, hold for a beat, and cut back out.
Done well it reads as "this part matters"; done everywhere it reads as a
gimmick. So the choice is conservative by construction:

* **Loudness picks the word, not the model.** A word spoken well above the
  clip's own level is emphasised whatever language it is in -- and Telugu with
  English mixed in is exactly where a text model guesses worst. Measured
  against the CLIP's words, not the whole recording, so a quiet speaker still
  gets punches and a shouting match does not get thirty.
* **Hard cuts in and out.** An eased zoom has to pass through every scale in
  between, which is where cheap reframes look cheap. A cut is also the only
  thing that stays in step with a cut-based camera (see reframe/path.py).
* **Never across a seam, never on a split.** A punch that straddles a span join
  zooms into a dissolve; one over a stacked split crops both people's heads.
  Both are excluded rather than handled.
"""
from __future__ import annotations

import logging
import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .config import Settings
from .models import ClipPlan, Word

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Punch:
    """A zoomed interval in ASSEMBLED clip time."""
    start: float
    end: float
    word: str

    def to_dict(self) -> dict:
        return {"start": round(self.start, 3), "end": round(self.end, 3), "word": self.word}


def word_energy(audio: Path, words: list[Word]) -> dict[int, float]:
    """RMS of each word's own samples, keyed by global word index."""
    out: dict[int, float] = {}
    if not words:
        return out
    with wave.open(str(audio), "rb") as wf:
        rate = wf.getframerate()
        total = wf.getnframes()
        if wf.getsampwidth() != 2:
            return out
        channels = wf.getnchannels()
        for w in words:
            a = max(0, int(w.start * rate))
            b = min(total, int(w.end * rate))
            if b - a < rate * 0.05:
                continue
            wf.setpos(a)
            raw = wf.readframes(b - a)
            data = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
            if channels > 1:
                data = data.reshape(-1, channels).mean(axis=1)
            if len(data):
                out[w.i] = float(np.sqrt(np.mean(data.astype(np.float64) ** 2)))
    return out


def _blocked(plan: ClipPlan, frame_plans: list | None) -> list[tuple[float, float]]:
    """Assembled-time intervals no punch may touch: joins and non-single layouts."""
    out: list[tuple[float, float]] = []
    for k, join in enumerate(plan.joins):
        at = plan.spans[k + 1].playback_start
        out.append((at - 0.4, at + join.duration + 0.4))
    for n, span in enumerate(plan.spans):
        fp = frame_plans[n] if frame_plans and n < len(frame_plans) else None
        if fp is None:
            continue
        for run in fp.runs:
            if run.kind != "single":
                out.append((span.playback_start + run.start, span.playback_start + run.end))
            elif run.start > 0:
                # A camera switch is already a cut; a punch right on top of it
                # is two cuts a frame apart, which reads as a glitch.
                at = span.playback_start + run.start
                out.append((at - 0.5, at + 0.5))
    return out


def _to_playback(plan: ClipPlan, t: float) -> float | None:
    for span in plan.spans:
        if span.source_start <= t < span.source_end:
            return span.playback_start + (t - span.source_start)
    return None


def choose(
    plan: ClipPlan, words: list[Word], audio: Path, settings: Settings,
    *, frame_plans: list | None = None,
) -> list[Punch]:
    """Where to punch in for one clip, in assembled time, earliest first."""
    if not settings.punch_ins or not plan.spans:
        return []
    single = len(plan.spans) == 1
    inside = [
        w for w in words
        if not w.overlap and any(s.source_start <= w.start and w.end <= s.source_end
                                 for s in plan.spans)
    ]
    if len(inside) < 8:
        return []
    energy = word_energy(audio, inside)
    if len(energy) < 8:
        return []
    values = np.array(list(energy.values()))
    mean, std = float(values.mean()), float(values.std())
    if std < 1e-6:
        return []

    total = plan.total_duration
    blocked = _blocked(plan, frame_plans)
    budget = min(settings.punch_max, int(total // settings.punch_min_gap))
    by_index = {w.i: k for k, w in enumerate(inside)}

    candidates = []
    for w in inside:
        z = (energy.get(w.i, mean) - mean) / std
        if z < settings.punch_min_z or w.duration < 0.12:
            continue
        # Single letters and fillers peak on breath noise more than meaning.
        if len(w.caption_text.strip(".,!?")) < 2:
            continue
        candidates.append((z, w))
    candidates.sort(key=lambda c: -c[0])

    chosen: list[Punch] = []
    for z, w in candidates:
        if len(chosen) >= budget:
            break
        start = _to_playback(plan, w.start)
        if start is None:
            continue
        start = max(0.0, start - 0.04)
        # Hold to the end of the phrase: the next real pause, within limits.
        k = by_index[w.i]
        end_src = w.end
        for nxt in inside[k + 1:]:
            if nxt.start - end_src >= 0.3 or nxt.end - w.start > settings.punch_max_hold:
                break
            end_src = nxt.end
        end = _to_playback(plan, end_src) if single else start + (end_src - w.start)
        end = min(max(end or start, start + settings.punch_min_hold),
                  start + settings.punch_max_hold)
        if start < 1.2 or end > total - 1.0:
            continue
        if any(a < end and start < b for a, b in blocked):
            continue
        if any(abs(start - p.start) < settings.punch_min_gap for p in chosen):
            continue
        chosen.append(Punch(start, end, w.caption_text))

    chosen.sort(key=lambda p: p.start)
    if chosen:
        log.info("emphasis: %d punch-in(s) at %s", len(chosen),
                 ", ".join(f"{p.start:.1f}s" for p in chosen))
    return chosen


def zoom_chain(punches: list[Punch], settings: Settings, fps: int) -> str:
    """
    A filter fragment that zooms the picture during each punch, or "".

    `zoompan` with d=1 maps one input frame to one output frame, so timing is
    untouched; the zoom value is a step function of the frame number. The crop
    hangs from the face line (face_anchor_y) rather than the centre, so a
    punched-in face stays where the eye already was.
    """
    if not punches:
        return ""
    z = settings.punch_zoom
    t = f"(on/{fps})"
    cond = "+".join(f"between({t},{p.start:.3f},{p.end:.3f})" for p in punches)
    anchor = settings.face_anchor_y
    return (
        f"zoompan=z='if({cond},{z:.3f},1)'"
        f":x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*{anchor:.3f}'"
        f":d=1:s={settings.video_w}x{settings.video_h}:fps={fps}"
    )
