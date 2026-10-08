"""
The analysis bundle: what it takes to re-render one clip in another style.

Transcription, scoring and face detection are the slow and paid parts of a
run; a restyle needs none of them again. After a run the worker packs the
results here into one archive, and `clipper restyle` unpacks it next to a
freshly fetched source and renders a single clip.

The proxy travels with the bundle because the face cache is keyed by the
proxy's own hash: a proxy re-encoded from the source would not match, and
detection would run again from scratch.
"""
from __future__ import annotations

import json
import logging
import shutil
import tarfile
from pathlib import Path

from .config import CACHE_DIR, Paths

log = logging.getLogger(__name__)

WORK_FILES = ("transcript.json", "regions.json", "scores.json", "plans.json", "boundaries.json",
              "ranked.json", "faces.json", "scenes.json", "postkit.json", "proxy.mp4")
CACHE_GLOBS = ("panels_*.json", "broll_*.json")
ASR_NAME = "asr.json"


def make(paths: Paths, dest: Path) -> Path:
    """Pack a finished run's analysis into `dest` (.tar.gz)."""
    meta = json.loads(paths.meta.read_text(encoding="utf-8"))
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(dest, "w:gz") as tar:
        for name in WORK_FILES:
            f = paths.work / name
            if f.exists():
                tar.add(f, arcname=name)
        for pattern in CACHE_GLOBS:
            for f in paths.work.glob(pattern):
                tar.add(f, arcname=f.name)
        asr = CACHE_DIR / f"{meta.get('audio_sha256')}.json"
        if asr.exists():
            tar.add(asr, arcname=ASR_NAME)
    log.info("bundle: %s (%.1f MB)", dest.name, dest.stat().st_size / 1e6)
    return dest


def unpack(archive_or_dir: Path, paths: Paths, *, audio_sha256: str) -> None:
    """Lay a bundle into a fresh run's work/ (and the ASR turns into the cache)."""
    src = archive_or_dir
    if src.is_file():
        out = paths.root / "_bundle"
        shutil.rmtree(out, ignore_errors=True)
        out.mkdir(parents=True)
        with tarfile.open(src, "r:gz") as tar:
            tar.extractall(out, filter="data")
        src = out
    paths.ensure()
    for f in src.iterdir():
        if f.name == ASR_NAME:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copy(f, CACHE_DIR / f"{audio_sha256}.json")
        elif f.is_file():
            shutil.copy(f, paths.work / f.name)


def kit_for_rank(paths: Paths, rank: int) -> dict | None:
    """The original post kit, re-keyed so the one re-rendered clip keeps its copy."""
    cache = paths.work / "postkit.json"
    if not cache.exists():
        return None
    try:
        kit = json.loads(cache.read_text(encoding="utf-8"))["kit"]
    except (json.JSONDecodeError, KeyError):
        return None
    clip = (kit.get("clips") or {}).get(str(rank))
    return {"clips": {"1": clip} if clip else {}, "source": kit.get("source")}
