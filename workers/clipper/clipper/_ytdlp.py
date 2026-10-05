"""
Run yt-dlp with TLS verified against the OS certificate store.

yt-dlp verifies against certifi's bundle. On a machine whose antivirus
intercepts HTTPS (AVG here), every request then fails with
CERTIFICATE_VERIFY_FAILED, because the interception root lives only in the OS
store. `http.ensure_tls` already fixes this for in-process calls, but ingest
runs yt-dlp as a SUBPROCESS, which never sees that injection -- so the fix has
to happen inside the child. `--no-check-certificates` would also "work", by
turning verification off for a download that carries nothing but our trust
that the bytes are the video we asked for; that is not an acceptable trade.

Invoked as `python -m clipper._ytdlp <yt-dlp args>`, which also removes the
dependency on a `yt-dlp` executable being on PATH -- pip installs its script
into a user directory that is often not.
"""
from __future__ import annotations

import sys


def main() -> int:
    try:
        import truststore

        truststore.inject_into_ssl()
    except ImportError:
        # Degrade to certifi rather than refusing: on a machine without TLS
        # interception that works, and on one with it the error names the cause.
        pass
    import yt_dlp

    return yt_dlp.main(sys.argv[1:])


if __name__ == "__main__":
    sys.exit(main())
