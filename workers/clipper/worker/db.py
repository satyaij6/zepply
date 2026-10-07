"""
The job queue is the ClipJob table (schema in apps/web/prisma/schema.prisma).

Claiming uses FOR UPDATE SKIP LOCKED, so any number of workers can poll the same
table without two of them taking one job. Enum values are written as SQL literals
with explicit casts: a bound text parameter can't be assigned to an enum column.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

import psycopg
from psycopg.rows import dict_row

# A RUNNING job whose worker hasn't checked in for this long is assumed dead.
STALE_AFTER = "10 minutes"
MAX_ATTEMPTS = 2


@dataclass(frozen=True)
class Job:
    id: str
    user_id: str
    source_kind: str  # UPLOAD | YOUTUBE
    source_path: str | None
    source_url: str | None
    language: str
    clip_count: int
    style: str
    caption_pos: str
    attempts: int


def connect(url: str) -> psycopg.Connection:
    return psycopg.connect(url, autocommit=True, row_factory=dict_row, connect_timeout=15)


def claim(conn: psycopg.Connection, worker_id: str) -> Job | None:
    row = conn.execute(
        """
        UPDATE "ClipJob"
           SET status = 'RUNNING'::"ClipJobStatus", "workerId" = %(worker)s, attempts = attempts + 1,
               stage = 'preparing', progress = 0, error = NULL,
               "startedAt" = now(), "heartbeatAt" = now(), "updatedAt" = now()
         WHERE id = (SELECT id FROM "ClipJob"
                      WHERE status = 'QUEUED'::"ClipJobStatus"
                      ORDER BY "createdAt"
                      FOR UPDATE SKIP LOCKED
                      LIMIT 1)
     RETURNING id, "userId", "sourceKind"::text AS kind, "sourcePath", "sourceUrl",
               language, "clipCount", style, "captionPos", attempts
        """,
        {"worker": worker_id},
    ).fetchone()
    if not row:
        return None
    return Job(
        id=row["id"], user_id=row["userId"], source_kind=row["kind"], source_path=row["sourcePath"],
        source_url=row["sourceUrl"], language=row["language"], clip_count=row["clipCount"],
        style=row["style"], caption_pos=row["captionPos"], attempts=row["attempts"],
    )


def report(conn: psycopg.Connection, job_id: str, stage: str, progress: int) -> bool:
    """Saves progress and doubles as the heartbeat. False means the job was cancelled meanwhile."""
    cur = conn.execute(
        """
        UPDATE "ClipJob" SET stage = %s, progress = %s, "heartbeatAt" = now(), "updatedAt" = now()
         WHERE id = %s AND status = 'RUNNING'::"ClipJobStatus"
        """,
        (stage, progress, job_id),
    )
    return cur.rowcount == 1


def finish(conn: psycopg.Connection, job_id: str, clips: list[dict], source_seconds: int | None) -> None:
    with conn.transaction():
        for clip in clips:
            conn.execute(
                """
                INSERT INTO "Clip" (id, "jobId", rank, title, theme, reason, format, "hookScore",
                                    "standaloneScore", "coherenceScore", "finalScore", "durationSec",
                                    "videoPath", "captionsPath", "thumbPath")
                VALUES (%(id)s, %(job)s, %(rank)s, %(title)s, %(theme)s, %(reason)s, %(format)s, %(hook)s,
                        %(standalone)s, %(coherence)s, %(final)s, %(duration)s,
                        %(video)s, %(captions)s, %(thumb)s)
                """,
                {"id": uuid.uuid4().hex, "job": job_id, **clip},
            )
        conn.execute(
            """
            UPDATE "ClipJob"
               SET status = 'DONE'::"ClipJobStatus", stage = NULL, progress = 100, error = NULL,
                   "sourceSeconds" = %s, "finishedAt" = now(), "heartbeatAt" = now(), "updatedAt" = now()
             WHERE id = %s
            """,
            (source_seconds, job_id),
        )


def fail(conn: psycopg.Connection, job_id: str, message: str) -> None:
    conn.execute(
        """
        UPDATE "ClipJob"
           SET status = 'FAILED'::"ClipJobStatus", error = %s, "finishedAt" = now(), "updatedAt" = now()
         WHERE id = %s
        """,
        (message[:1000], job_id),
    )


def release(conn: psycopg.Connection, job_id: str) -> None:
    """Hands a job back to the queue (the worker is shutting down), without counting the attempt."""
    conn.execute(
        """
        UPDATE "ClipJob"
           SET status = 'QUEUED'::"ClipJobStatus", "workerId" = NULL, stage = NULL, progress = 0,
               attempts = GREATEST(attempts - 1, 0), "updatedAt" = now()
         WHERE id = %s AND status = 'RUNNING'::"ClipJobStatus"
        """,
        (job_id,),
    )


def requeue_stale(conn: psycopg.Connection) -> int:
    """Jobs left RUNNING by a crashed worker: retry them, or give up after MAX_ATTEMPTS."""
    cur = conn.execute(
        f"""
        UPDATE "ClipJob"
           SET status = CASE WHEN attempts < %(max)s THEN 'QUEUED'::"ClipJobStatus"
                             ELSE 'FAILED'::"ClipJobStatus" END,
               error = CASE WHEN attempts < %(max)s THEN NULL
                            ELSE 'Processing stopped unexpectedly. Please try again.' END,
               "workerId" = NULL, "updatedAt" = now()
         WHERE status = 'RUNNING'::"ClipJobStatus" AND "heartbeatAt" < now() - interval '{STALE_AFTER}'
        """,
        {"max": MAX_ATTEMPTS},
    )
    return cur.rowcount
