"""
Worker settings, read from the environment (and workers/clipper/.env, shared with the clipper).

    ZEPPLY_DATABASE_URL        Postgres, direct connection (falls back to POSTGRES_URL_NON_POOLING)
    SUPABASE_URL               falls back to NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY  storage access for downloads and uploads
    ZEPPLY_WORK_DIR            scratch space for sources and renders (default ~/zepply-worker)
    ZEPPLY_POLL_SECONDS        how often to look for a job when idle (default 5)
    ZEPPLY_WORKER_ID           name shown on claimed jobs (default host-pid)
    ZEPPLY_DEVICE              alignment device passed to the clipper: auto | cuda | cpu
    ZEPPLY_JOBS                which queues to work: clips, reels or clips,reels (default both)
    ZEPPLY_NODE                Node.js binary for promo reel renders (default node)
    ZEPPLY_RENDER_WORKERS      parallel Chrome capture workers per reel render (default 2)
"""
from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

CLIPPER_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = CLIPPER_ROOT.parent.parent


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class Config:
    database_url: str
    supabase_url: str
    service_key: str
    work_dir: Path
    poll_seconds: float
    worker_id: str
    device: str
    jobs: frozenset[str]
    node: str
    render_workers: int

    @classmethod
    def from_env(cls) -> "Config":
        load_dotenv(CLIPPER_ROOT / ".env")
        env = os.environ.get
        missing = []

        def need(*names: str) -> str:
            for name in names:
                if env(name):
                    return env(name, "")
            missing.append(" or ".join(names))
            return ""

        cfg = cls(
            database_url=need("ZEPPLY_DATABASE_URL", "POSTGRES_URL_NON_POOLING"),
            supabase_url=need("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL").rstrip("/"),
            service_key=need("SUPABASE_SERVICE_ROLE_KEY"),
            work_dir=Path(env("ZEPPLY_WORK_DIR") or Path.home() / "zepply-worker"),
            poll_seconds=float(env("ZEPPLY_POLL_SECONDS") or 5),
            worker_id=env("ZEPPLY_WORKER_ID") or f"{socket.gethostname()}-{os.getpid()}",
            device=env("ZEPPLY_DEVICE") or "auto",
            jobs=frozenset(j.strip() for j in (env("ZEPPLY_JOBS") or "clips,reels").split(",") if j.strip()),
            node=env("ZEPPLY_NODE") or "node",
            render_workers=int(env("ZEPPLY_RENDER_WORKERS") or 2),
        )
        unknown = cfg.jobs - {"clips", "reels"}
        if unknown or not cfg.jobs:
            raise ConfigError("ZEPPLY_JOBS must be clips, reels or clips,reels")
        if "clips" in cfg.jobs:  # the clipper's own keys; reels need neither
            for key in ("SARVAM_API_KEY", "ANTHROPIC_API_KEY"):
                need(key)
        if missing:
            raise ConfigError("Missing settings: " + ", ".join(missing) + " (see workers/clipper/.env.example)")
        return cfg
