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
from psycopg.types.json import Jsonb

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
    layout: str = "auto"
    effects: bool = True
    niche: str | None = None
    broll: bool = False
    accent: str | None = None
    broll_look: str = "editorial"
    card_layout: bool = False
    cta_keyword: str | None = None
    # A restyle: re-render one clip of a finished job from its saved analysis
    parent_job_id: str | None = None
    only_rank: int | None = None
    parent_bundle: str | None = None


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
               language, "clipCount", style, "captionPos", attempts, layout, effects, broll,
               "brollLook", "cardLayout", "ctaKeyword", "parentJobId", "onlyRank",
               (SELECT p."bundlePath" FROM "ClipJob" p WHERE p.id = "ClipJob"."parentJobId") AS parent_bundle,
               (SELECT niche FROM "User" u WHERE u.id = "ClipJob"."userId") AS niche,
               (SELECT accent FROM "BrandKit" b WHERE b."userId" = "ClipJob"."userId") AS accent
        """,
        {"worker": worker_id},
    ).fetchone()
    if not row:
        return None
    return Job(
        id=row["id"], user_id=row["userId"], source_kind=row["kind"], source_path=row["sourcePath"],
        source_url=row["sourceUrl"], language=row["language"], clip_count=row["clipCount"],
        style=row["style"], caption_pos=row["captionPos"], attempts=row["attempts"],
        layout=row["layout"], effects=row["effects"], niche=row["niche"],
        broll=row["broll"], accent=row["accent"], broll_look=row["brollLook"],
        card_layout=row["cardLayout"], cta_keyword=row["ctaKeyword"],
        parent_job_id=row["parentJobId"], only_rank=row["onlyRank"], parent_bundle=row["parent_bundle"],
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


def finish(conn: psycopg.Connection, job_id: str, clips: list[dict], source_seconds: int | None,
           source_kit: dict | None = None, *, bundle_path: str | None = None,
           parent_job_id: str | None = None) -> None:
    with conn.transaction():
        for clip in clips:
            clip.setdefault("variant_of", None)
            if parent_job_id:
                # A restyle is a new take of the original clip with the same rank.
                row = conn.execute(
                    """SELECT id FROM "Clip" WHERE "jobId" = %s AND rank = %s AND "variantOf" IS NULL LIMIT 1""",
                    (parent_job_id, clip["rank"]),
                ).fetchone()
                clip["variant_of"] = row["id"] if row else None
            conn.execute(
                """
                INSERT INTO "Clip" (id, "jobId", rank, title, theme, reason, format, "hookScore",
                                    "standaloneScore", "coherenceScore", "finalScore", "durationSec",
                                    "videoPath", "captionsPath", "thumbPath", "coverPath",
                                    titles, caption, hashtags, "variantOf")
                VALUES (%(id)s, %(job)s, %(rank)s, %(title)s, %(theme)s, %(reason)s, %(format)s, %(hook)s,
                        %(standalone)s, %(coherence)s, %(final)s, %(duration)s,
                        %(video)s, %(captions)s, %(thumb)s, %(cover)s,
                        %(titles)s, %(caption)s, %(hashtags)s, %(variant_of)s)
                """,
                {"id": uuid.uuid4().hex, "job": job_id, **clip},
            )
        conn.execute(
            """
            UPDATE "ClipJob"
               SET status = 'DONE'::"ClipJobStatus", stage = NULL, progress = 100, error = NULL,
                   "sourceSeconds" = %s, "sourceKit" = %s, "bundlePath" = COALESCE(%s, "bundlePath"),
                   "finishedAt" = now(), "heartbeatAt" = now(), "updatedAt" = now()
             WHERE id = %s
            """,
            (source_seconds, Jsonb(source_kit) if source_kit else None, bundle_path, job_id),
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
