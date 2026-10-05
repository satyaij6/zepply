"""
Rendering the top N in parallel must not change what the serial path produced.

Three things broke when the loop became a thread pool, and each is cheap to
protect: clips.json ordering (as_completed yields in finish order, not rank
order), the "one bad clip must not lose the others" guarantee, and
crop_path.json, which every clip read-modify-writes.

No media needed -- render_plan is stubbed, because what is under test is the
orchestration around it, not ffmpeg.
"""
from __future__ import annotations

import json
import sys
import threading
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper import cut
from clipper.config import Settings, paths_for
from clipper.errors import FFmpegError
from clipper.models import ClipPlan, Span


def plan(pid: str) -> ClipPlan:
    span = Span(start_word_i=0, end_word_i=1, role="hook")
    span.source_start, span.source_end = 0.0, 10.0
    return ClipPlan(id=pid, format="single_take", theme="t", spans=[span],
                    hook_score=8, coherence_score=7, standalone_score=7,
                    reason="r", suggested_title=f"title {pid}")


@pytest.fixture
def stub_pipeline(monkeypatch, tmp_path):
    """Everything around render_plan, stubbed to run without media."""
    monkeypatch.setattr(cut.ffmpeg, "ensure_caption_stack", lambda *a, **k: None)
    monkeypatch.setattr(cut.ffmpeg, "video_stream",
                        lambda *a, **k: {"width": 1920, "height": 1080})
    monkeypatch.setattr(cut, "source_fps", lambda *a, **k: 25)
    monkeypatch.setattr(cut.reframe, "prepare", lambda *a, **k: None)

    media = tmp_path / "source.mp4"
    media.write_bytes(b"not really a video")
    paths = paths_for("parallel_test", tmp_path / "out")
    paths.ensure()
    return media, paths


def test_clips_json_stays_in_rank_order_however_the_renders_finish(
    monkeypatch, stub_pipeline
):
    media, paths = stub_pipeline

    # Finish in reverse: clip_03 first, clip_01 last. If ordering came from
    # completion order, clips.json would come out backwards.
    def fake_render(plan_, index, *a, **k):
        time.sleep(0.40 - 0.10 * index)
        return paths.clip(index, "mp4"), paths.clip(index, "srt")

    monkeypatch.setattr(cut, "render_plan", fake_render)

    plans = [plan("p01"), plan("p02"), plan("p03")]
    rendered = cut.cut_plans(plans, [], media, paths, Settings(render_workers=3),
                             top_n=3)

    assert [c["index"] for c in rendered] == [1, 2, 3]
    assert [c["id"] for c in rendered] == ["p01", "p02", "p03"]

    payload = json.loads(paths.clips_json.read_text(encoding="utf-8"))
    assert [c["index"] for c in payload["clips"]] == [1, 2, 3]


def test_one_failing_clip_does_not_lose_the_others(monkeypatch, stub_pipeline):
    media, paths = stub_pipeline

    def fake_render(plan_, index, *a, **k):
        if index == 2:
            raise FFmpegError("clip 2 is cursed")
        return paths.clip(index, "mp4"), paths.clip(index, "srt")

    monkeypatch.setattr(cut, "render_plan", fake_render)

    plans = [plan("p01"), plan("p02"), plan("p03")]
    rendered = cut.cut_plans(plans, [], media, paths, Settings(render_workers=3),
                             top_n=3)

    assert [c["index"] for c in rendered] == [1, 3]


def test_serial_and_parallel_produce_the_same_clips_json(monkeypatch, stub_pipeline):
    media, paths = stub_pipeline

    def fake_render(plan_, index, *a, **k):
        return paths.clip(index, "mp4"), paths.clip(index, "srt")

    monkeypatch.setattr(cut, "render_plan", fake_render)
    plans = [plan("p01"), plan("p02"), plan("p03")]

    serial = cut.cut_plans(plans, [], media, paths, Settings(render_workers=1),
                           top_n=3)
    parallel = cut.cut_plans(plans, [], media, paths, Settings(render_workers=3),
                             top_n=3)
    assert serial == parallel


def test_framing_is_planned_before_any_encode_starts(monkeypatch, stub_pipeline):
    """
    Planning is GIL-bound, so it must not run inside the encode pool.

    Measured on a 70-minute source: three threads planning at once pinned one
    core for ~9 minutes and no ffmpeg started until a thread finished. Planning
    first means the first encode begins as soon as the first plan is ready.
    """
    media, paths = stub_pipeline
    order: list[str] = []

    monkeypatch.setattr(cut, "plan_framings",
                        lambda plan_, *a, **k: order.append("plan") or [None])

    def fake_render(plan_, index, *a, **k):
        order.append("encode")
        return paths.clip(index, "mp4"), paths.clip(index, "srt")

    monkeypatch.setattr(cut, "render_plan", fake_render)

    plans = [plan("p01"), plan("p02"), plan("p03")]
    cut.cut_plans(plans, [], media, paths, Settings(render_workers=3), top_n=3)

    assert order == ["plan"] * 3 + ["encode"] * 3, order


def test_precomputed_framings_are_handed_to_each_render(monkeypatch, stub_pipeline):
    """The pool must use the plan made up front, not plan again itself."""
    media, paths = stub_pipeline
    made: list = []
    seen: list = []

    def fake_plan_framings(plan_, *a, **k):
        made.append(f"framing-{plan_.id}")
        return [made[-1]]

    def fake_render(plan_, index, *a, frame_plans=None, **k):
        seen.append(frame_plans)
        return paths.clip(index, "mp4"), paths.clip(index, "srt")

    monkeypatch.setattr(cut, "plan_framings", fake_plan_framings)
    monkeypatch.setattr(cut, "render_plan", fake_render)

    plans = [plan("p01"), plan("p02"), plan("p03")]
    cut.cut_plans(plans, [], media, paths, Settings(render_workers=3), top_n=3)

    assert sorted(f[0] for f in seen) == ["framing-p01", "framing-p02",
                                          "framing-p03"]


def test_concurrent_crop_path_writes_keep_every_clip(stub_pipeline):
    """Unlocked, the last writer wins and earlier clips vanish from the file."""
    _, paths = stub_pipeline

    def write(index: int) -> None:
        cut._write_crop_path(paths, index, [])

    threads = [threading.Thread(target=write, args=(i,)) for i in range(1, 13)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    saved = json.loads(paths.crop_path.read_text(encoding="utf-8"))
    assert sorted(saved) == [f"clip_{i:02d}" for i in range(1, 13)]
