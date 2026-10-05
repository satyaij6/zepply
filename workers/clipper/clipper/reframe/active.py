"""
Stage B: which face is the one talking.

Diarization already tells us WHEN each speaker holds the floor. This module
answers WHICH face that is, so the camera follows the right person.

Shape of the problem on real footage: an interview cuts between camera angles,
so positional continuity breaks at every cut and a naive tracker yields dozens
of short fragments rather than two clean tracks. So tracks are built short and
honest, then CLUSTERED into identities by where they sit in frame. That works
for a fixed-camera setup -- which is what this footage is -- and degrades if
people move around or framing changes hard. The robust fix is face embeddings,
which is another model; this version logs its confidence instead, so a bad
assignment is visible rather than silent.

Scoring is mouth motion during each speaker's turns, normalised per identity.
The normalisation is the part that matters: raw pixel difference scales with
face size, so without it the face closest to camera always wins regardless of
who is speaking.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from ..config import Settings
from .detect import Detections, Face, iou

log = logging.getLogger(__name__)


@dataclass
class Track:
    """A run of detections believed to be one face, uninterrupted."""
    id: int
    times: list[float] = field(default_factory=list)
    faces: list[Face] = field(default_factory=list)

    @property
    def start(self) -> float:
        return self.times[0]

    @property
    def end(self) -> float:
        return self.times[-1]

    @property
    def median_cx(self) -> float:
        return sorted(f.cx for f in self.faces)[len(self.faces) // 2]

    @property
    def median_w(self) -> float:
        return sorted(f.w for f in self.faces)[len(self.faces) // 2]


@dataclass
class Identity:
    """A cluster of tracks taken to be the same person."""
    id: int
    tracks: list[Track] = field(default_factory=list)

    @property
    def samples(self) -> list[tuple[float, Face]]:
        out = [(t, f) for tr in self.tracks for t, f in zip(tr.times, tr.faces)]
        out.sort(key=lambda p: p[0])
        return out

    @property
    def median_cx(self) -> float:
        xs = sorted(f.cx for _, f in self.samples)
        return xs[len(xs) // 2] if xs else 0.0

    @property
    def coverage(self) -> float:
        return sum(len(tr.faces) for tr in self.tracks)


@dataclass
class Assignment:
    speaker: str
    identity: int | None
    confidence: float
    detail: str


# ------------------------------------------------------------------ tracking

def build_tracks(det: Detections, settings: Settings) -> list[Track]:
    """
    Greedy IoU association, tolerating a few missed samples.

    Each face in a sample claims the open track it overlaps most, provided the
    overlap clears the threshold; anything unclaimed starts a new track. A track
    that goes unseen for longer than `track_max_gap` samples is closed rather
    than allowed to re-attach to whoever wanders into its old position.
    """
    tracks: list[Track] = []
    open_tracks: list[Track] = []
    missed: dict[int, int] = {}
    next_id = 0

    for sample in det.samples:
        claimed: set[int] = set()

        for face in sample.faces:
            best, best_iou = None, 0.0
            for track in open_tracks:
                if track.id in claimed:
                    continue
                score = iou(face, track.faces[-1])
                if score > best_iou:
                    best, best_iou = track, score

            if best is not None and best_iou >= settings.track_iou:
                best.times.append(sample.t)
                best.faces.append(face)
                missed[best.id] = 0
                claimed.add(best.id)
            else:
                track = Track(id=next_id, times=[sample.t], faces=[face])
                next_id += 1
                tracks.append(track)
                open_tracks.append(track)
                missed[track.id] = 0
                claimed.add(track.id)

        survivors: list[Track] = []
        for track in open_tracks:
            if track.id not in claimed:
                missed[track.id] = missed.get(track.id, 0) + 1
            if missed[track.id] <= settings.track_max_gap:
                survivors.append(track)
        open_tracks = survivors

    tracks = [t for t in tracks if len(t.faces) >= 2]
    log.info("reframe: %d tracks", len(tracks))
    return tracks


def cluster_identities(
    tracks: list[Track], det: Detections, settings: Settings,
    *, max_identities: int | None = None,
) -> list[Identity]:
    """
    Group tracks into people by where they sit in frame.

    Position is a weak signal in general and a strong one here: a fixed-camera
    interview puts each person in a consistent part of the frame across every
    cut, which is exactly what survives when IoU continuity does not.
    """
    if not tracks:
        return []
    limit = max_identities or settings.max_identities
    tolerance = det.width * 0.12

    ordered = sorted(tracks, key=lambda t: t.median_cx)
    clusters: list[list[Track]] = [[ordered[0]]]
    for track in ordered[1:]:
        centre = sum(t.median_cx for t in clusters[-1]) / len(clusters[-1])
        if abs(track.median_cx - centre) <= tolerance:
            clusters[-1].append(track)
        else:
            clusters.append([track])

    # Too many clusters means the tolerance split one person in two; keep the
    # best-covered and fold the remainder into their nearest neighbour.
    if len(clusters) > limit:
        clusters.sort(key=lambda c: -sum(len(t.faces) for t in c))
        keep, spill = clusters[:limit], clusters[limit:]
        for extra in spill:
            centre = sum(t.median_cx for t in extra) / len(extra)
            nearest = min(keep, key=lambda c: abs(
                sum(t.median_cx for t in c) / len(c) - centre))
            nearest.extend(extra)
        clusters = keep

    identities = [Identity(id=n, tracks=c) for n, c in enumerate(
        sorted(clusters, key=lambda c: sum(t.median_cx for t in c) / len(c)))]
    log.info("reframe: %d identit%s at x = %s", len(identities),
             "y" if len(identities) == 1 else "ies",
             ", ".join(f"{i.median_cx:.0f}" for i in identities))
    return identities


# ------------------------------------------------------------------ matching

def is_single_face(det: Detections, turns: list[tuple[float, float, str]]) -> bool:
    """
    The fast path: one face, one speaker, nothing to disambiguate.

    Worth detecting early -- most talking-head footage is this, and everything
    below is wasted effort on it.
    """
    if not det.samples:
        return False
    multi = sum(1 for s in det.samples if len(s.faces) > 1)
    speakers = {s for _, _, s in turns}
    return multi / len(det.samples) < 0.05 and len(speakers) <= 1


def _motion_in(identity: Identity, lo: float, hi: float) -> tuple[float, int]:
    total, n = 0.0, 0
    for t, face in identity.samples:
        if lo <= t <= hi and face.mouth_motion is not None:
            total += face.mouth_motion
            n += 1
    return (total / n if n else 0.0), n


def presence_ratio(identity: Identity, spans: list[tuple[float, float]],
                   fps: float) -> float:
    """
    Fraction of a speaker's floor time this face is actually on screen.

    Measured on real footage this separates far better than mouth motion does
    -- 91% vs 28% where the motion scores were 1.10 vs 0.68 -- because the
    editor has already done the work: they cut to whoever is talking. It is a
    supervisory signal that costs nothing.

    It is a multiplier rather than a replacement, because it says nothing at all
    on a locked-off two-shot where both people are visible throughout. There,
    presence is ~1.0 for everyone and mouth motion has to decide.
    """
    total = sum(hi - lo for lo, hi in spans)
    if total <= 0:
        return 0.0
    seen = sum(1 for t, _ in identity.samples
               if any(lo <= t <= hi for lo, hi in spans))
    expected = total * fps
    return min(seen / expected, 1.0) if expected > 0 else 0.0


def assign_speakers(
    identities: list[Identity], turns: list[tuple[float, float, str]],
    settings: Settings,
) -> dict[str, Assignment]:
    """
    Match each diarized speaker to a face, from two signals.

    1. Mouth motion during that speaker's turns, divided by the identity's own
       average. The division matters: raw pixel difference scales with face
       size, so without it the closest face wins regardless of who is talking.
    2. How much of the speaker's floor time that face is on screen at all.

    They are multiplied. Mouth motion alone turned out to be weak on real
    footage -- the winning identity scored only 1.10x its own baseline, and its
    raw motion was actually LOWER than the runner-up's before normalisation --
    while presence separated cleanly. Neither is trusted alone: presence is
    uninformative on a static two-shot, and motion is uninformative when the
    editor never cuts away.
    """
    if not identities:
        return {}

    baselines: dict[int, float] = {}
    for identity in identities:
        values = [f.mouth_motion for _, f in identity.samples
                  if f.mouth_motion is not None]
        baselines[identity.id] = (sum(values) / len(values)) if values else 0.0

    speakers = sorted({s for _, _, s in turns})
    assignments: dict[str, Assignment] = {}

    for speaker in speakers:
        scores: dict[int, float] = {}
        observed: dict[int, int] = {}
        parts: dict[int, tuple[float, float]] = {}
        spans = [(lo, hi) for lo, hi, who in turns if who == speaker]
        for identity in identities:
            total, n = 0.0, 0
            for lo, hi in spans:
                motion, count = _motion_in(identity, lo, hi)
                if count:
                    total += motion * count
                    n += count
            mean = total / n if n else 0.0
            base = baselines.get(identity.id, 0.0)
            motion_score = (mean / base) if base > 1e-6 else 0.0
            seen = presence_ratio(identity, spans, settings.reframe_fps)
            scores[identity.id] = motion_score * seen
            parts[identity.id] = (motion_score, seen)
            observed[identity.id] = n

        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        if not ranked or ranked[0][1] <= 0:
            assignments[speaker] = Assignment(
                speaker, None, 0.0,
                "no mouth motion observed for any identity during these turns")
            continue

        best_id, best = ranked[0]
        runner = ranked[1][1] if len(ranked) > 1 else 0.0
        # Confidence is the margin, not the absolute score: one identity moving
        # a lot means nothing if the other moved just as much.
        confidence = (best - runner) / best if best > 0 else 0.0
        motion_score, seen = parts.get(best_id, (0.0, 0.0))
        assignments[speaker] = Assignment(
            speaker, best_id, round(confidence, 3),
            f"score {best:.2f} vs runner-up {runner:.2f} "
            f"(motion {motion_score:.2f} x presence {seen:.2f}) "
            f"over {observed.get(best_id, 0)} samples",
        )

    for a in assignments.values():
        level = "low" if a.confidence < 0.15 else "ok"
        log.info("reframe: speaker %s -> identity %s (confidence %.2f, %s) [%s]",
                 a.speaker, a.identity, a.confidence, a.detail, level)
    return assignments


def turns_from_transcript(payload: dict) -> list[tuple[float, float, str]]:
    """Speaker turns from Sarvam's diarized transcript, if it produced any."""
    dz = payload.get("diarized_transcript") or {}
    entries = dz.get("entries") if isinstance(dz, dict) else None
    turns: list[tuple[float, float, str]] = []
    for e in entries or []:
        lo, hi = e.get("start_time_seconds"), e.get("end_time_seconds")
        who = str(e.get("speaker_id", "0"))
        if lo is None or hi is None or float(hi) <= float(lo):
            continue
        turns.append((float(lo), float(hi), who))
    return turns
