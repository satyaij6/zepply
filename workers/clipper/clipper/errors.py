"""
Typed errors with actionable messages.

Every error here should tell the operator what to do next, not just what broke.
A stack trace ending in `KeyError: 'timestamps'` costs ten minutes; "Saaras does
not return timestamps, use --asr-model saarika:v2.5" costs none.
"""
from __future__ import annotations


class ClipperError(Exception):
    """Base for everything this tool raises deliberately."""

    def __init__(self, message: str, hint: str | None = None):
        self.hint = hint
        super().__init__(message if not hint else f"{message}\n  -> {hint}")


class ConfigError(ClipperError):
    """Missing keys, bad .env, unknown profile."""


class IngestError(ClipperError):
    """Source unavailable, unreadable, or produced no audio."""


class FFmpegError(ClipperError):
    """ffmpeg/ffprobe missing, misbuilt, or exited non-zero."""


class ASRError(ClipperError):
    """Sarvam call failed, or returned a payload we cannot use."""


class ScoringError(ClipperError):
    """Claude call failed, or returned output that will not validate."""


class BoundaryError(ClipperError):
    """A cut could not be resolved inside the target length."""


class StageError(ClipperError):
    """--from asked to resume at a stage whose inputs are not on disk."""


class TransientError(ClipperError):
    """
    Retryable failure: 429, 5xx, timeout, dropped connection.

    Carries `retry_after` when the server told us how long to wait, so the
    backoff can obey it instead of guessing.
    """

    def __init__(self, message: str, *, retry_after: float | None = None,
                 status: int | None = None, hint: str | None = None):
        self.retry_after = retry_after
        self.status = status
        super().__init__(message, hint)
