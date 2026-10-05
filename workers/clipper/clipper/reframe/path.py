"""
Stage C: decide the framing, as a sequence of static runs.

The crop is LOCKED, not tracked. Following a head around continuously reads as
cheap no matter how well it is smoothed; a static frame per person reads as
directed. So this module produces RUNS -- intervals of constant framing -- and
every transition between them is a hard cut. There is no one-euro filter, no
deadzone and no ease-vs-cut threshold: with a constant crop there is nothing to
smooth, and an eased pan between two people travels through the midpoint, where
nobody is standing.

Every rule below exists against a failure that was measured in a render, not
imagined:

* **Lock per (identity x framing).** One person appeared at x=801 in one camera
  angle and x=979 in another -- 14% of frame width. A single median lock puts
  them 160px off-centre in a 405px crop for 41 of 90 seconds.

* **Presence decides, speech only breaks ties.** Framing whoever was *speaking*
  cropped a microphone and a wall whenever the editor was showing the other
  person: one run framed a face that was detected in 7% of its samples.

* **Presence is read from the nearest detection sample.** A per-identity time
  tolerance looked equivalent and was not -- near a cut it finds a stale sample
  from before the shot changed, reports the departed person as still present,
  and the switch never fires.

* **Correctness outranks pacing.** min_dwell held a locked crop for 5.7 seconds
  after the editor cut away. If the framed person leaves, the crop moves
  immediately, whatever the pacing rules say.

* **Panels: size fixed, position live.** Sizing from whichever framing was
  visible made panels resize between runs (461px then 632px). Fixing position
  too was the overcorrection -- it pinned a face to 89% of the panel width.
"""
from __future__ import annotations

import bisect
import logging
import statistics
from dataclasses import dataclass, field

from ..config import Settings
from . import panes
from .active import Assignment, Identity

log = logging.getLogger(__name__)


# ------------------------------------------------------------------ locks

@dataclass
class Lock:
    """One static framing for one person, in source pixels."""
    identity: int
    framing: int
    face_cx: float
    face_cy: float
    ranges: list[tuple[float, float]] = field(default_factory=list)
    samples: int = 0

    @property
    def key(self) -> str:
        return f"{self.identity}.{self.framing}"

    def covers(self, t: float, slack: float = 0.6) -> bool:
        return any(lo - slack <= t <= hi + slack for lo, hi in self.ranges)

    def crop_x(self, crop_w: float, source_w: float) -> float:
        return min(max(self.face_cx - crop_w / 2, 0.0), max(source_w - crop_w, 0.0))

    def crop_y(self, crop_h: float, source_h: float, anchor: float) -> float:
        if crop_h >= source_h - 1:
            return max((source_h - crop_h) / 2, 0.0)
        return min(max(self.face_cy - crop_h * anchor, 0.0),
                   max(source_h - crop_h, 0.0))

    def to_dict(self) -> dict:
        return {"identity": self.identity, "framing": self.framing,
                "face_cx": round(self.face_cx, 1), "face_cy": round(self.face_cy, 1),
                "samples": self.samples,
                "ranges": [[round(a, 2), round(b, 2)] for a, b in self.ranges]}


def _contiguous(times: list[float], gap: float = 1.5) -> list[tuple[float, float]]:
    if not times:
        return []
    out, lo, prev = [], times[0], times[0]
    for t in times[1:]:
        if t - prev > gap:
            out.append((lo, prev))
            lo = t
        prev = t
    out.append((lo, prev))
    return out


def _geometry_of(run: "Run") -> tuple:
    """What a run actually renders, ignoring which lock it came from."""
    if run.kind == "split":
        return ("split", tuple((p.identity, round(p.crop_x, 1), round(p.crop_y, 1),
                                round(p.crop_w, 1), round(p.crop_h, 1))
                               for p in run.panels))
    return ("single", round(run.crop_x, 1), round(run.crop_y, 1))


def _coalesce_identical_runs(plan: "FramePlan") -> None:
    """
    Merge neighbouring runs that render the SAME crop.

    Runs are keyed by lock, so a source can change which lock is nearest
    without changing where the crop lands -- measured on one clip, two
    adjacent runs both rendered x=611 and were still cut apart, which reports
    a cut that a viewer cannot see and pays for an extra decode and concat
    boundary for nothing. Comparing geometry rather than lock identity removes
    exactly those and changes not one pixel.
    """
    if len(plan.runs) < 2:
        return
    merged = [plan.runs[0]]
    for run in plan.runs[1:]:
        if _geometry_of(run) == _geometry_of(merged[-1]):
            merged[-1].end = run.end
        else:
            merged.append(run)
    plan.runs = merged


