"""
Exponential backoff with jitter, for the two APIs this tool depends on.

Only TransientError is retried. A 400 from Claude because the schema is wrong
will never succeed on attempt four, and retrying it just burns money and hides
the real problem behind a 40-second pause.
"""
from __future__ import annotations

import logging
import random
import time
from typing import Callable, TypeVar

from .errors import TransientError

log = logging.getLogger(__name__)

T = TypeVar("T")


def with_retry(
    fn: Callable[[], T],
    *,
    what: str,
    attempts: int = 4,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
) -> T:
    """
    Call `fn`, retrying only on TransientError.

    Honors the server's Retry-After when present -- guessing a shorter delay
    than the server asked for is how you turn one 429 into a rate-limit ban.
    """
    last: TransientError | None = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except TransientError as exc:
            last = exc
            if attempt == attempts:
                break
            if exc.retry_after is not None:
                delay = min(exc.retry_after, max_delay)
            else:
                # Full jitter: spreads retries when several calls fail together.
                delay = random.uniform(0, min(base_delay * 2 ** (attempt - 1), max_delay))
            log.warning(
                "%s failed (attempt %d/%d, status=%s): %s -- retrying in %.1fs",
                what, attempt, attempts, exc.status, exc, delay,
            )
            time.sleep(delay)

    assert last is not None
    raise TransientError(
        f"{what} failed after {attempts} attempts. Last error: {last}",
        status=last.status,
        hint=(
            "The service is down, rate-limiting hard, or the network is blocked. "
            "Intermediates are on disk -- rerun with --from to resume rather than "
            "starting over."
        ),
    )
