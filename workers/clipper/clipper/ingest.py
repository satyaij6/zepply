"""
Stage 1: source -> 16kHz mono wav + low-res analysis proxy + meta.json.

Accepts a local file or a YouTube URL. The wav is what every later stage
measures against (RMS energy, ASR), so it is the artifact whose hash keys the
transcript cache: same audio, same transcript, no second API call.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass, fields
from pathlib import Path

from . import ffmpeg
from .config import Paths
from .errors import IngestError

log = logging.getLogger(__name__)

_URL = re.compile(r"^[a-z][a-z0-9+.-]*://", re.I)


@dataclass
class Meta:
    name: str
    source: str
    is_url: bool
    duration: float
    audio_sha256: str
    audio_path: str
    # The local file cut.py reads. For URL sources this is the downloaded copy,
    # not the URL -- `source` keeps the original reference for provenance.
    media_path: str
    proxy_path: str | None
    width: int | None = None
    height: int | None = None
    fps: float | None = None
    has_video: bool = True

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Meta":
        """
        Tolerate meta.json written by an older version.

        A field added later must not make every existing work/ directory
        un-resumable -- that would force a full re-ingest and re-transcribe to
        recover from a schema change alone.
        """
        known = {f.name for f in fields(cls)}
        data = {k: v for k, v in d.items() if k in known}
        missing = known - set(data)
        if "media_path" in missing:
            # Pre-dating the field: for a local source the path is the source.
            data["media_path"] = "" if d.get("is_url") else d.get("source", "")
            missing.discard("media_path")
        if missing:
            raise IngestError(
                f"meta.json is missing {sorted(missing)}",
                hint="Re-run --from ingest to rebuild it.",
            )
        return cls(**data)


def slugify(value: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE).strip().lower()
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug[:60].strip("-") or "video"


def is_url(source: str) -> bool:
    return bool(_URL.match(source))


_YT_ID = re.compile(r"(?:youtu\.be/|[?&]v=|/shorts/|/live/)([A-Za-z0-9_-]{11})")


def _same_source(recorded: str, requested: str) -> bool:
    """Whether two source references name the same media."""
    if is_url(recorded) and is_url(requested):
        a, b = _YT_ID.search(recorded), _YT_ID.search(requested)
        if a and b:
            return a.group(1) == b.group(1)   # share links differ in ?si=...
        return recorded == requested
    if is_url(recorded) or is_url(requested):
        return False
    try:
        return Path(recorded).expanduser().resolve() == Path(requested).expanduser().resolve()
    except OSError:
        return recorded == requested


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while block := fh.read(chunk):
            h.update(block)
    return h.hexdigest()


def _parse_fps(rate: str | None) -> float | None:
    if not rate or "/" not in rate:
        return None
    num, den = rate.split("/", 1)
    try:
        den_f = float(den)
        return float(num) / den_f if den_f else None
    except ValueError:
        return None


# Best video up to 1080p, preferring H.264. Uncapped "bv*" pulls 2160p for
# most podcasts: a two-hour episode is then many gigabytes, and every decode
# downstream -- detection over the whole proxy, then each render -- runs on
# VP9 or AV1 at four times the pixels. The output is 1080 wide, so a 1080p
# source is native for an inset box and a mild upscale for a full-bleed crop.
DOWNLOAD_FORMAT = ("bv*[height<=1080][vcodec^=avc1]+ba[ext=m4a]"
                   "/bv*[height<=1080]+ba/b[height<=1080]/b")


def name_for_url(url: str) -> str:
    """
    A stable, distinct folder name for a URL source.

    Every URL used to become "video". With ingest reusing whatever artifacts
    already sit in a folder, a second URL run then SKIPPED its download and
    transcribed the first video's audio under the second video's name -- no
    error, just the wrong clips. The YouTube id makes each source its own
    folder; anything else falls back to a hash of the URL.
    """
    import hashlib

    match = _YT_ID.search(url)
    if match:
        return f"yt-{match.group(1)}"
    return "url-" + hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]


def download(url: str, dest_dir: Path) -> Path:
    """Fetch a remote source with yt-dlp. Video included -- cut.py needs pixels."""
    try:
        import yt_dlp  # noqa: F401 - presence check only
    except ImportError:
        raise IngestError(
            "yt-dlp is not installed, so URL sources cannot be fetched",
            hint="pip install yt-dlp  (or pass a local file path instead)",
        ) from None
    dest_dir.mkdir(parents=True, exist_ok=True)
    template = str(dest_dir / "source.%(ext)s")
    proc = subprocess.run(
        # Through clipper._ytdlp, not a `yt-dlp` executable: that wrapper
        # verifies TLS against the OS store (antivirus HTTPS interception
        # breaks certifi here) and does not depend on PATH.
        [sys.executable, "-m", "clipper._ytdlp", "--no-warnings",
         "-f", DOWNLOAD_FORMAT, "--merge-output-format", "mp4",
         "-o", template, url],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise IngestError(
            f"yt-dlp could not download {url}",
            hint=(proc.stderr or "").strip()[-600:],
        )
    files = sorted(dest_dir.glob("source.*"))
    if not files:
        raise IngestError(f"yt-dlp reported success but wrote no file for {url}")
    return files[0]


def resolve_name(source: str, downloaded: Path | None) -> str:
    if downloaded is not None:
        return slugify(downloaded.stem)
    return slugify(Path(source).stem)


def ingest(
    source: str,
    paths: Paths,
    *,
    make_proxy: bool = True,
    proxy_height: int = 480,
    force: bool = False,
) -> Meta:
    """
    Produce audio.wav (+ proxy.mp4) and meta.json under paths.work.

    Re-running is cheap: if the artifacts already exist and `force` is False,
    the existing meta is returned untouched.
    """
    paths.ensure()

    if paths.meta.exists() and paths.audio.exists() and not force:
        existing = Meta.from_dict(json.loads(paths.meta.read_text(encoding="utf-8")))
        # Reuse is only safe when the artifacts came from THIS source. Checking
        # file presence alone let a second video silently inherit the first
        # one's audio, transcript and clips.
        if _same_source(existing.source, source):
            log.info("ingest: reusing existing artifacts in %s", paths.work)
            return existing
        raise IngestError(
            f"{paths.work} already holds artifacts for a different source",
            hint=(f"It was made from {existing.source}, not {source}. Use a "
                  f"different --name, or --force to replace it."),
        )

    tmpdir: tempfile.TemporaryDirectory | None = None
    try:
        if is_url(source):
            tmpdir = tempfile.TemporaryDirectory()
            log.info("ingest: downloading %s", source)
            media = download(source, Path(tmpdir.name))
            kept = paths.work / f"source{media.suffix}"
            shutil.move(str(media), kept)
            media = kept
        else:
            media = Path(source).expanduser()
            if not media.exists():
                raise IngestError(
                    f"No such file: {media}",
                    hint="Pass an existing path, or a URL starting with https://",
                )

        duration = ffmpeg.duration_seconds(media)
        if duration < 30:
            raise IngestError(
                f"{media.name} is only {duration:.1f}s long",
                hint="Candidate windows are 20-75s; a source this short has nothing to rank.",
            )

        log.info("ingest: extracting audio (%.1fs source)", duration)
        ffmpeg.extract_audio(media, paths.audio)

        vstream = ffmpeg.video_stream(media)
        proxy_path: str | None = None
        if vstream is None:
            log.warning("ingest: %s has no video stream; skipping proxy", media.name)
        elif make_proxy:
            log.info("ingest: rendering %dp analysis proxy", proxy_height)
            ffmpeg.make_proxy(media, paths.proxy, height=proxy_height)
            proxy_path = str(paths.proxy)

        meta = Meta(
            name=paths.name,
            source=str(source),
            is_url=is_url(source),
            duration=duration,
            audio_sha256=sha256_file(paths.audio),
            audio_path=str(paths.audio),
            media_path=str(media),
            proxy_path=proxy_path,
            width=int(vstream["width"]) if vstream and "width" in vstream else None,
            height=int(vstream["height"]) if vstream and "height" in vstream else None,
            fps=_parse_fps(vstream.get("r_frame_rate")) if vstream else None,
            has_video=vstream is not None,
        )
        paths.meta.write_text(
            json.dumps(meta.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8"
        )
        log.info("ingest: done -> %s", paths.audio)
        return meta
    finally:
        if tmpdir is not None:
            tmpdir.cleanup()
