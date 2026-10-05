"""
The only module that shells out to ffmpeg/ffprobe.

Two Windows-specific traps are handled here rather than scattered:

1. The subtitles/ass filter treats ':' as an argument separator, so an absolute
   Windows path (C:\\Users\\...) breaks the filtergraph. Every call that passes a
   subtitle file runs with cwd set to the file's directory and a bare relative
   filename.
2. Font lookup by family name goes through fontconfig, which is unreliable on
   Windows and silently substitutes a font with no Telugu coverage. We always
   pass an explicit fontsdir pointing at the pinned .ttf.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path

from .errors import FFmpegError


def _binary(name: str) -> str:
    path = shutil.which(name)
    if path is None:
        raise FFmpegError(
            f"{name} is not on PATH",
            hint="Install ffmpeg (built with libass) and reopen the shell. See SETUP.md.",
        )
    return name


def run(args: list[str], *, cwd: Path | None = None, what: str = "ffmpeg") -> str:
    """Run ffmpeg, raising with its stderr attached -- never a bare exit code."""
    cmd = [_binary("ffmpeg"), "-hide_banner", "-loglevel", "error", "-y", *args]
    proc = subprocess.run(
        cmd, cwd=str(cwd) if cwd else None, capture_output=True, text=True
    )
    if proc.returncode != 0:
        raise FFmpegError(
            f"{what} failed (exit {proc.returncode})",
            hint=(proc.stderr or proc.stdout or "").strip()[:800] or "no stderr",
        )
    return proc.stdout


@lru_cache(maxsize=1)
def filters() -> frozenset[str]:
    out = subprocess.run(
        [_binary("ffmpeg"), "-hide_banner", "-filters"], capture_output=True, text=True
    ).stdout
    names = set()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 2 and not line.startswith("Filters"):
            names.add(parts[1])
    return frozenset(names)


def ensure_caption_stack(font_path: Path) -> None:
    """
    Preflight before burning anything. Failing here costs a second; failing
    silently means five clips with decomposed Telugu clusters.
    """
    if "ass" not in filters():
        raise FFmpegError(
            "This ffmpeg has no 'ass' filter (built without --enable-libass)",
            hint=(
                "Telugu conjuncts cannot render correctly without libass + "
                "libharfbuzz + libfribidi. Install a full ffmpeg build."
            ),
        )
    if not font_path.exists():
        raise FFmpegError(
            f"Pinned caption font missing: {font_path}",
            hint="See SETUP.md for the Noto Sans Telugu download step.",
        )


def probe(path: Path) -> dict:
    """ffprobe -> dict. Raises with context rather than returning junk."""
    cmd = [
        _binary("ffprobe"), "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", str(path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise FFmpegError(
            f"ffprobe could not read {path.name}",
            hint=(proc.stderr or "").strip()[:400],
        )
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise FFmpegError(f"ffprobe returned unparseable JSON for {path.name}") from exc


def duration_seconds(path: Path) -> float:
    info = probe(path)
    fmt = info.get("format", {})
    if "duration" in fmt:
        return float(fmt["duration"])
    for stream in info.get("streams", []):
        if "duration" in stream:
            return float(stream["duration"])
    raise FFmpegError(
        f"No duration reported for {path.name}",
        hint="The file may be truncated or still being written.",
    )


def video_stream(path: Path) -> dict | None:
    for stream in probe(path).get("streams", []):
        if stream.get("codec_type") == "video":
            return stream
    return None


def extract_audio(src: Path, dest: Path, *, sample_rate: int = 16000) -> Path:
    """16kHz mono PCM -- what Sarvam documents and what RMS analysis expects."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(
        ["-i", str(src), "-vn", "-ac", "1", "-ar", str(sample_rate),
         "-c:a", "pcm_s16le", str(dest)],
        what=f"audio extraction from {src.name}",
    )
    if not dest.exists() or dest.stat().st_size < 1024:
        raise FFmpegError(
            f"Audio extraction produced no usable output for {src.name}",
            hint="Does the source actually contain an audio stream?",
        )
    return dest


def make_proxy(src: Path, dest: Path, *, height: int = 480) -> Path:
    """
    Low-res analysis proxy. Nothing in v1 consumes it -- prefilter is audio-only
    and cut.py reads the original for output quality. It exists for the
    speaker-tracked reframe later, and for scrubbing clips by hand quickly.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(
        ["-i", str(src), "-an",
         "-vf", f"scale=-2:{height}",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
         str(dest)],
        what=f"proxy render for {src.name}",
    )
    return dest


def slice_audio(src: Path, dest: Path, start: float, duration: float) -> Path:
    """Cut a window out of the wav for chunked ASR."""
    run(
        ["-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(src),
         "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(dest)],
        what=f"audio slice {start:.1f}s +{duration:.1f}s",
    )
    return dest
