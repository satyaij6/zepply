"""
Promo reels: takes queued ReelJobs and renders them with packages/reels/scripts/render.mjs
(the HyperFrames template the web preview plays), then uploads the MP4.

The queue mirrors the ClipJob one in db.py: FOR UPDATE SKIP LOCKED to claim, the progress
update doubles as the heartbeat, and a RUNNING job whose worker went quiet is requeued.
"""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import psycopg

from .config import REPO_ROOT, Config
from .run import Cancelled, JobFailed, _kill_tree
from .storage import BRAND_ASSETS, REEL_RENDERS, Storage

log = logging.getLogger("worker")

RENDER_SCRIPT = REPO_ROOT / "packages" / "reels" / "scripts" / "render.mjs"
STALE_AFTER = "6 minutes"
MAX_ATTEMPTS = 2
REPORT_EVERY = 2.0  # seconds
TIMEOUT = 15 * 60  # a 30 s reel renders in about 1.5 min on a laptop


@dataclass(frozen=True)
class ReelJob:
    id: str
    user_id: str
    format: str
    length: str
    music: str
    variables: dict
    attempts: int


def claim(conn: psycopg.Connection, worker_id: str) -> ReelJob | None:
    row = conn.execute(
        """
        UPDATE "ReelJob"
           SET status = 'RUNNING'::"ClipJobStatus", "workerId" = %(worker)s, attempts = attempts + 1,
               progress = 0, error = NULL, "startedAt" = now(), "heartbeatAt" = now(), "updatedAt" = now()
         WHERE id = (SELECT id FROM "ReelJob"
                      WHERE status = 'QUEUED'::"ClipJobStatus"
                      ORDER BY "createdAt"
                      FOR UPDATE SKIP LOCKED
                      LIMIT 1)
     RETURNING id, "userId", format, length, music, variables, attempts
        """,
        {"worker": worker_id},
    ).fetchone()
    if not row:
        return None
    variables = row["variables"] if isinstance(row["variables"], dict) else json.loads(row["variables"] or "{}")
    return ReelJob(
        id=row["id"], user_id=row["userId"], format=row["format"], length=row["length"],
        music=row["music"], variables=variables, attempts=row["attempts"],
    )


def report(conn: psycopg.Connection, job_id: str, progress: int) -> bool:
    """Saves progress and doubles as the heartbeat. False means the reel was cancelled meanwhile."""
    cur = conn.execute(
        """
        UPDATE "ReelJob" SET progress = %s, "heartbeatAt" = now(), "updatedAt" = now()
         WHERE id = %s AND status = 'RUNNING'::"ClipJobStatus"
        """,
        (progress, job_id),
    )
    return cur.rowcount == 1


def finish(conn: psycopg.Connection, job_id: str, output_path: str) -> None:
    conn.execute(
        """
        UPDATE "ReelJob"
           SET status = 'DONE'::"ClipJobStatus", progress = 100, error = NULL, "outputPath" = %s,
               "finishedAt" = now(), "heartbeatAt" = now(), "updatedAt" = now()
         WHERE id = %s AND status = 'RUNNING'::"ClipJobStatus"
        """,
        (output_path, job_id),
    )


def fail(conn: psycopg.Connection, job_id: str, message: str) -> None:
    conn.execute(
        """
        UPDATE "ReelJob"
           SET status = 'FAILED'::"ClipJobStatus", error = %s, "finishedAt" = now(), "updatedAt" = now()
         WHERE id = %s AND status = 'RUNNING'::"ClipJobStatus"
        """,
        (message[:1000], job_id),
    )


def release(conn: psycopg.Connection, job_id: str) -> None:
    """Hands a reel back to the queue (the worker is shutting down), without counting the attempt."""
    conn.execute(
        """
        UPDATE "ReelJob"
           SET status = 'QUEUED'::"ClipJobStatus", "workerId" = NULL, progress = 0,
               attempts = GREATEST(attempts - 1, 0), "updatedAt" = now()
         WHERE id = %s AND status = 'RUNNING'::"ClipJobStatus"
        """,
        (job_id,),
    )


