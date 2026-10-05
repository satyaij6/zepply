"""
Locked reframing: static per speaker, hard cuts only, split when both are up.

The framing is deliberately NOT a continuous path any more. Following head
movement reads as cheap; a static frame per person reads as directed. So the
strongest guard here is that the crop only ever takes values from the set of
locked positions -- an intermediate value means continuous movement has crept
back in, which is exactly the regression these tests exist to catch.

One test goes end to end through real detection, using a face lifted from actual
footage and composited onto a moving background. A "face" drawn with rectangles
is not detected by any real detector, and a tracking test that never detects
anything passes for the wrong reason.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.config import Settings
from clipper.reframe.active import Assignment, Identity, Track
from clipper.reframe.detect import Face
from clipper.reframe.path import (
    apply_hysteresis, build_locks, build_panels, build_plan, enforce_min_dwell,
    jitter, lock_for,
)

SOURCE_W, SOURCE_H = 1280, 720
FPS = 30.0


def identity_from(points, *, ident=0, fps=5.0, size=110.0, t0=0.0) -> Identity:
    faces, times = [], []
    for i, (cx, cy) in enumerate(points):
        faces.append(Face(x=cx - size / 2, y=cy - size / 2, w=size, h=size,
                          score=0.9, landmarks=[], mouth_motion=0.5))
        times.append(t0 + i / fps)
    return Identity(id=ident, tracks=[Track(id=ident, times=times, faces=faces)])


def steady(cx, seconds, *, ident=0, fps=5.0, cy=260.0, t0=0.0) -> Identity:
    return identity_from([(cx, cy)] * (int(seconds * fps) + 1), ident=ident,
                         fps=fps, t0=t0)


def plan_for(identities, assigns, turns, *, duration=12.0, settings=None,
             start=0.0):
    return build_plan(identities, assigns, turns,
                      source_w=SOURCE_W, source_h=SOURCE_H,
                      start=start, duration=duration, fps=FPS,
                      settings=settings or Settings())


def two_people(seconds=12.0):
    return [steady(320.0, seconds, ident=0), steady(960.0, seconds, ident=1)]


# ------------------------------------------------------------ locking

def test_the_crop_is_static_while_one_person_talks():
    """
    Head movement, leaning and gesturing must move the camera not at all. A
    subject wandering inside a locked shot is exactly what a viewer should never
    see the frame respond to.
    """
    wobble = [(640.0 + 30 * math.sin(i / 3.0), 260.0) for i in range(60)]
    plan = plan_for([identity_from(wobble)], {"0": Assignment("0", 0, 1.0, "")},
                    [(0.0, 12.0, "0")])

    assert len(set(round(x, 3) for x in plan.xs)) == 1, (
        f"crop moved across {len(set(plan.xs))} positions while one person "
        f"spoke; it must be locked"
    )
    assert jitter(plan) == 0.0
    assert len(plan.runs) == 1 and plan.runs[0].kind == "single"


def test_the_crop_only_ever_takes_locked_values():
    """The core guard: an intermediate value means easing or tracking is back."""
    s = Settings(min_dwell=1.0, layout="single")
    turns = [(0.0, 4.0, "A"), (4.0, 12.0, "B")]
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for(two_people(), assigns, turns, settings=s)

    allowed = plan.locked_values
    seen = {round(x, 3) for x in plan.xs}
    assert seen <= allowed, (
        f"crop used non-locked values {sorted(seen - allowed)}; "
        f"allowed {sorted(allowed)}"
    )
    assert len(seen) == 2, "expected exactly the two locked positions"


def test_every_switch_is_a_hard_cut():
    s = Settings(min_dwell=1.0, layout="single")
    turns = [(0.0, 4.0, "A"), (4.0, 12.0, "B")]
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for(two_people(), assigns, turns, settings=s)
    assert plan.switches, "expected a switch"
    assert all(sw["style"] == "cut" for sw in plan.switches)


def test_no_frame_sits_between_two_locks():
    """The failure easing caused: a midpoint frame showing empty stage."""
    s = Settings(min_dwell=1.0, layout="single")
    turns = [(0.0, 4.0, "A"), (4.0, 12.0, "B")]
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for([steady(200.0, 12.0, ident=0), steady(1080.0, 12.0, ident=1)],
                    assigns, turns, settings=s)

    lo, hi = min(plan.locked_values), max(plan.locked_values)
    midpoint = (lo + hi) / 2
    assert hi > lo
    for x in plan.xs:
        assert abs(x - midpoint) > 1.0, (
            f"crop passed through {midpoint:.0f}, where nobody is standing"
        )


# ------------------------------------------------------------ framing locks

def test_one_person_across_two_camera_angles_gets_two_locks():
    """
    Measured on real footage: the same person sat at x=801 in one angle and
    x=979 in another, 14% of frame width apart. A single median lock would have
    put them 160px off-centre in a 405px crop for 41 of 90 seconds.
    """
    ident = Identity(id=0, tracks=[
        identity_from([(801.0, 260.0)] * 50, ident=0).tracks[0],
        identity_from([(979.0, 260.0)] * 50, ident=0, t0=12.0).tracks[0],
    ])
    locks = build_locks([ident], SOURCE_W, Settings())

    assert len(locks[0]) == 2, f"expected two framings, got {len(locks[0])}"
    xs = sorted(l.face_cx for l in locks[0])
    assert abs(xs[0] - 801) < 5 and abs(xs[1] - 979) < 5
    assert abs(lock_for(locks[0], 5.0).face_cx - 801) < 5
    assert abs(lock_for(locks[0], 15.0).face_cx - 979) < 5


def test_a_single_lock_would_have_pushed_that_face_to_the_crop_edge():
    """Quantifies why two locks were necessary rather than tidy."""
    import statistics

    crop_w = SOURCE_H * (1080 / 1920)          # 405px
    # The measured split on real footage: 137 samples at 801, 102 at 979.
    single = statistics.median([801.0] * 137 + [979.0] * 102)
    error = abs(979 - single)
    assert error > crop_w / 2 * 0.7, (
        f"a single lock at {single:.0f} leaves the second framing only "
        f"{error:.0f}px off-centre; the real case was ~160px in a "
        f"{crop_w:.0f}px crop"
    )


def test_a_steady_person_gets_exactly_one_lock():
    locks = build_locks(
        [identity_from([(640.0 + (i % 5), 260.0) for i in range(60)])],
        SOURCE_W, Settings())
    assert len(locks[0]) == 1


def test_an_angle_change_is_reported_as_such():
    s = Settings(min_dwell=0.5)
    ident = Identity(id=0, tracks=[
        identity_from([(400.0, 260.0)] * 40, ident=0).tracks[0],
        identity_from([(900.0, 260.0)] * 40, ident=0, t0=10.0).tracks[0],
    ])
    plan = plan_for([ident], {"0": Assignment("0", 0, 1.0, "")},
                    [(0.0, 18.0, "0")], duration=18.0, settings=s)
    reasons = [sw["why"] for sw in plan.switches]
    assert any("camera angle" in r for r in reasons), reasons


# ------------------------------------------------------------ hysteresis

def test_a_short_interjection_does_not_cut():
    s = Settings(layout="single")
    turns = [(0.0, 5.0, "A"), (5.0, 5.3, "B"), (5.3, 12.0, "A")]
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for(two_people(), assigns, turns, settings=s)
    assert plan.switches == [], f"cut for a 0.3s interjection: {plan.switches}"
    assert len(set(plan.xs)) == 1


def test_hysteresis_default_is_the_agreed_one_point_two():
    assert Settings().switch_hysteresis == 1.2


def test_min_dwell_spreads_a_fast_genuine_exchange():
    """
    Hysteresis only filters turns SHORTER than its threshold, so speakers
    genuinely alternating every 4s pass it at any setting -- measured, three
    switches inside 8.4s, unchanged from 0.6s to 2.0s. min_dwell gates on how
    long the camera has been parked instead.
    """
    fps = 30.0
    raw = ([0] * 120 + [1] * 120) * 3
    assert apply_hysteresis(raw, fps, 2.0).count(1) > 0, "fixture is wrong"

    held = enforce_min_dwell(apply_hysteresis(raw, fps, 1.2), fps, 6.0)
    assert (sum(1 for a, b in zip(held, held[1:]) if a != b)
            < sum(1 for a, b in zip(raw, raw[1:]) if a != b))

    runs, n = [], 1
    for a, b in zip(held, held[1:]):
        if a == b:
            n += 1
        else:
            runs.append(n); n = 1
    runs.append(n)
    for length in runs[1:-1]:
        assert length >= 6.0 * fps - 1


# ------------------------------------------------------------ split screen

def test_split_stacks_both_people():
    s = Settings(layout="split", min_dwell=1.0)
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for(two_people(), assigns, [(0.0, 12.0, "A")], settings=s)

    split_runs = [r for r in plan.runs if r.kind == "split"]
    assert split_runs, "layout=split produced no split run"
    assert len(split_runs[0].panels) == 2


def test_panels_never_overlap_so_neither_shows_both_faces():
    """
    Sizing panels purely by aspect (source_h * 9/8 = 810px) would exceed the
    640px separation here, and each panel would contain both faces -- which
    reads as a bug, not a layout.
    """
    s = Settings()
    panels = build_panels(build_locks(two_people(), SOURCE_W, s), 1.0,
                          source_w=SOURCE_W, source_h=SOURCE_H, settings=s)
    assert len(panels) == 2
    top, bottom = panels
    assert top.crop_x + top.crop_w <= bottom.crop_x + 1.0, (
        f"panels overlap: top ends at {top.crop_x + top.crop_w:.0f}, "
        f"bottom starts at {bottom.crop_x:.0f}"
    )


def test_panel_order_is_left_on_top_and_never_reorders():
    """A layout that swaps by who is talking is disorienting."""
    s = Settings()
    locks = build_locks(two_people(), SOURCE_W, s)
    early = build_panels(locks, 1.0, source_w=SOURCE_W, source_h=SOURCE_H, settings=s)
    late = build_panels(locks, 11.0, source_w=SOURCE_W, source_h=SOURCE_H, settings=s)
    assert early[0].crop_x < early[1].crop_x, "left person must be the top panel"
    assert [p.identity for p in early] == [p.identity for p in late]


def test_panels_are_face_anchored_not_centred():
    s = Settings()
    locks = build_locks([identity_from([(320.0, 150.0)] * 60, ident=0),
                         identity_from([(960.0, 150.0)] * 60, ident=1)],
                        SOURCE_W, s)
    panels = build_panels(locks, 1.0, source_w=SOURCE_W, source_h=SOURCE_H, settings=s)
    centred_y = (SOURCE_H - panels[0].crop_h) / 2
    assert abs(panels[0].crop_y - centred_y) > 1.0, (
        "panel was centred vertically instead of anchored on the face"
    )


def test_layout_single_never_splits():
    s = Settings(layout="single")
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for(two_people(), assigns, [(0.0, 12.0, "A")], settings=s)
    assert all(r.kind == "single" for r in plan.runs)


# ------------------------------------------------------------ fallback

def test_no_faces_falls_back_to_centre_crop_and_warns(caplog):
    s = Settings()
    with caplog.at_level("WARNING"):
        plan = build_plan([], {}, [], source_w=SOURCE_W, source_h=SOURCE_H,
                          start=0.0, duration=6.0, fps=FPS, settings=s,
                          detection_ratio=0.0)
    assert plan.fallback and "centre crop" in plan.note
    assert any("centre crop" in r.message for r in caplog.records)
    assert len(set(round(x, 3) for x in plan.xs)) == 1
    assert plan.xs[0] == pytest.approx((SOURCE_W - plan.crop_w) / 2)
    assert len(plan.runs) == 1


def test_low_detection_ratio_also_falls_back():
    s = Settings(reframe_min_detection_ratio=0.5)
    plan = build_plan([steady(640.0, 6.0)], {"0": Assignment("0", 0, 1.0, "")},
                      [(0.0, 6.0, "0")], source_w=SOURCE_W, source_h=SOURCE_H,
                      start=0.0, duration=6.0, fps=FPS, settings=s,
                      detection_ratio=0.31)
    assert plan.fallback and "31%" in plan.note


# ------------------------------------------------------------ render graph

def test_single_run_emits_one_static_crop_and_no_concat():
    from clipper.reframe.render import build_span_graph

    s = Settings()
    plan = plan_for([steady(640.0, 12.0)], {"0": Assignment("0", 0, 1.0, "")},
                    [(0.0, 12.0, "0")], settings=s)
    parts, label, used = build_span_graph(plan, s, first_input=0, label="s0", fps=30)
    graph = ";".join(parts)
    assert used == 1
    assert "concat" not in graph, "a single run should not need concat"
    assert "sendcmd" not in graph, "locked framing needs no per-frame commands"
    assert "crop=405:720" in graph


def test_multiple_runs_are_joined_with_the_concat_filter():
    """
    The concat FILTER, inside one graph and therefore one encode. The concat
    demuxer joins separately-encoded files and puts a visible seam at every
    boundary.
    """
    from clipper.reframe.render import build_span_graph, span_inputs

    s = Settings(min_dwell=1.0, layout="single")
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for(two_people(), assigns,
                    [(0.0, 4.0, "A"), (4.0, 12.0, "B")], settings=s)
    assert len(plan.runs) >= 2

    parts, label, used = build_span_graph(plan, s, first_input=0, label="s0", fps=30)
    graph = ";".join(parts)
    assert f"concat=n={used}:v=1:a=0" in graph
    assert used == len(plan.runs)

    args = span_inputs(plan, "src.mp4", 0.0, 12.0)
    assert args.count("-i") == len(plan.runs) + 1


def test_audio_is_never_segmented_by_a_layout_change():
    """A layout change is visual; cutting audio at one would be audible."""
    from clipper.reframe.render import span_inputs

    s = Settings(min_dwell=1.0, layout="single")
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for(two_people(), assigns,
                    [(0.0, 4.0, "A"), (4.0, 12.0, "B")], settings=s)
    args = span_inputs(plan, "src.mp4", 100.0, 12.0)
    durations = [float(args[i + 1]) for i, a in enumerate(args) if a == "-t"]
    assert durations[-1] == pytest.approx(12.0), (
        "the last input must cover the whole span for continuous audio"
    )


def test_split_run_builds_two_crops_and_a_vstack():
    from clipper.reframe.render import build_span_graph

    s = Settings(layout="split", min_dwell=1.0)
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for(two_people(), assigns, [(0.0, 12.0, "A")], settings=s)
    parts, label, used = build_span_graph(plan, s, first_input=0, label="s0", fps=30)
    graph = ";".join(parts)
    assert "vstack=inputs=2" in graph
    assert graph.count("crop=") >= 2
    assert "scale=1080:960" in graph


# ------------------------------------------------------------ end to end

REFERENCE = Path(r"C:\Users\satya\Downloads\test2.mp4")
needs_reference = pytest.mark.skipif(
    not REFERENCE.exists(), reason="reference footage unavailable")


def _build_moving_face_clip(dest: Path, *, seconds: int = 8, fps: int = 25) -> int:
    """A clip with a known target path, built from a REAL face."""
    import cv2
    import numpy as np

    cap = cv2.VideoCapture(str(REFERENCE))
    cap.set(cv2.CAP_PROP_POS_FRAMES, 300)
    ok, frame = cap.read()
    cap.release()
    assert ok

    det = cv2.FaceDetectorYN.create(
        "assets/face_detection_yunet_2023mar.onnx", "",
        (frame.shape[1], frame.shape[0]), score_threshold=0.6)
    _, faces = det.detect(frame)
    assert faces is not None and len(faces)

    b = faces[0]
    pad = 0.25
    x0, y0 = max(0, int(b[0] - b[2] * pad)), max(0, int(b[1] - b[3] * pad))
    x1 = min(frame.shape[1], int(b[0] + b[2] * (1 + pad)))
    y1 = min(frame.shape[0], int(b[1] + b[3] * (1 + pad)))
    patch = frame[y0:y1, x0:x1]

    fh = 260
    fw = int(patch.shape[1] * fh / patch.shape[0])
    face = cv2.resize(patch, (fw, fh))
    writer = cv2.VideoWriter(str(dest), cv2.VideoWriter_fourcc(*"mp4v"), fps,
                             (SOURCE_W, SOURCE_H))
    for i in range(fps * seconds):
        t = i / fps
        cx = SOURCE_W / 2 + 300 * math.sin(2 * math.pi * t / seconds)
        canvas = np.full((SOURCE_H, SOURCE_W, 3), 40, np.uint8)
        x, y = int(cx - fw / 2), int(SOURCE_H * 0.42 - fh / 2)
        xs, ys = max(0, x), max(0, y)
        xe, ye = min(SOURCE_W, x + fw), min(SOURCE_H, y + fh)
        canvas[ys:ye, xs:xe] = face[ys - y:ye - y, xs - x:xe - x]
        writer.write(canvas)
    writer.release()
    return seconds


@needs_reference
def test_a_locked_plan_measures_exactly_zero_jitter():
    """
    The strongest form of the guard. With locked framing there is no smoothing
    parameter to tune -- the answer is exactly 0, and anything else means
    continuous movement has returned to a design that is meant to be static.
    """
    s = Settings(min_dwell=1.0, layout="single")
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for(two_people(), assigns,
                    [(0.0, 4.0, "A"), (4.0, 12.0, "B")], settings=s)
    assert len(plan.runs) >= 2, "need a switch for this to be meaningful"
    assert jitter(plan) == 0.0


def test_xs_describes_what_is_rendered_not_who_is_speaking():
    """
    Inside a split run the picture is a stacked pair, so the active speaker's
    lock is not what appears on screen. xs has to follow the render or the
    jitter metric reports movement on a plan that never moves.
    """
    s = Settings(layout="split", min_dwell=1.0)
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for(two_people(), assigns,
                    [(0.0, 6.0, "A"), (6.0, 12.0, "B")], settings=s)
    split_runs = [r for r in plan.runs if r.kind == "split"]
    assert split_runs
    for run in split_runs:
        lo = int(round(run.start * FPS))
        hi = min(int(round(run.end * FPS)), len(plan.xs))
        values = set(round(x, 3) for x in plan.xs[lo:hi])
        assert len(values) == 1, (
            f"xs moved inside a split run ({values}); the picture did not"
        )


def test_split_panel_SIZE_is_constant_but_position_follows_the_live_framing():
    """
    Two separate lessons, learned in order.

    Sizing panels from whichever framing was visible made their width jump
    between runs -- 461px in one, 632px in another -- and a layout that resizes
    reads as a glitch. So size is fixed for the whole clip.

    Fixing the POSITION too was the overcorrection: the person with two camera
    angles sat at x=801 in one and x=979 in the other, and a panel pinned to
    the dominant framing pushed his face 89% of the way to the panel edge
    whenever the other angle was live.
    """
    ident1 = Identity(id=1, tracks=[
        identity_from([(801.0, 260.0)] * 40, ident=1).tracks[0],
        identity_from([(979.0, 260.0)] * 40, ident=1, t0=14.0).tracks[0],
    ])
    s = Settings(layout="split", min_dwell=1.0)
    plan = plan_for([steady(320.0, 22.0, ident=0), ident1],
                    {"A": Assignment("A", 0, 1.0, "")},
                    [(0.0, 22.0, "A")], duration=22.0, settings=s)
    splits = [r for r in plan.runs if r.kind == "split"]
    widths = {round(p.crop_w, 1) for r in splits for p in r.panels}
    assert len(widths) == 1, f"panel size changed between runs: {widths}"

    # And each panel must actually be centred on the framing that is live.
    for run in splits:
        for panel in run.panels:
            centre = panel.crop_x + panel.crop_w / 2
            nearest = min(
                (l for ls in plan.locks.values() for l in ls),
                key=lambda l: abs(l.face_cx - centre),
            )
            assert abs(nearest.face_cx - centre) < panel.crop_w * 0.25, (
                f"panel centred at {centre:.0f} is not on any framing; "
                f"nearest is {nearest.face_cx:.0f}"
            )


@needs_reference
def test_end_to_end_detection_produces_locked_framing(tmp_path):
    """
    Full chain on real detection. A subject sweeping 600px across the frame is
    now deliberately NOT followed: it resolves to locks, and the crop only ever
    sits on one of them.
    """
    from clipper.reframe.active import build_tracks, cluster_identities
    from clipper.reframe.detect import detect

    clip = tmp_path / "moving_face.mp4"
    seconds = _build_moving_face_clip(clip)

    s = Settings()
    det = detect(clip, tmp_path / "faces.json", s, use_cache=False)
    assert det.detection_ratio > 0.9

    identities = cluster_identities(build_tracks(det, s), det, s)
    assert identities

    plan = build_plan(identities, {"0": Assignment("0", identities[0].id, 1.0, "")},
                      [(0.0, seconds, "0")], source_w=SOURCE_W, source_h=SOURCE_H,
                      start=0.0, duration=seconds, fps=FPS, settings=s,
                      detection_ratio=det.detection_ratio)
    assert not plan.fallback

    allowed = plan.locked_values
    seen = {round(x, 3) for x in plan.xs}
    assert seen <= allowed, f"non-locked values {sorted(seen - allowed)}"
    assert jitter(plan) == 0.0, "a locked plan must measure exactly zero jitter"


@needs_reference
def test_a_blank_video_falls_back_rather_than_failing(tmp_path):
    import cv2
    import numpy as np

    from clipper.reframe.detect import detect

    clip = tmp_path / "blank.mp4"
    writer = cv2.VideoWriter(str(clip), cv2.VideoWriter_fourcc(*"mp4v"), 25,
                             (SOURCE_W, SOURCE_H))
    for i in range(100):
        writer.write(np.full((SOURCE_H, SOURCE_W, 3), (i * 2) % 255, np.uint8))
    writer.release()

    s = Settings()
    det = detect(clip, tmp_path / "faces.json", s, use_cache=False)
    assert det.detection_ratio < s.reframe_min_detection_ratio

    plan = build_plan([], {}, [], source_w=SOURCE_W, source_h=SOURCE_H,
                      start=0.0, duration=4.0, fps=FPS, settings=s,
                      detection_ratio=det.detection_ratio)
    assert plan.fallback and len(set(plan.xs)) == 1


def test_split_ends_the_moment_a_panel_would_be_empty():
    """
    Observed in a render: at 0:56 the split showed the same person up top and a
    microphone below, because the source had cut to a single shot while the
    layout was still held. Entering a split waits out the hold; leaving one
    cannot, because a half-empty split is showing furniture.
    """
    s = Settings(layout="auto", min_dwell=1.0, split_min_hold=0.5)
    # Both visible 0-6s, then only identity 0.
    pair = [steady(320.0, 20.0, ident=0), steady(960.0, 6.0, ident=1)]
    assigns = {"A": Assignment("A", 0, 1.0, ""), "B": Assignment("B", 1, 1.0, "")}
    plan = plan_for(pair, assigns, [(0.0, 20.0, "A")], duration=20.0, settings=s)

    for run in plan.runs:
        if run.kind != "split":
            continue
        assert run.end <= 7.0, (
            f"split ran to {run.end:.1f}s but the second person left at 6.0s"
        )


def test_the_crop_follows_the_source_when_it_cuts_faster_than_the_dwell():
    """
    The failure behind the empty frames: the source changed shot every 0.8s
    (median) while hysteresis was 1.2s and min_dwell 6.0s, so every brief cut
    away produced ~1.2s of microphone and wall -- 8.8s of a 90s clip.

    Correctness outranks pacing: if the person being framed is not on screen,
    the crop moves immediately.
    """
    s = Settings(min_dwell=6.0, switch_hysteresis=1.2, layout="single",
                 min_run=0.0)
    fps = 5.0
    # A and B alternate on screen every 1.2s -- faster than either pacing rule.
    a_pts, b_pts, t = [], [], 0.0
    a_times, b_times = [], []
    for block in range(10):
        for k in range(6):
            tt = block * 1.2 + k * 0.2
            if block % 2 == 0:
                a_pts.append((320.0, 260.0)); a_times.append(tt)
            else:
                b_pts.append((960.0, 260.0)); b_times.append(tt)
    left = Identity(id=0, tracks=[Track(
        id=0, times=a_times,
        faces=[Face(x=320 - 55, y=205, w=110, h=110, score=.9, landmarks=[],
                    mouth_motion=.5) for _ in a_times])])
    right = Identity(id=1, tracks=[Track(
        id=1, times=b_times,
        faces=[Face(x=960 - 55, y=205, w=110, h=110, score=.9, landmarks=[],
                    mouth_motion=.5) for _ in b_times])])

    plan = plan_for([left, right], {"A": Assignment("A", 0, 1.0, "")},
                    [(0.0, 12.0, "A")], duration=12.0, settings=s)

    from clipper.reframe.path import Visibility

    seen = Visibility([left, right])
    empty = 0
    for i, x in enumerate(plan.xs):
        t = i / FPS
        present = seen.visible(t)
        if not present:
            continue
        inside = any(
            x <= seen.face_at(p, t).cx <= x + plan.crop_w for p in present
        )
        empty += (not inside)
    assert empty == 0, (
        f"{empty} frames framed empty space while someone was on screen; "
        f"the crop must follow the source's cuts"
    )
