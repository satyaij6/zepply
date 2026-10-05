"""
The rubric is operator-owned. Code reads two things out of it and parses
nothing else: the whole text (passed to the model verbatim) and the FORMATS
block (needed both to tell the model its options and to validate what comes
back, from a single source of truth).

    === FORMATS ===
    single_take: one unbroken segment that already works as-is
    setup_payoff: a hook from one place joined to the segment it sets up
    === END FORMATS ===

Everything after the colon is prose for the model and is never interpreted.
Add, rename or delete formats freely -- Python must not care what is in there.
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

from .errors import ScoringError

BLOCK = re.compile(
    r"===\s*FORMATS\s*===(?P<body>.*?)===\s*END\s+FORMATS\s*===",
    re.IGNORECASE | re.DOTALL,
)
ENTRY = re.compile(r"^\s*(?:[-*]\s*)?(?P<name>[A-Za-z][A-Za-z0-9_]*)\s*:\s*(?P<desc>.+?)\s*$")


def parse_formats(text: str, *, source: Path | None = None) -> dict[str, str]:
    """
    Extract the declared formats.

    A missing or empty block is a hard error naming the file. Falling back to a
    built-in list would silently reintroduce exactly the coupling this design
    exists to avoid -- the rubric would stop being the source of truth and
    nobody would notice until a format quietly stopped working.
    """
    where = f" in {source}" if source else ""
    match = BLOCK.search(text)
    if not match:
        raise ScoringError(
            f"No '=== FORMATS ===' block found{where}",
            hint=("The rubric must declare its own clip formats. Add a block:\n"
                  "    === FORMATS ===\n"
                  "    single_take: one unbroken segment\n"
                  "    === END FORMATS ==="),
        )

    formats: dict[str, str] = {}
    for line in match.group("body").splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        entry = ENTRY.match(line)
        if entry:
            formats[entry.group("name")] = entry.group("desc")

    if not formats:
        raise ScoringError(
            f"The FORMATS block{where} declares no formats",
            hint="Each line must read `name: description`.",
        )
    return formats


def load_rubric(path: Path) -> tuple[str, dict[str, str], str]:
    """Return (full text, formats, sha256 prefix).

    The hash goes into scores.json so that editing the rubric invalidates
    cached plans automatically -- tuning a rubric against stale output is a
    silent and maddening way to lose an afternoon.
    """
    if not path.exists():
        raise ScoringError(
            f"Rubric not found: {path}",
            hint="This file is operator-owned. Restore it or pass --rubric.",
        )
    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise ScoringError(f"Rubric at {path} is empty")
    formats = parse_formats(text, source=path)
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
    return text, formats, digest


def format_menu(formats: dict[str, str]) -> str:
    """Render the declared formats for the prompt, in the rubric's own words."""
    return "\n".join(f"  {name}: {desc}" for name, desc in formats.items())
