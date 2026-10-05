"""
Stage artifacts on disk, and the rule for what `--from <stage>` requires.

Each stage reads the previous stage's file and writes its own. Resuming at a
stage whose inputs are missing must fail with the exact path that is absent --
not with a KeyError three frames deep.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import Paths
from .errors import StageError

# Pipeline order. `--from X` runs X and everything after it.
STAGES = ("ingest", "transcribe", "prefilter", "score", "assemble", "boundary",
          "rank", "cut")


def stage_index(stage: str) -> int:
    try:
        return STAGES.index(stage)
    except ValueError:
        raise StageError(
            f"Unknown stage {stage!r}",
            hint=f"Valid stages: {', '.join(STAGES)}",
        ) from None


def read_json(path: Path, *, stage: str, produced_by: str) -> Any:
    if not path.exists():
        raise StageError(
            f"Cannot start at --from {stage}: {path} is missing",
            hint=f"Run --from {produced_by} first to produce it.",
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise StageError(
            f"{path} is not valid JSON ({exc})",
            hint=f"Delete it and re-run --from {produced_by}.",
        ) from exc


def write_json(path: Path, payload: Any) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    tmp.replace(path)  # atomic: a killed run never leaves a half-written stage file
    return path


def append_jsonl(path: Path, record: dict) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    return path


def requirements_for(stage: str, paths: Paths) -> list[tuple[Path, str]]:
    """(required file, stage that produces it) for resuming at `stage`."""
    return {
        "ingest": [],
        "transcribe": [(paths.audio, "ingest")],
        "prefilter": [(paths.transcript, "transcribe"), (paths.audio, "ingest")],
        "score": [(paths.regions, "prefilter"), (paths.transcript, "transcribe")],
        "assemble": [(paths.scores, "score"), (paths.transcript, "transcribe")],
        "boundary": [(paths.plans, "assemble"), (paths.transcript, "transcribe")],
        "rank": [(paths.boundaries, "boundary")],
        "cut": [(paths.ranked, "rank"), (paths.meta, "ingest")],
    }[stage]


def check_resume(stage: str, paths: Paths) -> None:
    """Fail fast, naming every missing input at once rather than one per run."""
    missing = [(p, src) for p, src in requirements_for(stage, paths) if not p.exists()]
    if missing:
        lines = "\n".join(f"    {p}  (produced by --from {src})" for p, src in missing)
        raise StageError(
            f"Cannot start at --from {stage}; required inputs are missing:\n{lines}",
            hint="Start from the earliest missing stage instead.",
        )
