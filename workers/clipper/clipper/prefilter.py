"""
Stage 3 (PASS 1): cheap signals only, no LLM.

This is the cost gate. Everything downstream sees only what survives here, so a
long source costs the same two Claude calls as a short one. It is also the
riskiest stage in the pipeline: a moment the gate drops is a moment the LLM
never gets to judge. That is why near-misses are written to disk alongside the
survivors -- the gate itself has to be tunable against real footage.

Signals, all derived from the word timings and the waveform:

  pause_edges   how cleanly the window starts and ends on a real pause
  energy_peak   loudest moment inside, as a z-score (emphasis, laughter)
  energy_delta  rise in energy versus the preceding 15s (something changed)
  wpm_delta     pace change versus the video's own baseline
  density       speech time over wall time (penalises dead air)

Weights come from the profile in config.py and are deliberate day-one guesses;
they get retuned from rejects.jsonl once enough manual rejections exist.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from . import scenes

import numpy as np

from .align import read_wav
from .config import Settings, Weights
from .models import Region, Signals, Word

log = logging.getLogger(__name__)

ENERGY_HOP = 1.0          # seconds between RMS samples
LOOKBACK = 15.0           # window for the "versus what came before" comparison
NEAR_MISS_LIMIT = 40


# ------------------------------------------------------------------ energy

@dataclass
class EnergyTrack:
    times: np.ndarray     # window centre, seconds
    z: np.ndarray         # RMS as a z-score over the whole recording

    def slice_z(self, start: float, end: float) -> np.ndarray:
        mask = (self.times >= start) & (self.times < end)
        return self.z[mask]


def energy_track(audio_path, window: float = 5.0, hop: float = ENERGY_HOP) -> EnergyTrack:
    data, rate = read_wav(audio_path)
    win = max(int(window * rate), 1)
    step = max(int(hop * rate), 1)
    if len(data) < win:
        win = len(data)

    starts = np.arange(0, max(len(data) - win, 0) + 1, step)
    if len(starts) == 0:
        starts = np.array([0])

    rms = np.empty(len(starts), dtype=np.float32)
    for i, a in enumerate(starts):
        seg = data[a:a + win]
        rms[i] = np.sqrt(np.mean(seg.astype(np.float64) ** 2)) if len(seg) else 0.0

    mean, std = float(rms.mean()), float(rms.std())
    z = (rms - mean) / std if std > 1e-9 else np.zeros_like(rms)
    times = starts / rate + window / 2.0
    return EnergyTrack(times=times, z=z.astype(np.float32))


# ------------------------------------------------------------------ helpers

def _unit(value: float, lo: float, hi: float) -> float:
    """Map a raw measurement onto 0-1 so weights mean the same thing."""
    if hi <= lo:
        return 0.0
    return float(min(max((value - lo) / (hi - lo), 0.0), 1.0))


def boundaries(words: list[Word], pause_gap: float) -> list[int]:
    """
    Word indices that may open or close a window: the start, the end, and every
    word preceded by a real pause. Windows are built only from these, which is
    what keeps candidates aligned to natural speech breaks rather than a grid.
    """
    idx = [0]
    for prev, cur in zip(words, words[1:]):
        if cur.start - prev.end > pause_gap:
            idx.append(cur.i)
    if idx[-1] != len(words):
        idx.append(len(words))
    return idx


def _gap_before(words: list[Word], i: int) -> float:
    if i <= 0:
        return 999.0        # start of the recording is a perfect boundary
    return max(words[i].start - words[i - 1].end, 0.0)


def _gap_after(words: list[Word], i: int) -> float:
    if i >= len(words) - 1:
        return 999.0
    return max(words[i + 1].start - words[i].end, 0.0)


def _wpm(words: list[Word], a: int, b: int) -> float:
    span = words[b].end - words[a].start
    return (b - a + 1) / (span / 60.0) if span > 0 else 0.0


# ------------------------------------------------------------------ scoring

def score_window(
    words: list[Word], a: int, b: int, track: EnergyTrack,
    baseline_wpm: float, weights: Weights,
) -> tuple[float, Signals, list[str]]:
    start, end = words[a].start, words[b].end
    duration = end - start

    gap_in, gap_out = _gap_before(words, a), _gap_after(words, b)
    pause_edges = (_unit(min(gap_in, 2.0), 0.0, 1.5) + _unit(min(gap_out, 2.0), 0.0, 1.5)) / 2

    inside = track.slice_z(start, end)
    before = track.slice_z(max(0.0, start - LOOKBACK), start)
    peak_z = float(inside.max()) if inside.size else 0.0
    mean_z = float(inside.mean()) if inside.size else 0.0
    prev_z = float(before.mean()) if before.size else 0.0

    energy_peak = _unit(peak_z, 0.0, 2.5)
    energy_delta = _unit(mean_z - prev_z, 0.0, 1.5)

    wpm = _wpm(words, a, b)
    wpm_delta = _unit(abs(wpm - baseline_wpm) / baseline_wpm, 0.0, 0.6) if baseline_wpm else 0.0

    speech = sum(w.end - w.start for w in words[a:b + 1])
    density = _unit(speech / duration, 0.15, 0.75) if duration > 0 else 0.0

    signals = Signals(
        pause_edges=round(pause_edges, 4), energy_peak=round(energy_peak, 4),
        energy_delta=round(energy_delta, 4), wpm=round(wpm, 1),
        wpm_delta=round(wpm_delta, 4), density=round(density, 4),
    )
    score = (
        weights.pause_edges * pause_edges
        + weights.energy_peak * energy_peak
        + weights.energy_delta * energy_delta
        + weights.wpm_delta * wpm_delta
        + weights.density * density
    )

    why: list[str] = []
    if peak_z > 1.0:
        why.append(f"energy peak +{peak_z:.1f}sigma inside")
    if mean_z - prev_z > 0.4:
        why.append(f"energy rises +{mean_z - prev_z:.1f}sigma vs previous {LOOKBACK:.0f}s")
    if baseline_wpm and abs(wpm - baseline_wpm) / baseline_wpm > 0.2:
        direction = "faster" if wpm > baseline_wpm else "slower"
        why.append(f"pace {wpm:.0f}wpm is {direction} than baseline {baseline_wpm:.0f}wpm")
    if min(gap_in, gap_out) > 0.8:
        why.append(f"clean pauses both sides ({gap_in:.1f}s in, {gap_out:.1f}s out)"
                   if gap_in < 900 else f"opens the recording, {gap_out:.1f}s pause out")
    if speech / duration > 0.6:
        why.append(f"dense speech ({100 * speech / duration:.0f}% of the window)")
    if not why:
        why.append("no strong signal; survived on composite alone")
    return score, signals, why


def _overlap_fraction(a: Region, b: Region) -> float:
    lo = max(a.start, b.start)
    hi = min(a.end, b.end)
    if hi <= lo:
        return 0.0
    return (hi - lo) / min(a.duration, b.duration)


# ------------------------------------------------------------------ stage

def build_regions(
    words: list[Word], audio_path, settings: Settings,
    cuts: list[float] | None = None,
) -> tuple[list[Region], list[Region]]:
    """
    Return (survivors, near_misses). Near-misses exist to tune the gate.

    `cuts` are the SOURCE's shot-cut times. Regions the editor intercut
    rapidly are penalised: the reframe follows those cuts, and a reel that
    changes shot every 1.5s reads as flashing however well each shot is
    framed. Passing None disables the penalty and restores the old ranking.
    """
    if len(words) < 2:
        return [], []

    weights = settings.weights
    track = energy_track(audio_path, window=settings.rms_window)
    baseline_wpm = _wpm(words, 0, len(words) - 1)
    bounds = boundaries(words, settings.pause_gap)
    log.info("prefilter: %d pause boundaries, baseline %.0f wpm", len(bounds), baseline_wpm)

    candidates: list[Region] = []
    for bi, a in enumerate(bounds):
        if a >= len(words):
            continue
        for b_bound in bounds[bi + 1:]:
            b = min(b_bound, len(words) - 1)
            if b <= a:
                continue
            duration = words[b].end - words[a].start
            if duration < settings.min_duration:
                continue
            if duration > settings.max_duration:
                break  # boundaries ascend, so everything later is longer too
            score, signals, why = score_window(words, a, b, track, baseline_wpm, weights)
            if cuts:
                rate = scenes.cuts_per_minute(cuts, words[a].start, words[b].end)
                factor = scenes.choppiness_factor(rate, settings)
                signals.cuts_per_min = round(rate, 2)
                signals.choppiness_factor = round(factor, 3)
                if factor < 1.0:
                    why.append(f"source cuts {rate:.0f}/min, scaled x{factor:.2f}")
                score *= factor
            candidates.append(Region(
                id="", start_i=a, end_i=b,
                start=words[a].start, end=words[b].end,
                text=" ".join(w.text for w in words[a:b + 1]),
                prefilter_score=round(score, 4), signals=signals, why=why,
            ))

    log.info("prefilter: %d windows in the %.0f-%.0fs range",
             len(candidates), settings.min_duration, settings.max_duration)
    if not candidates:
        return [], []

    candidates.sort(key=lambda r: r.prefilter_score, reverse=True)

    survivors: list[Region] = []
    near_misses: list[Region] = []
    for cand in candidates:
        if any(_overlap_fraction(cand, kept) > settings.max_region_overlap
               for kept in survivors):
            continue
        if len(survivors) < settings.keep_top:
            survivors.append(cand)
        elif len(near_misses) < NEAR_MISS_LIMIT:
            near_misses.append(cand)
        else:
            break

    for n, region in enumerate(survivors, 1):
        region.id = f"r{n:02d}"
    for n, region in enumerate(near_misses, 1):
        region.id = f"x{n:02d}"

    log.info("prefilter: kept %d regions, logged %d near-misses",
             len(survivors), len(near_misses))
    return survivors, near_misses
