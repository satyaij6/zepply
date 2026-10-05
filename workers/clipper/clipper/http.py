"""
Shared HTTP layer: one place that knows about TLS trust, timeouts, and which
status codes are worth retrying.

TLS note: this machine (and likely every dev box in this shop) runs AVG with
HTTPS scanning enabled. AVG terminates TLS and re-signs certificates as
`CN=AVG Web/Mail Shield Root`. That root is installed in the Windows
certificate store but is NOT in certifi's bundle, so requests' default
verification fails with CERTIFICATE_VERIFY_FAILED while browsers work fine.

`truststore` fixes this by verifying against the OS certificate store, which
does trust AVG's root. Verification stays fully ON -- we are not disabling it.
`verify=False` would also "work" and must never be used: these requests carry
API keys and user media.
"""
from __future__ import annotations

import logging

import requests

from .errors import ASRError, TransientError

log = logging.getLogger(__name__)

_TLS_READY = False

# 408 request timeout, 425 too early, 429 rate limit, 5xx server-side.
RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504, 509, 520, 522, 524}

DEFAULT_TIMEOUT = 300.0


def ensure_tls() -> None:
    """Point Python's TLS verification at the OS trust store. Idempotent."""
    global _TLS_READY
    if _TLS_READY:
        return
    try:
        import truststore

        truststore.inject_into_ssl()
        log.debug("TLS verification using the OS trust store")
    except ImportError:
        log.warning(
            "truststore is not installed. If this machine runs antivirus HTTPS "
            "scanning (AVG, Kaspersky, ESET, corporate MITM), every API call will "
            "fail certificate verification. pip install truststore"
        )
    _TLS_READY = True


def session() -> requests.Session:
    ensure_tls()
    return requests.Session()


def _retry_after(resp: requests.Response) -> float | None:
    raw = resp.headers.get("Retry-After")
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None  # HTTP-date form; fall back to computed backoff.


def post_multipart(
    url: str,
    *,
    headers: dict,
    data: dict,
    file_path,
    file_field: str = "file",
    mime: str = "audio/wav",
    timeout: float = DEFAULT_TIMEOUT,
    sess: requests.Session | None = None,
) -> dict:
    """
    One multipart POST. Raises TransientError for anything worth retrying and
    ASRError for anything that will not improve on a second attempt.
    """
    ensure_tls()
    http = sess or requests
    try:
        with open(file_path, "rb") as fh:
            resp = http.post(
                url,
                headers=headers,
                data=data,
                files={file_field: (getattr(file_path, "name", "audio.wav"), fh, mime)},
                timeout=timeout,
            )
    except (requests.Timeout, requests.ConnectionError) as exc:
        raise TransientError(f"{type(exc).__name__} calling {url}", hint=str(exc)[:200]) from exc
    except requests.RequestException as exc:
        raise ASRError(f"Request to {url} failed: {exc}") from exc

    if resp.status_code in RETRYABLE_STATUS:
        raise TransientError(
            f"HTTP {resp.status_code} from {url}: {resp.text[:300]}",
            retry_after=_retry_after(resp),
            status=resp.status_code,
        )

    if not resp.ok:
        raise ASRError(
            f"HTTP {resp.status_code} from {url}: {resp.text[:500]}",
            hint=(
                "Check SARVAM_API_KEY and the model string. A 401/403 means the key "
                "is wrong or revoked; a 422 usually means a bad model or language_code."
            ),
        )

    try:
        return resp.json()
    except ValueError as exc:
        raise ASRError(
            f"{url} returned non-JSON ({resp.status_code}): {resp.text[:300]}"
        ) from exc
