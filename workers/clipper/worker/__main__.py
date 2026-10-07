"""
Zepply worker: takes queued jobs from the database and runs them.

    python -m worker            from workers/clipper, with settings in .env (see worker/config.py)

Two queues: promo reels (ReelJob, a couple of minutes each, taken first) and long-video
clips (ClipJob). ZEPPLY_JOBS picks which ones this machine works. One job at a time;
Ctrl+C hands a running job back to the queue instead of failing it.
"""
from __future__ import annotations

import logging
import sys
import time

import psycopg
import truststore

from . import db, reels
from .config import Config, ConfigError
from .run import Cancelled, JobFailed, process
from .storage import Storage

log = logging.getLogger("worker")
STALE_CHECK_EVERY = 60.0  # seconds


def main() -> int:
    truststore.inject_into_ssl()  # trust the OS certificate store (antivirus HTTPS scanning)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s")
    try:
        cfg = Config.from_env()
    except ConfigError as exc:
        log.error("%s", exc)
        return 2

    storage = Storage(cfg.supabase_url, cfg.service_key)
    log.info(
        "worker %s ready (%s); work dir %s; polling every %ss",
        cfg.worker_id, ", ".join(sorted(cfg.jobs)), cfg.work_dir, cfg.poll_seconds,
    )

    conn = None
    last_stale_check = 0.0
    while True:
        job = None
        kind = None
        try:
            if conn is None or conn.closed:
                conn = db.connect(cfg.database_url)
            if time.monotonic() - last_stale_check > STALE_CHECK_EVERY:
                requeued = (db.requeue_stale(conn) if "clips" in cfg.jobs else 0) + (
                    reels.requeue_stale(conn) if "reels" in cfg.jobs else 0
                )
                if requeued:
                    log.warning("requeued or failed %d stalled job(s)", requeued)
                last_stale_check = time.monotonic()

            if "reels" in cfg.jobs and (job := reels.claim(conn, cfg.worker_id)):
                kind = "reel"
                log.info("reel %s: claimed (attempt %d)", job.id, job.attempts)
                reels.process(job, cfg, conn, storage)
            elif "clips" in cfg.jobs and (job := db.claim(conn, cfg.worker_id)):
                kind = "clip"
                log.info("job %s: claimed (attempt %d)", job.id, job.attempts)
                process(job, cfg, conn, storage)
            else:
                time.sleep(cfg.poll_seconds)

        except KeyboardInterrupt:
            if job and conn and not conn.closed:
                (reels.release if kind == "reel" else db.release)(conn, job.id)
                log.info("%s %s: handed back to the queue", kind, job.id)
            log.info("stopped")
            return 0
        except Cancelled:
            log.info("%s %s: cancelled", kind, job.id if job else "?")
        except JobFailed as exc:
            log.warning("%s %s: failed: %s", kind, job.id if job else "?", exc)
            if job:
                (reels.fail if kind == "reel" else db.fail)(conn, job.id, str(exc))
        except psycopg.OperationalError as exc:
            log.error("database unavailable (%s); retrying shortly", exc)
            conn = None
            time.sleep(cfg.poll_seconds)
        except Exception:
            log.exception("%s %s: unexpected error", kind, job.id if job else "?")
            if job and conn and not conn.closed:
                if kind == "reel":
                    reels.fail(conn, job.id, "Something went wrong while making this reel. Please try again.")
                else:
                    db.fail(conn, job.id, "Something went wrong while processing this video. Please try again.")


if __name__ == "__main__":
    sys.exit(main())