def requeue_stale(conn: psycopg.Connection) -> int:
    cur = conn.execute(
        f"""
        UPDATE "ReelJob"
           SET status = CASE WHEN attempts < %(max)s THEN 'QUEUED'::"ClipJobStatus"
                             ELSE 'FAILED'::"ClipJobStatus" END,
               error = CASE WHEN attempts < %(max)s THEN NULL
                            ELSE 'Making this reel stopped unexpectedly. Please try again.' END,
               "workerId" = NULL, "updatedAt" = now()
         WHERE status = 'RUNNING'::"ClipJobStatus" AND "heartbeatAt" < now() - interval '{STALE_AFTER}'
        """,
        {"max": MAX_ATTEMPTS},
    )
    return cur.rowcount


def process(job: ReelJob, cfg: Config, conn, storage: Storage) -> None:
    root = cfg.work_dir / "reels" / job.id
    shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True)
    report(conn, job.id, 2)

    # ---- media: brand-kit paths -> local files -------------------------
    variables = {k: v for k, v in job.variables.items() if isinstance(v, str)}
    owned = f"{job.user_id}/"

    def fetch(path: str, n: int) -> str:
        if not path.startswith(owned):
            raise JobFailed("An image in this reel doesn't belong to this account.")
        dest = root / "media" / f"{n}{Path(path).suffix or '.jpg'}"
        try:
            storage.download(BRAND_ASSETS, path, dest)
        except Exception as exc:
            log.warning("reel %s: could not download %s: %s", job.id, path, exc)
            raise JobFailed("One of your images couldn't be loaded. Try adding it to your brand kit again.") from exc
        return str(dest)

    if variables.get("logo"):
        variables["logo"] = fetch(variables["logo"], 0)
    photos = [p.strip() for p in variables.get("photos", "").split("\n") if p.strip()]
    variables["photos"] = "\n".join(fetch(p, i + 1) for i, p in enumerate(photos[:6]))

    spec = root / "job.json"
    spec.write_text(
        json.dumps({"format": job.format, "length": job.length, "music": job.music, "variables": variables}, ensure_ascii=False),
        encoding="utf-8",
    )
    report(conn, job.id, 5)

    # ---- render ---------------------------------------------------------
    out = root / "reel.mp4"
    log_path = root / "render.log"
    cmd = [cfg.node, str(RENDER_SCRIPT), "--job", str(spec), "--out", str(out), "--workers", str(cfg.render_workers)]
    log.info("reel %s: rendering %s %s", job.id, job.format, job.length)
    started = time.monotonic()
    last_pct = 0
    with open(log_path, "w", encoding="utf-8") as log_file:
        proc = subprocess.Popen(
            cmd, cwd=REPO_ROOT, stdout=subprocess.PIPE, stderr=log_file, text=True, encoding="utf-8",
            start_new_session=os.name != "nt",
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        )
        try:
            last_report = 0.0
            assert proc.stdout is not None
            for line in proc.stdout:
                log_file.write(line)
                m = re.match(r"^(\d{1,3})%$", line.strip())
                if m:
                    last_pct = int(m.group(1))
                now = time.monotonic()
                if now - last_report > REPORT_EVERY:
                    # render progress 0-100 -> 5-95 of the job
                    if not report(conn, job.id, 5 + round(last_pct * 0.9)):
                        raise Cancelled()
                    last_report = now
                if now - started > TIMEOUT:
                    raise JobFailed("This reel took too long to make. Please try again.")
            proc.wait()
        except BaseException:
            _kill_tree(proc)
            raise

    if proc.returncode != 0 or not out.exists():
        tail = log_path.read_text(encoding="utf-8", errors="replace")[-600:]
        log.warning("reel %s: render exited %s: %s", job.id, proc.returncode, tail.strip().splitlines()[-1:] or "")
        if "media not found" in tail or "could not download" in tail:
            raise JobFailed("One of your images couldn't be loaded. Try adding it to your brand kit again.")
        raise JobFailed("Something went wrong while making this reel. Please try again.")

    # ---- upload ---------------------------------------------------------
    report(conn, job.id, 97)
    key = f"{job.user_id}/{job.id}.mp4"
    storage.upload(REEL_RENDERS, key, out, "video/mp4")
    finish(conn, job.id, key)
    log.info("reel %s: done in %.0fs", job.id, time.monotonic() - started)
    shutil.rmtree(root, ignore_errors=True)