def _median_cx(cluster: list) -> float:
    """
    Median cx of a cluster that is ALREADY ordered by cx.

    Clusters are grown by appending samples in ascending cx, so the list is
    sorted and its median is the middle element. Calling statistics.median on a
    fresh list comprehension after every append instead made clustering
    O(n^2 log n): profiled at 945s of a 965s planning pass -- 1.09 BILLION
    function calls to frame a 55-second clip. Identical value, O(1).
    """
    n = len(cluster)
    mid = n // 2
    if n % 2:
        return cluster[mid][1].cx
    return (cluster[mid - 1][1].cx + cluster[mid][1].cx) / 2


def build_locks(
    identities: list[Identity], source_w: float, settings: Settings,
) -> dict[int, list[Lock]]:
    """
    One lock per (identity, framing).

    Framings are position clusters within an identity: the same person shot from
    a different camera angle lands in a different part of the frame, which is a
    different lock rather than drift to be corrected after the fact. The median
    is used, not the mean, so a few bad detections cannot drag the frame off the
    subject.
    """
    tolerance = settings.framing_tolerance * source_w
    locks: dict[int, list[Lock]] = {}

    for identity in identities:
        samples = identity.samples
        if not samples:
            continue
        ordered = sorted(samples, key=lambda p: p[1].cx)
        clusters: list[list] = [[ordered[0]]]
        for item in ordered[1:]:
            centre = _median_cx(clusters[-1])
            if abs(item[1].cx - centre) <= tolerance:
                clusters[-1].append(item)
            else:
                clusters.append([item])

        made: list[Lock] = []
        for n, cluster in enumerate(sorted(
                clusters, key=lambda c: statistics.median([f.cx for _, f in c]))):
            times = sorted(t for t, _ in cluster)
            made.append(Lock(
                identity=identity.id, framing=n,
                face_cx=statistics.median([f.cx for _, f in cluster]),
                face_cy=statistics.median([f.cy for _, f in cluster]),
                ranges=_contiguous(times), samples=len(cluster),
            ))
        locks[identity.id] = made

        if len(made) > 1:
            spread = max(l.face_cx for l in made) - min(l.face_cx for l in made)
            log.info(
                "reframe: identity %d has %d framings (x = %s), %.0fpx apart = "
                "%.0f%% of frame -- separate locks, not drift",
                identity.id, len(made),
                ", ".join(f"{l.face_cx:.0f}" for l in made),
                spread, 100 * spread / source_w,
            )
        else:
            log.info("reframe: identity %d locked at x=%.0f (%d samples)",
                     identity.id, made[0].face_cx, made[0].samples)
    return locks


def lock_for(locks: list[Lock], t: float, face=None) -> Lock:
    """
    The framing to use for this person now.

    When the face is actually detected, pick the framing nearest to where it
    really is -- the detection is ground truth and beats any range bookkeeping.
    """
    if face is not None:
        return min(locks, key=lambda l: abs(l.face_cx - face.cx))
    covering = [l for l in locks if l.covers(t)]
    if covering:
        return max(covering, key=lambda l: l.samples)
    return max(locks, key=lambda l: l.samples)


# ------------------------------------------------------------------ visibility

class Visibility:
    """
    Who is in frame at each moment, read from the detections themselves.

    Presence comes from the NEAREST detection sample rather than a per-identity
    time tolerance. The tolerance version looked equivalent and was not: near a
    cut it finds a stale sample from just before the shot changed, reports the
    departed person as still present, and the switch never fires. That left
    mis-framed stretches in a render even after cut timing had been refined to
    40ms -- the timing was right and the lookup was wrong.
    """

    def __init__(self, identities: list[Identity]):
        moments: dict[float, set[int]] = {}
        faces: dict[tuple[float, int], object] = {}
        for identity in identities:
            for t, face in identity.samples:
                key = round(t, 4)
                moments.setdefault(key, set()).add(identity.id)
                faces[(key, identity.id)] = face
        self.times = sorted(moments)
        self.sets = [moments[t] for t in self.times]
        self.faces = faces

    def _nearest(self, t: float) -> int | None:
        if not self.times:
            return None
        i = bisect.bisect_left(self.times, t)
        best = None
        for j in (i - 1, i):
            if 0 <= j < len(self.times):
                if best is None or abs(self.times[j] - t) < abs(self.times[best] - t):
                    best = j
        return best

    def visible(self, t: float) -> list[int]:
        i = self._nearest(t)
        return sorted(self.sets[i]) if i is not None else []

    def face_at(self, ident: int, t: float):
        i = self._nearest(t)
        if i is None:
            return None
        return self.faces.get((round(self.times[i], 4), ident))


