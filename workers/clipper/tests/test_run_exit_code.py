"""
A run that renders fewer clips than it set out to must not exit 0.

Measured: on a machine with ~2GB of RAM free, all three renders of a 67-minute
podcast died of "Cannot allocate memory", cut logged "rendered 0/3", and the
run still returned 0 -- so the batch script recorded success with no clips on
disk. cut_plans is right to carry on past one failed clip; the exit code is
where the shortfall has to surface.

Every stage before cut is stubbed: what is under test is cmd_run's reading of
cut_plans' result, not the pipeline.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper import cli
from clipper.config import paths_for
from clipper.models import ClipPlan, Region, Span


def plan(pid: str) -> ClipPlan:
    span = Span(start_word_i=0, end_word_i=1, role="hook")
    span.source_start, span.source_end = 0.0, 30.0
    return ClipPlan(id=pid, format="single_take", theme="t", spans=[span],
                    hook_score=8, coherence_score=7, standalone_score=7,
                    reason="r", suggested_title=f"title {pid}")


META = {"name": "exit_test", "source": "x.mp4", "is_url": False,
        "duration": 60.0, "audio_sha256": "0" * 64, "audio_path": "a.wav",
        "media_path": "x.mp4", "proxy_path": None, "width": 1920,
        "height": 1080, "fps": 25.0, "has_video": True}


@pytest.fixture
def run_from_cut(monkeypatch, tmp_path):
    """cmd_run resumed at cut, with `rendered` controlling what cut returns."""
    plans = [plan("p01"), plan("p02"), plan("p03")]

    def fake_read_json(path, **_):
        return META if Path(path).name == "meta.json" else {
            "plans": [p.to_dict() for p in plans]}

    monkeypatch.setattr(cli, "paths_for",
                        lambda name, out: paths_for(name, tmp_path / "out"))
    monkeypatch.setattr(cli.store, "check_resume", lambda *a, **k: None)
    monkeypatch.setattr(cli, "read_json", fake_read_json)
    monkeypatch.setattr(cli, "_load_words", lambda paths: [])
    region = Region(id="r01", start_i=0, end_i=1, start=0.0, end=30.0, text="t")
    monkeypatch.setattr(cli, "_load_regions", lambda paths: ([region], []))
    monkeypatch.setattr(cli, "load_rubric", lambda path: ("", {"single_take"}, "h"))

    def go(rendered_count: int, top: int = 3) -> int:
        monkeypatch.setattr(cli, "cut_plans",
                            lambda *a, **k: [{"index": n}
                                             for n in range(1, rendered_count + 1)])
        return cli.main(["run", "x.mp4", "--from", "cut", "--top", str(top)])

    return go


def test_all_clips_rendered_exits_zero(run_from_cut):
    assert run_from_cut(3) == 0


def test_no_clips_rendered_exits_nonzero(run_from_cut):
    assert run_from_cut(0) != 0


def test_some_clips_failed_exits_nonzero(run_from_cut):
    assert run_from_cut(2) != 0


def test_asking_for_more_than_exist_is_not_a_failure(run_from_cut):
    """--top 5 with only 3 renderable plans: 3 rendered is everything."""
    assert run_from_cut(3, top=5) == 0
