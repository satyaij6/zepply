"""
Runs one ClipJob: fetch the source, run the unchanged clipper CLI as a child process,
report progress from the stage files it writes, then upload the clips it rendered.

Running the CLI as a subprocess (rather than importing it) keeps the worker alive when a
render runs out of memory, and lets a cancelled job be stopped by killing one process.
"""
from __future__ import annotations

import json
import logging
import os
import re
import signal
import shutil
import subprocess
import sys
import time
from pathlib import Path

from . import db
from .config import CLIPPER_ROOT, Config
from .storage import RENDERS, SOURCES, Storage

log = logging.getLogger("worker")

# Stage files the clipper writes under <job>/work, in order, and the progress (0-100)
# to show once each exists. Transcription is by far the longest step.
STAGES = [
    ("meta.json", "transcribing", 10),
    ("transcript.json", "finding_moments", 45),
    ("ranked.json", "rendering", 68),
]
RENDER_SPAN = (68, 95)  # progress while clips are being encoded
REPORT_EVERY = 3.0  # seconds


class Cancelled(Exception):
    pass


class JobFailed(Exception):
    """A failure to show the user as-is."""


def process(job: db.Job, cfg: Config, conn, storage: Storage) -> None:
    root = cfg.work_dir / "jobs" / job.id
    shutil.rmtree(root, ignore_errors=True)  # a retried job starts clean
    root.mkdir(parents=True)
    log_path = root / "clipper.log"

    if job.language != "te":
        raise JobFailed("Only Telugu is supported right now.")

    # ---- source ------------------------------------------------------
    if job.source_kind == "UPLOAD":
        if not job.source_path:
            raise JobFailed("The uploaded file is missing.")
        db.report(conn, job.id, "preparing", 2)
        source = str(storage.download(SOURCES, job.source_path, root / "source" / Path(job.source_path).name))
    else:
        source = job.source_url or ""  # the clipper downloads links itself (yt-dlp)

    # ---- clipper -----------------------------------------------------
    out_dir = root / "out"
    if job.parent_job_id:
        # A restyle reuses the original job's analysis; only one clip is rendered.
        if not job.parent_bundle or not job.only_rank:
            raise JobFailed("This video was made before restyling existed. Make it again to try other styles.")
        bundle_file = storage.download(RENDERS, job.parent_bundle, root / "bundle.tar.gz")
        head = ["restyle", source, "--bundle", str(bundle_file), "--rank", str(job.only_rank), "--name", "clips"]
    else:
        head = ["run", source, "--name", "clips", "--top", str(job.clip_count), "--device", cfg.device]
    cmd = [
        sys.executable, "-m", "clipper.cli", "--out", str(out_dir), *head,
        "--style", "clean" if job.style == "none" else job.style,
        "--caption-pos", job.caption_pos,
        "--layout", job.layout if job.layout in ("auto", "screen", "single") else "auto",
    ]
    if not job.effects:
        cmd.append("--no-effects")
    if job.niche:
        cmd += ["--niche", job.niche]
    if job.style == "none":
        cmd.append("--no-captions")
    if job.broll:
        cmd += ["--broll", "--look", job.broll_look if job.broll_look in ("editorial", "explainer", "signal") else "editorial"]
    if job.card_layout:
        cmd.append("--card")
    if job.cta_keyword and re.fullmatch(r"[A-Za-z0-9]{2,16}", job.cta_keyword):
        cmd += ["--cta-keyword", job.cta_keyword]
    if job.accent and re.fullmatch(r"#[0-9a-fA-F]{6}", job.accent):
        # The pen, the end card and the brand canvas all start from the Brand Kit accent.
        cmd += ["--accent", job.accent]
    log.info("job %s: running clipper (%d clips, style %s)", job.id, job.clip_count, job.style)
    clips_dir = out_dir / "clips"
    with open(log_path, "w", encoding="utf-8") as log_file:
        # Its own process group, so stopping it also stops the ffmpeg encodes it started
        proc = subprocess.Popen(cmd, cwd=CLIPPER_ROOT, stdout=log_file, stderr=subprocess.STDOUT,
                                start_new_session=os.name != "nt",
                                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0)
        try:
            while proc.poll() is None:
                stage, progress = _progress(clips_dir, job.clip_count)
                if not db.report(conn, job.id, stage, progress):
                    raise Cancelled()
                time.sleep(REPORT_EVERY)
        except BaseException:
            _kill_tree(proc)
            raise

    if proc.returncode != 0:
        detail = _last_error(log_path)
        log.warning("job %s: clipper exited %s: %s", job.id, proc.returncode, detail)
        raise JobFailed(_explain(detail))

    # ---- results -----------------------------------------------------
    manifest = json.loads((clips_dir / "clips.json").read_text(encoding="utf-8"))
    db.report(conn, job.id, "uploading", 96)
    clips = [_upload_clip(entry, job, clips_dir, storage) for entry in manifest["clips"]]
    meta = json.loads((clips_dir / "work" / "meta.json").read_text(encoding="utf-8"))
    bundle_path = None
    if not job.parent_job_id:
        # Saved so any clip of this job can be restyled later without re-analysing.
        try:
            from clipper import bundle
            from clipper.config import paths_for

            archive = bundle.make(paths_for("clips", out_dir), root / "bundle.tar.gz")
            bundle_path = storage.upload(RENDERS, f"{job.user_id}/{job.id}/bundle.tar.gz", archive,
                                         "application/gzip")
        except Exception as exc:  # noqa: BLE001 - restyling is a bonus; the clips are done
            log.warning("job %s: could not save the analysis bundle: %s", job.id, exc)
    db.finish(conn, job.id, clips, round(meta.get("duration") or 0) or None,
              manifest.get("source_kit"), bundle_path=bundle_path, parent_job_id=job.parent_job_id)
    log.info("job %s: done, %d clips", job.id, len(clips))

    # Sources and renders are in storage now; keep the disk for the next job
    shutil.rmtree(root, ignore_errors=True)