# ------------------------------------------------------------------ runs

@dataclass
class Panel:
    identity: int
    crop_x: float
    crop_y: float
    crop_w: float
    crop_h: float


@dataclass
class Run:
    """An interval of constant framing. The unit the renderer works in."""
    start: float
    end: float
    kind: str                       # "single" | "split"
    lock_key: str = ""
    identity: int | None = None
    crop_x: float = 0.0
    crop_y: float = 0.0
    panels: list[Panel] = field(default_factory=list)

    @property
    def duration(self) -> float:
        return self.end - self.start

    def to_dict(self) -> dict:
        return {
            "start": round(self.start, 3), "end": round(self.end, 3),
            "duration": round(self.duration, 3), "kind": self.kind,
            "lock": self.lock_key, "identity": self.identity,
            "crop_x": round(self.crop_x, 1), "crop_y": round(self.crop_y, 1),
            "panels": [{"identity": p.identity, "x": round(p.crop_x, 1),
                        "y": round(p.crop_y, 1), "w": round(p.crop_w, 1),
                        "h": round(p.crop_h, 1)} for p in self.panels],
        }


@dataclass
class FramePlan:
    fps: float
    crop_w: float
    crop_h: float
    source_w: int
    source_h: int
    runs: list[Run] = field(default_factory=list)
    xs: list[float] = field(default_factory=list)
    active: list[int | None] = field(default_factory=list)
    switches: list[dict] = field(default_factory=list)
    locks: dict[int, list[Lock]] = field(default_factory=dict)
    fallback: bool = False
    note: str = ""

    @property
    def frames(self) -> int:
        return len(self.xs)

    @property
    def locked_values(self) -> set[float]:
        """Every crop x this plan is permitted to use."""
        out = {round(l.crop_x(self.crop_w, self.source_w), 3)
               for locks in self.locks.values() for l in locks}
        out |= {round(r.panels[0].crop_x, 3) for r in self.runs if r.panels}
        if self.fallback or not out:
            out.add(round((self.source_w - self.crop_w) / 2, 3))
        return out

    def to_dict(self) -> dict:
        return {
            "fps": self.fps,
            "crop_w": round(self.crop_w, 2), "crop_h": round(self.crop_h, 2),
            "source_w": self.source_w, "source_h": self.source_h,
            "frames": self.frames, "fallback": self.fallback, "note": self.note,
            "switches": self.switches,
            "runs": [r.to_dict() for r in self.runs],
            "locks": {str(k): [l.to_dict() for l in v] for k, v in self.locks.items()},
            "x": [round(v, 2) for v in self.xs],
            "active": self.active,
        }


# ------------------------------------------------------------------ gating

def active_identity_at(
    t: float, turns: list[tuple[float, float, str]],
    assignments: dict[str, Assignment],
) -> int | None:
    for lo, hi, who in turns:
        if lo <= t <= hi:
            a = assignments.get(who)
            return a.identity if a else None
    return None


def apply_hysteresis(raw: list, fps: float, hold: float) -> list:
    """A change is accepted only once it has held for `hold` seconds."""
    need = max(1, int(round(hold * fps)))
    current = next((v for v in raw if v is not None), None)
    out, candidate, run = [], None, 0
    for value in raw:
        if value is None or value == current:
            candidate, run = None, 0
        elif value == candidate:
            run += 1
            if run >= need:
                current, candidate, run = candidate, None, 0
        else:
            candidate, run = value, 1
        out.append(current)
    return out


