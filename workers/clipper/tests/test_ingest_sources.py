"""
A URL source must get its own folder, and reuse must check what it is reusing.

Two faults combined into one silent failure. Every URL source was named "video",
and ingest reused whatever artifacts already sat in that folder after checking
only that the files existed. So a second URL run skipped its download and
transcribed the FIRST video's audio -- scored, cut and captioned under the
second video's name, with nothing in the log but "reusing existing artifacts".

Either fix alone would have prevented it; both are pinned here because each
covers a case the other does not (an explicit --name reused across sources
defeats the naming fix; two different URLs defeat nothing once named apart).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.config import paths_for
from clipper.errors import IngestError
from clipper.ingest import _same_source, ingest, name_for_url

A = "https://youtu.be/jBzp-hXRzj4?si=b8AZEv_idMwEu7_L"
B = "https://youtu.be/nuKQ5SyNu_E?si=5XYnHo0P-QPaucUa"


def test_two_urls_get_two_folders():
    assert name_for_url(A) != name_for_url(B)


def test_the_share_token_does_not_change_the_name():
    """?si= differs every time a link is shared; the video does not."""
    assert name_for_url(A) == name_for_url("https://youtu.be/jBzp-hXRzj4")
    assert name_for_url(A) == name_for_url(
        "https://www.youtube.com/watch?v=jBzp-hXRzj4&t=42")


def test_a_name_is_readable_and_filesystem_safe():
    assert name_for_url(A) == "yt-jBzp-hXRzj4"


def test_a_non_youtube_url_still_gets_a_distinct_name():
    one = name_for_url("https://example.com/a.mp4")
    two = name_for_url("https://example.com/b.mp4")
    assert one != two and one.startswith("url-")


@pytest.mark.parametrize("recorded,requested,same", [
    (A, "https://youtu.be/jBzp-hXRzj4", True),
    (A, B, False),
    (A, "C:/videos/test2.mp4", False),
    ("C:/videos/test2.mp4", "C:/videos/test2.mp4", True),
    ("C:/videos/test2.mp4", "C:/videos/test1.mp4", False),
])
def test_same_source(recorded, requested, same):
    assert _same_source(recorded, requested) is same


def plant_artifacts(tmp_path: Path, source: str):
    paths = paths_for("shared", tmp_path)
    paths.ensure()
    paths.audio.write_bytes(b"RIFF")
    paths.meta.write_text(json.dumps({
        "name": "shared", "source": source, "is_url": True, "duration": 7325.0,
        "audio_sha256": "0" * 64, "audio_path": str(paths.audio),
        "media_path": str(paths.work / "source.mp4"), "proxy_path": None,
        "width": 1920, "height": 1080, "fps": 25.0, "has_video": True,
    }), encoding="utf-8")
    return paths


def test_artifacts_from_the_same_source_are_reused(tmp_path):
    paths = plant_artifacts(tmp_path, A)
    meta = ingest("https://youtu.be/jBzp-hXRzj4", paths)
    assert meta.source == A


def test_artifacts_from_a_different_source_are_refused(tmp_path):
    """The failure itself: B must not inherit A's audio."""
    paths = plant_artifacts(tmp_path, A)
    with pytest.raises(IngestError) as err:
        ingest(B, paths)
    message = str(err.value)
    assert "different source" in message
    assert "--name" in message or "--force" in message