def _kill_tree(proc: subprocess.Popen) -> None:
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True, check=False)
    else:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    proc.wait()


def _progress(clips_dir: Path, clip_count: int) -> tuple[str, int]:
    stage, progress = "preparing", 5
    for filename, next_stage, value in STAGES:
        if (clips_dir / "work" / filename).exists():
            stage, progress = next_stage, value
    if stage == "rendering":
        done = len(list(clips_dir.glob("clip_*.mp4")))
        low, high = RENDER_SPAN
        progress = low + round((high - low) * min(done, clip_count) / max(clip_count, 1))
    return stage, progress


def _upload_clip(entry: dict, job: db.Job, clips_dir: Path, storage: Storage) -> dict:
    index = int(entry["index"])
    rank = job.only_rank or index  # a restyle renders one clip as clip_01 but keeps its rank
    video = Path(entry["video_path"])
    srt = Path(entry["srt_path"]) if entry.get("srt_path") else None
    cover = Path(entry["cover_path"]) if entry.get("cover_path") else None
    thumb = clips_dir / f"clip_{index:02d}.jpg"
    _thumbnail(video, thumb)

    prefix = f"{job.user_id}/{job.id}/clip_{rank:02d}"
    return {
        "rank": rank,
        "title": entry.get("suggested_title") or entry.get("theme") or f"Clip {rank}",
        "theme": entry.get("theme"),
        "reason": entry.get("reason"),
        "format": entry.get("format"),
        "hook": entry.get("hook_score"),
        "standalone": entry.get("standalone_score"),
        "coherence": entry.get("coherence_score"),
        "final": entry.get("final_score"),
        "duration": _duration(video),
        "video": storage.upload(RENDERS, f"{prefix}.mp4", video, "video/mp4"),
        "captions": storage.upload(RENDERS, f"{prefix}.srt", srt, "application/x-subrip") if srt and srt.exists() else None,
        "thumb": storage.upload(RENDERS, f"{prefix}.jpg", thumb, "image/jpeg") if thumb.exists() else None,
        "cover": storage.upload(RENDERS, f"{prefix}_cover.jpg", cover, "image/jpeg") if cover and cover.exists() else None,
        "titles": [t for t in entry.get("titles") or [] if isinstance(t, str)][:5],
        "caption": entry.get("caption") or None,
        "hashtags": [t for t in entry.get("hashtags") or [] if isinstance(t, str)][:10],
    }


def _thumbnail(video: Path, dest: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", str(video), "-frames:v", "1",
         "-vf", "scale=540:-2", "-q:v", "3", str(dest)],
        check=False,
    )


def _duration(video: Path) -> float | None:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(video)],
        capture_output=True, text=True, check=False,
    )
    try:
        return round(float(out.stdout.strip()), 2)
    except ValueError:
        return None


# The clipper's failures that mean something to a user, in their words. Anything else is
# reported generically (the full line is in the worker log).
FRIENDLY_ERRORS = [
    (r"nothing survived the prefilter", "We couldn't find enough clear speech to make clips. Try a video with more talking."),
    (r"every plan was rejected", "No strong moments stood out in this video. Try a longer or more conversational one."),
    (r"is only [\d.]+s long", "The video is too short. It needs to be at least 30 seconds long."),
    (r"only \d+ of \d+ clips rendered", "Some clips couldn't be rendered. Please try again."),
    (r"could not download", "We couldn't download that link. Check that it's public, or upload the file instead."),
]


def _explain(detail: str | None) -> str:
    for pattern, message in FRIENDLY_ERRORS:
        if re.search(pattern, detail or "", re.IGNORECASE):
            return message
    return "Processing failed. Please try again, and contact us if it keeps happening."


def _last_error(log_path: Path) -> str | None:
    """The clipper's last ERROR line, without the log prefix."""
    errors = [line for line in log_path.read_text(encoding="utf-8", errors="replace").splitlines() if line.startswith("ERROR")]
    if not errors:
        return None
    return re.sub(r"^ERROR\s+\S+:\s*", "", errors[-1]).strip()
