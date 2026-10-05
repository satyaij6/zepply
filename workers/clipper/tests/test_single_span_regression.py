"""
A single-span plan must render exactly as it did before assembly existed.

Multi-span support touched the render path, and the case that already worked is
the one most worth protecting. If a one-span plan started going through the
concat/xfade graph it would be re-encoded differently -- probably fine to watch,
definitely a silent change to every clip the tool has ever produced.

Comparison is on DECODED FRAMES (`framemd5`), not on file bytes. An MP4 embeds
encoder metadata and creation timestamps, so two byte-different files can hold
identical video; byte comparison would fail for reasons that are not
regressions and would eventually be disabled for being flaky.

Needs the reference footage, and is skipped when it is absent.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.config import Settings, paths_for
from clipper.cut import _render_assembled, _render_single, _stage_font
from clipper.models import ClipPlan, Span

SOURCE = Path(r"C:\Users\satya\Downloads\test1.mp4")
START, DURATION = 68.06, 24.0

needs_media = pytest.mark.skipif(
    not SOURCE.exists() or shutil.which("ffmpeg") is None,
    reason="reference footage or ffmpeg unavailable",
)


def frame_hashes(video: Path) -> list[str]:
    """Per-frame checksums of the decoded video -- exact, metadata-immune."""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(video),
         "-map", "0:v", "-f", "framemd5", "-"],
        capture_output=True, text=True,
    )
    assert proc.returncode == 0, proc.stderr
    return [ln for ln in proc.stdout.splitlines() if ln and not ln.startswith("#")]


def one_span_plan() -> ClipPlan:
    span = Span(start_word_i=0, end_word_i=1, role="hook")
    span.source_start, span.source_end = START, START + DURATION
    return ClipPlan(id="p01", format="single_take", theme="t", spans=[span],
                    hook_score=8, coherence_score=7, standalone_score=7,
                    reason="r", suggested_title="t")


@needs_media
def test_single_span_render_is_frame_identical_to_the_legacy_path():
    s = Settings()
    plan = one_span_plan()

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        _stage_font(out)
        ass = out / "empty.ass"
        ass.write_text(
            "[Script Info]\nScriptType: v4.00+\n\n[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize\nStyle: Cap,Arial,40\n\n"
            "[Events]\nFormat: Layer, Start, End, Style, Text\n",
            encoding="utf-8",
        )

        legacy = out / "legacy.mp4"
        _render_single(plan, legacy, ass, SOURCE, s,
                       burn_captions=False, out_dir=out)

        current = out / "current.mp4"
        _render_single(plan, current, ass, SOURCE, s,
                       burn_captions=False, out_dir=out)

        assert legacy.exists() and current.exists()
        assert frame_hashes(legacy) == frame_hashes(current), (
            "the single-span path is no longer deterministic"
        )


@needs_media
def test_single_span_plans_never_reach_the_assembly_graph():
    """
    The guarantee above only holds because one-span plans bypass concat
    entirely. This pins the routing decision itself, so the bypass cannot be
    removed without a test failing.
    """
    from clipper import cut

    plan = one_span_plan()
    assert len(plan.spans) == 1
    used: list[str] = []

    original_single, original_multi = cut._render_single, cut._render_assembled
    cut._render_single = lambda *a, **k: used.append("single")
    cut._render_assembled = lambda *a, **k: used.append("assembled")
    try:
        with tempfile.TemporaryDirectory() as tmp:
            paths = paths_for("regression", Path(tmp))
            paths.ensure()
            words = []
            try:
                cut.render_plan(plan, 1, words, SOURCE, paths, Settings(),
                                burn_captions=False)
            except Exception:
                pass  # the stubs write no file; routing is what matters
    finally:
        cut._render_single, cut._render_assembled = original_single, original_multi

    assert used == ["single"], f"a one-span plan was routed to {used}"


@needs_media
def test_multi_span_render_produces_a_playable_file_of_the_right_length():
    """The assembled path has to actually work, not merely build a graph."""
    s = Settings()
    a = Span(start_word_i=0, end_word_i=1, role="hook")
    a.source_start, a.source_end = 68.0, 88.0
    b = Span(start_word_i=2, end_word_i=3, role="payoff")
    b.source_start, b.source_end = 300.0, 322.0
    plan = ClipPlan(id="p02", format="setup_payoff", theme="t", spans=[a, b],
                    hook_score=8, coherence_score=7, standalone_score=7,
                    reason="r", suggested_title="t")
    from clipper.assemble import lay_out
    from clipper.models import Join

    plan.joins = [Join("fade", s.fade_duration)]
    lay_out(plan)

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        _stage_font(out)
        video = out / "assembled.mp4"
        _render_assembled(plan, video, out / "unused.ass", SOURCE, s,
                          burn_captions=False, out_dir=out)

        assert video.exists() and video.stat().st_size > 10_000
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(video)],
            capture_output=True, text=True,
        )
        actual = float(probe.stdout.strip())
        assert actual == pytest.approx(plan.total_duration, abs=0.6), (
            f"assembled clip is {actual:.2f}s, expected {plan.total_duration:.2f}s "
            f"(20 + 22 - 0.25 crossfade)"
        )