def enforce_min_dwell(stable: list, fps: float, min_dwell: float) -> list:
    """
    Hold each shot for at least `min_dwell` seconds once the camera moves.

    Hysteresis gates on how long the NEW speaker has held the floor, so a
    genuine 4-second exchange passes it at any setting -- measured, three
    switches inside 8.4 seconds, unchanged from 0.6s to 2.0s of hysteresis.
    This gates on how long the CAMERA has been parked instead.
    """
    if min_dwell <= 0 or not stable:
        return stable
    hold = max(1, int(round(min_dwell * fps)))
    out, current, since = [], stable[0], hold
    for value in stable:
        if value != current and since >= hold:
            current, since = value, 0
        since += 1
        out.append(current)
    return out


def absorb_short_runs(keys: list, fps: float, min_run: float,
                      is_valid=None) -> list:
    """
    Fold a run shorter than `min_run` into the one before it.

    The editor sometimes cuts to someone for barely a second, so they ARE
    visible at the switch instant and gone immediately after; no look-ahead
    avoids that. Extending the previous shot is the lesser evil -- unless doing
    so re-creates an empty frame, which `is_valid` prevents. A shot of a couple
    of frames is absorbed either way, since it can show nothing at all.

    Works on the RUN list, not the frame list. The obvious per-frame version
    restarted its scan after every merge, which is quadratic in frames: fine on
    a 3.7s span (92 frames) and pathological on a 52s one from a source that
    cuts every 1.6 seconds, where it ground for minutes before emitting
    anything.
    """
    if min_run <= 0 or not keys:
        return keys
    least = max(1, int(round(min_run * fps)))
    trivial = max(1, int(round(0.25 * fps)))

    runs: list[list] = []
    start = 0
    for i in range(1, len(keys) + 1):
        if i == len(keys) or keys[i] != keys[start]:
            runs.append([start, i, keys[start]])
            start = i

    changed = True
    while changed and len(runs) > 1:
        changed = False

        # The pass below folds a short run into the one BEFORE it, so the
        # FIRST run has nothing to fold into and survives however short it is.
        # That is how a 6-frame opening flash reaches the render: measured on a
        # 35s clip whose first run was 0.24s on one speaker before cutting to
        # the other. Fold the head run FORWARD instead -- the clip opens on the
        # framing it was about to cut to anyway, which is what the editor's own
        # next shot already shows.
        head = runs[0]
        length = head[1] - head[0]
        following = runs[1][2]
        safe = is_valid is None or all(
            is_valid(following, k) for k in range(head[0], head[1]))
        if length < least and (safe or length <= trivial):
            runs[1][0] = head[0]
            runs.pop(0)
            changed = True
            if len(runs) == 1:
                break

        kept: list[list] = []
        for idx, (lo, hi, key) in enumerate(runs):
            if kept:
                length = hi - lo
                previous = kept[-1][2]
                safe = is_valid is None or all(
                    is_valid(previous, k) for k in range(lo, hi))
                if length < least and (safe or length <= trivial):
                    kept[-1][1] = hi
                    changed = True
                    continue
                # Extending the previous shot is vetoed -- it would show an
                # empty frame. Try the FOLLOWING shot before giving up.
                #
                # This is the case that leaves 1-2s flashes in the render: when
                # the source itself cuts cameras, the previous lock genuinely
                # cannot cover these frames, so a backward-only fold keeps the
                # flash and min_run never applies. The next shot usually can
                # cover them, and arriving at the correct framing early beats
                # a second of the wrong one.
                if length < least and idx + 1 < len(runs):
                    following = runs[idx + 1][2]
                    ahead = is_valid is None or all(
                        is_valid(following, k) for k in range(lo, hi))
                    if ahead:
                        runs[idx + 1][0] = lo
                        changed = True
                        continue
            kept.append([lo, hi, key])
        merged: list[list] = []
        for run in kept:
            if merged and merged[-1][2] == run[2]:
                merged[-1][1] = run[1]
            else:
                merged.append(run)
        runs = merged

    out = list(keys)
    for lo, hi, key in runs:
        for k in range(lo, hi):
            out[k] = key
    return out


# ------------------------------------------------------------------ split

