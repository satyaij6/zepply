"""
Style "clean" must render exactly what this tool rendered before styles existed.

The baseline in tests/fixtures/style_a_baseline.json was captured from the
build immediately BEFORE the style system landed -- filter chains, the ASS text
of the day, and the decoded-frame hashes of a real six-second render. Capturing
it afterwards would have recorded whatever the new code does, which guards
nothing.

Two kinds of check, because they fail for different reasons:

* the FILTER CHAINS are compared as strings, which catches a geometry change
  before anything has to be encoded, and runs without media;
* the FRAMES are compared through framemd5, which is the only thing that
  proves the pixels did not move. An MP4 embeds timestamps and encoder
  metadata, so byte-comparing files would fail for reasons that are not
  regressions and the test would end up disabled.

One known difference is asserted rather than hidden: the caption's ASS side
margins are now derived from `captions.max_width` (76px) where they used to be
hardcoded at 60. `build_cues` already bounds cue text to max_width, so no line
can reach either margin -- `test_caption_margins_do_not_change_the_pixels`
renders both and proves the frames are identical.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.captions import Cue, write_ass
from clipper.config import ASSETS_DIR, Settings
from clipper.models import ClipPlan, Span
from clipper.reframe import centre_crop_chain, pad_to_canvas
from clipper.reframe.path import FramePlan, Run
from clipper.reframe.render import build_span_graph

FIXTURE = Path(__file__).parent / "fixtures" / "style_a_baseline.json"
SOURCE = Path(r"C:\Users\satya\Downloads\test1.mp4")

needs_media = pytest.mark.skipif(
    not SOURCE.exists() or shutil.which("ffmpeg") is None,
    reason="reference footage or ffmpeg unavailable",
)


@pytest.fixture(scope="module")
def baseline() -> dict:
    if not FIXTURE.exists():
        pytest.skip(f"no baseline at {FIXTURE}")
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def frame_hashes(video: Path) -> list[str]:
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(video),
         "-map", "0:v", "-f", "framemd5", "-"],
        capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    return [l for l in proc.stdout.splitlines() if l and not l.startswith("#")]


# ----------------------------------------------------------- filter chains

def test_clean_centre_crop_chain_is_unchanged(baseline):
    assert centre_crop_chain(Settings()) == baseline["centre_crop_chain"]


def test_clean_adds_no_padding():
    """Full-bleed means the pad fragment is empty, not a no-op pad filter."""
    assert pad_to_canvas(Settings(style_preset="clean")) == ""


def test_clean_span_graph_is_unchanged(baseline):
    fp = FramePlan(fps=25.0, crop_w=405, crop_h=720, source_w=1280,
                   source_h=720,
                   runs=[Run(0.0, 4.0, "single", "0.0", 0, crop_x=158.0,
                             crop_y=0.0),
                         Run(4.0, 8.0, "single", "0.1", 0, crop_x=611.0,
                             crop_y=0.0)])
    parts, label, used = build_span_graph(fp, Settings(), first_input=0,
                                          label="s0", fps=25)
    assert parts == baseline["span_graph"]
    assert label == baseline["span_label"]
    assert used == baseline["span_inputs"]


# ----------------------------------------------------------------- frames

@needs_media
def test_clean_renders_the_same_frames(baseline):
    """The guard the whole feature is measured against."""
    from clipper.cut import _render_single, _stage_font

    ref = baseline.get("render")
    if not ref:
        pytest.skip("baseline has no render section")

    span = Span(start_word_i=0, end_word_i=1, role="hook")
    span.source_start = ref["start"]
    span.source_end = ref["start"] + ref["duration"]
    plan = ClipPlan(id="p01", format="single_take", theme="t", spans=[span],
                    hook_score=8, coherence_score=7, standalone_score=7,
                    reason="r", suggested_title="t")

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        _stage_font(out)
        video = out / "clean.mp4"
        _render_single(plan, video, out / "unused.ass", SOURCE,
                       Settings(style_preset="clean"), burn_captions=False,
                       out_dir=out, source_size=(1920, 1080))
        rows = frame_hashes(video)

    assert len(rows) == ref["frames"]
    got = hashlib.sha256("\n".join(rows).encode()).hexdigest()
    assert got == ref["framemd5_sha256"], (
        "style 'clean' no longer renders the pre-change frames")


@needs_media
def test_caption_margins_do_not_change_the_pixels(baseline):
    """
    The one intentional difference, proven harmless.

    Side margins moved from a hardcoded 60 to max_width-derived 76. Cue text is
    already bounded below both, so nothing can reach either -- rendered here
    rather than argued.
    """
    old_ass = baseline.get("ass_telugu")
    if not old_ass:
        pytest.skip("baseline has no ass_telugu section")

    cues = [Cue(0.0, 1.0, "Heroes Kodukule Heroes"),
            Cue(1.0, 2.2, "Avvala? Ante")]
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        (out / "fonts").mkdir()
        for style in ("clean",):
            cap = Settings(style_preset=style).layout_style.captions
            shutil.copy(ASSETS_DIR / cap["font"], out / "fonts" / cap["font"])

        (out / "old.ass").write_text(old_ass, encoding="utf-8")
        write_ass(cues, out / "new.ass", Settings(style_preset="clean"),
                  font_size=64)

        rendered = {}
        for name in ("old", "new"):
            dest = out / f"{name}.mp4"
            proc = subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error",
                 "-f", "lavfi", "-i", "color=c=0x203040:s=1080x1920:d=2:r=25",
                 "-vf", f"ass={name}.ass:fontsdir=fonts:shaping=complex",
                 "-frames:v", "40", "-y", dest.name],
                cwd=out, capture_output=True, text=True)
            assert proc.returncode == 0, proc.stderr
            rendered[name] = frame_hashes(dest)

    assert rendered["old"] == rendered["new"], (
        "the max_width-derived caption margins moved the rendered pixels")