def panel_width(locks: dict[int, list[Lock]], *, source_w: int, source_h: int,
                settings: Settings,
                divider: tuple[float, float] | None = None) -> float:
    """
    Panel width, computed ONCE for the whole clip.

    Size is fixed so panels never resize between split runs -- a layout that
    changes scale reads as a glitch. It is bounded by the separation of the two
    dominant framings: sizing purely by aspect (source_h * 9/8 = 810px on this
    footage) exceeds the 499px separation and puts both faces in each panel.

    On a COMPOSITE source it is bounded again by the narrower pane. A panel
    wider than its pane cannot avoid the join no matter where it is placed:
    measured at 596.6px against a left pane of 595px, which is how 58px of the
    neighbouring camera ended up down the edge of the top panel.
    """
    aspect = settings.out_width / (settings.out_height / 2)
    dominant = [max(ls, key=lambda l: l.samples) for ls in locks.values() if ls]
    if len(dominant) < 2:
        width = min(float(source_w), source_h * aspect)
    else:
        dominant.sort(key=lambda l: l.face_cx)
        separation = abs(dominant[-1].face_cx - dominant[0].face_cx)
        width = min(source_h * aspect, separation * settings.split_panel_margin)
        width = max(width, settings.split_min_panel_width)
        width = min(width, float(source_w))

    if divider is not None:
        lo, hi = divider
        narrowest = min(lo, source_w - hi)
        if narrowest > 0:
            width = min(width, narrowest)
    return width


def build_panels(
    locks: dict[int, list[Lock]], t: float, *, source_w: int, source_h: int,
    settings: Settings, seen: Visibility | None = None,
    width: float | None = None, divider: tuple[float, float] | None = None,
) -> list[Panel]:
    """
    Two stacked panels: left person on top, right person on bottom, always.

    The order is fixed on purpose -- a layout that reorders by who is talking
    loses the viewer.

    Size is constant for the whole clip; POSITION follows whichever framing of
    each person is on screen now. Fixing both was a mistake: the person with two
    camera angles sat at x=801 in one and x=979 in the other, and a panel pinned
    to the dominant framing pushed his face 89% of the way to the panel edge.
    """
    aspect = settings.out_width / (settings.out_height / 2)
    if width is None:
        width = panel_width(locks, source_w=source_w, source_h=source_h,
                            settings=settings, divider=divider)
    height = min(float(source_h), width / aspect)

    chosen: list[tuple[Lock, float, float]] = []
    for ls in locks.values():
        if not ls:
            continue
        face = seen.face_at(ls[0].identity, t) if seen is not None else None
        lock = lock_for(ls, t, face)
        # Place on where the face ACTUALLY is in this shot, not on the lock's
        # cluster median. The median averages across source layouts: on a
        # composite this person sits at x=240, and in his full-frame single
        # shot the same identity's median is 360 -- which put him 28% from the
        # panel edge instead of centred. Read once per run, so the crop is
        # still static for the whole shot.
        cx = face.cx if face is not None else lock.face_cx
        cy = face.cy if face is not None else lock.face_cy
        chosen.append((lock, cx, cy))
    chosen.sort(key=lambda c: c[1])
    if len(chosen) < 2:
        return []
    left, right = chosen[0], chosen[-1]

    panels: list[Panel] = []
    for lock, cx, cy in (left, right):
        # Keep the panel inside the pane its face is in. A crop that straddles
        # a composite's join shows a strip of the other camera down one edge.
        pane_lo, pane_hi = panes.pane_for(cx, divider, source_w=source_w)
        limit_lo, limit_hi = pane_lo, max(pane_lo, pane_hi - width)
        x = min(max(cx - width / 2, limit_lo), limit_hi)
        x = min(max(x, 0.0), max(source_w - width, 0.0))
        # Anchor vertically on the face rather than centring blindly: faces sit
        # in the upper-middle of a 16:9 frame, so a centred crop cuts foreheads.
        y = min(max(cy - height * settings.face_anchor_y, 0.0),
                max(source_h - height, 0.0))
        panels.append(Panel(identity=lock.identity, crop_x=x, crop_y=y,
                            crop_w=width, crop_h=height))
    return panels


# ------------------------------------------------------------------ build

def build_plan(
    identities: list[Identity],
    assignments: dict[str, Assignment],
    turns: list[tuple[float, float, str]],
    *,
    source_w: int, source_h: int,
    start: float, duration: float, fps: float,
    settings: Settings,
    detection_ratio: float = 1.0,
    divider: tuple[float, float] | None = None,
) -> FramePlan:
    """Framing for one span, expressed as runs of constant layout."""
    # Crop to the VIDEO RECT's aspect, not the canvas's. An inset style draws
    # a 1:1 box inside a 9:16 canvas; cropping 9:16 for it would frame the shot
    # for a box that does not exist, and the error looks like a tracking bug
    # rather than a geometry one.
    aspect = settings.video_w / settings.video_h
    crop_h = source_h * max(0.2, min(settings.reframe_zoom, 1.0))
    crop_w = crop_h * aspect
    if crop_w > source_w:
        crop_w = float(source_w)
        crop_h = min(float(source_h), crop_w / aspect)

    n = max(1, int(round(duration * fps)))
    plan = FramePlan(fps=fps, crop_w=crop_w, crop_h=crop_h,
                     source_w=source_w, source_h=source_h)
    centre_x = (source_w - crop_w) / 2
    centre_y = (source_h - crop_h) / 2

    if not identities or detection_ratio < settings.reframe_min_detection_ratio:
        plan.fallback = True
        plan.note = (f"only {100 * detection_ratio:.0f}% of frames carry a face "
                     f"(threshold {100 * settings.reframe_min_detection_ratio:.0f}%); "
                     f"using a centre crop")
        log.warning("reframe: %s", plan.note)
        plan.xs = [centre_x] * n
        plan.active = [None] * n
        plan.runs = [Run(0.0, duration, "single", "centre", None, centre_x, centre_y)]
        return plan

    plan.locks = build_locks(identities, source_w, settings)
    times = [start + i / fps for i in range(n)]
    seen = Visibility(identities)
    present_sets = [set(seen.visible(t)) for t in times]
    speakers = [active_identity_at(t, turns, assignments) for t in times]

    # Selection, in strict priority order:
    #   1. the crop must contain a face -- if the framed person leaves, move
    #      immediately, no hysteresis and no dwell;
    #   2. among those on screen, prefer whoever is speaking;
    #   3. only then does pacing apply, and only to a genuine choice between two
    #      visible people.
    hold = max(1, int(round(settings.min_dwell * fps)))
    stable: list[int | None] = []
    current: int | None = None
    since = hold

    def biggest(candidates: set[int], i: int) -> int:
        def area(ident: int) -> float:
            face = seen.face_at(ident, times[i])
            return face.w * face.h if face else 0.0
        return max(candidates, key=area)

    for i in range(n):
        present = present_sets[i]
        speaker = speakers[i]
        if current is None or current not in present:
            if present:
                current = speaker if speaker in present else biggest(present, i)
                since = 0
            # Nobody detected (cutaway, b-roll): hold the last shot, since there
            # is nothing better to point at.
        elif (speaker is not None and speaker in present
              and speaker != current and since >= hold):
            current, since = speaker, 0
        since += 1
        stable.append(current)

    if len(identities) == 1:
        stable = [identities[0].id] * n

    default_id = max(identities, key=lambda i: i.coverage).id

    if settings.layout == "single" or len(plan.locks) < 2:
        layout = [False] * n
    else:
        raw_layout = [
            True if settings.layout == "split" else len(present_sets[i]) >= 2
            for i in range(n)
        ]
        held_layout = apply_hysteresis(raw_layout, fps, settings.split_min_hold)
        # Entering a split waits out the hold; LEAVING one is immediate, because
        # a split whose second panel has emptied is showing furniture.
        layout = [held_layout[i] and len(present_sets[i]) >= 2 for i in range(n)]

    fixed_width = panel_width(plan.locks, source_w=source_w, source_h=source_h,
                              settings=settings, divider=divider)

    keys: list[tuple] = []
    for i, t in enumerate(times):
        who = stable[i] if stable[i] is not None else default_id
        ls = plan.locks.get(who) or plan.locks[default_id]
        lock = lock_for(ls, t, seen.face_at(who, t))
        if layout[i]:
            live = build_panels(plan.locks, t, source_w=source_w,
                                source_h=source_h, settings=settings,
                                seen=seen, width=fixed_width,
                                divider=divider)
            keys.append(("split", tuple(round(p.crop_x) for p in live)))
        else:
            keys.append(("single", lock.key))
        plan.active.append(who)

    def key_is_valid(key, i: int) -> bool:
        """
        Does this framing actually contain the face at frame i?

        Testing only "is this identity on screen" was too weak: when a person
        moved to their second camera angle the old lock still passed, so the new
        run was absorbed back and the face sat at 94% of the crop width.
        """
        if key[0] == "split":
            return len(present_sets[i]) >= 2
        ident = int(str(key[1]).split(".")[0])
        if ident not in present_sets[i]:
            return False
        lock = next((l for l in plan.locks.get(ident, []) if l.key == key[1]), None)
        face = seen.face_at(ident, times[i])
        if lock is None or face is None:
            return False
        x = lock.crop_x(crop_w, source_w)
        margin = crop_w * 0.12
        return x + margin <= face.cx <= x + crop_w - margin

    keys = absorb_short_runs(keys, fps, settings.min_run, key_is_valid)

    i = 0
    while i < n:
        j = i
        while j + 1 < n and keys[j + 1] == keys[i]:
            j += 1
        t0, t1 = i / fps, (j + 1) / fps
        who = plan.active[i]
        if keys[i][0] == "split":
            panels = build_panels(plan.locks, times[i], source_w=source_w,
                                  source_h=source_h, settings=settings,
                                  seen=seen, width=fixed_width,
                                  divider=divider)
            plan.runs.append(Run(t0, t1, "split", "split", who, panels=panels))
        else:
            # The identity comes from the KEY, never from `active`.
            #
            # `active` is a parallel array that absorb_short_runs does not
            # rewrite, so once a frame's key is folded into a neighbour the two
            # disagree. The lock lookup below then searches the OLD identity's
            # locks for the NEW identity's key, finds nothing, and silently
            # falls back to a lock belonging to the wrong person. Measured: a
            # 6-frame opening flash folded forward correctly, and the 8.5s shot
            # after it was then framed with the other speaker's lock -- ten
            # seconds of a microphone and an empty chair while the person
            # talking sat outside the crop.
            who = int(str(keys[i][1]).split(".")[0])
            ls = plan.locks.get(who) or plan.locks[default_id]
            lock = next((l for l in ls if l.key == keys[i][1]),
                        lock_for(ls, times[i], seen.face_at(who, times[i])))
            # Keep a single crop inside its pane too, not just split panels.
            # On the measured source the locks happened to land clear of the
            # join, but a face near it would have produced a crop straddling
            # the seam -- the same artifact, reached by a different path.
            pane_lo, pane_hi = panes.pane_for(lock.face_cx, divider,
                                              source_w=source_w)
            crop_x = lock.crop_x(crop_w, source_w)
            if pane_hi - pane_lo >= crop_w:
                crop_x = min(max(crop_x, pane_lo), pane_hi - crop_w)
            plan.runs.append(Run(
                t0, t1, "single", lock.key, who, crop_x,
                lock.crop_y(crop_h, source_h, settings.face_anchor_y),
            ))
        i = j + 1

    _coalesce_identical_runs(plan)

    # Restate xs from the runs so it describes what is actually RENDERED. While
    # it tracked the active speaker's lock, a split run -- where that value is
    # not used at all -- left the jitter metric reading 0.73 on a plan that
    # never moves.
    plan.xs = [0.0] * n
    for run in plan.runs:
        lo = int(round(run.start * fps))
        hi = min(int(round(run.end * fps)), n)
        value = run.panels[0].crop_x if run.kind == "split" else run.crop_x
        for k in range(lo, hi):
            plan.xs[k] = value

    for a, b in zip(plan.runs, plan.runs[1:]):
        plan.switches.append({
            "t": round(b.start, 3), "from": a.lock_key, "to": b.lock_key,
            "from_kind": a.kind, "to_kind": b.kind, "style": "cut",
            "why": ("layout change" if a.kind != b.kind else
                    "speaker change" if a.identity != b.identity else
                    "camera angle changed; different lock for the same person"),
        })

    log.info("reframe: %d run(s), %d cut(s), crop %.0fx%.0f",
             len(plan.runs), len(plan.switches), crop_w, crop_h)
    return plan


def jitter(plan: FramePlan) -> float:
    """
    Mean absolute second derivative of crop x, in px/frame^2.

    With locked framing this must be exactly 0 outside the frames either side
    of a cut, which are excluded. Anything else means continuous movement has
    crept back into a design meant to be static -- a far stronger guard than the
    old "under some threshold" bound.
    """
    xs = plan.xs
    if len(xs) < 3:
        return 0.0
    skip: set[int] = set()
    for switch in plan.switches:
        frame = int(round(switch["t"] * plan.fps))
        skip.update(range(frame - 2, frame + 3))
    accel = [abs(xs[i + 1] - 2 * xs[i] + xs[i - 1])
             for i in range(1, len(xs) - 1) if i not in skip]
    return sum(accel) / len(accel) if accel else 0.0
