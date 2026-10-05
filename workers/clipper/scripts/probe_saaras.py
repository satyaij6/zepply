"""
Throwaway day-one probe: does Sarvam actually return WORD-LEVEL timestamps
for code-mixed Telugu-English audio, and what is the script-control knob called?

The whole clip pipeline assumes per-word (start, end). Confirm before building
stage 5 on top of an assumption.

Usage:
    python scripts/probe_saaras.py <file.mp4|file.wav|youtube-url>
    python scripts/probe_saaras.py <src> --start 120 --duration 60
    python scripts/probe_saaras.py <src> --all          # full endpoint x param matrix

Needs SARVAM_API_KEY in the environment or in .env at the repo root.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import requests

try:
    # This machine runs AVG, which MITMs api.sarvam.ai with its own root CA.
    # That root lives in the Windows store but not in certifi's bundle, so
    # requests' default verification fails. Verify against the OS store instead
    # -- still fully verified, just against the store that knows about AVG.
    import truststore

    truststore.inject_into_ssl()
except ImportError:
    pass

BASE = "https://api.sarvam.ai"
ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "out" / "_probe"


# ---------------------------------------------------------------- audio prep

def load_env() -> None:
    """Minimal .env reader so the probe has no dependency on python-dotenv yet."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def fetch_youtube(url: str, workdir: Path) -> Path:
    dest = workdir / "source.%(ext)s"
    try:
        subprocess.run(
            ["yt-dlp", "-f", "bestaudio/best", "-o", str(dest), url],
            check=True, capture_output=True, text=True,
        )
    except FileNotFoundError:
        sys.exit("yt-dlp is not installed. `pip install yt-dlp`, or pass a local file instead.")
    except subprocess.CalledProcessError as exc:
        sys.exit("yt-dlp failed:\n" + exc.stderr)
    got = list(workdir.glob("source.*"))
    if not got:
        sys.exit("yt-dlp reported success but produced no file.")
    return got[0]


def to_wav(src: Path, workdir: Path, start: float, duration: float) -> Path:
    """16kHz mono PCM, the format every Sarvam STT endpoint documents."""
    wav = workdir / f"probe_{int(start)}_{int(duration)}.wav"
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", str(start), "-t", str(duration), "-i", str(src),
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        sys.exit("ffmpeg failed:\n" + exc.stderr)
    if not wav.exists() or wav.stat().st_size < 1024:
        sys.exit(f"ffmpeg produced no usable audio at --start {start}. Is the offset past the end?")
    return wav


# ---------------------------------------------------------------- attempts

def build_attempts(args: argparse.Namespace) -> list[dict]:
    """
    Each attempt is one API call. Params we are unsure about are probed by name:
    an 'unknown field' error is itself a useful answer, so nothing here is a guess
    we have to trust -- the server tells us which knobs are real.
    """
    saaras, saarika = args.saaras_model, args.saarika_model
    focused = [
        {
            "name": "saaras + with_timestamps + script control",
            "path": "/speech-to-text-translate",
            "data": {"model": saaras, "with_timestamps": "true", "output_script": "roman"},
        },
        {
            "name": "saaras baseline (no extra params)",
            "path": "/speech-to-text-translate",
            "data": {"model": saaras},
        },
        {
            "name": "saarika + with_timestamps (te-IN)",
            "path": "/speech-to-text",
            "data": {"model": saarika, "language_code": "te-IN", "with_timestamps": "true"},
        },
        {
            "name": "saarika + with_timestamps + output_script=roman",
            "path": "/speech-to-text",
            "data": {
                "model": saarika, "language_code": "te-IN",
                "with_timestamps": "true", "output_script": "roman",
            },
        },
    ]
    if not args.all:
        return focused
    return focused + [
        {
            "name": "saarika + timestamps= (alt param name)",
            "path": "/speech-to-text",
            "data": {"model": saarika, "language_code": "te-IN", "timestamps": "true"},
        },
        {
            "name": "saarika + script_code (alt script knob)",
            "path": "/speech-to-text",
            "data": {
                "model": saarika, "language_code": "te-IN",
                "with_timestamps": "true", "script_code": "Latn",
            },
        },
        {
            "name": "saaras + language_code=te-IN",
            "path": "/speech-to-text-translate",
            "data": {"model": saaras, "language_code": "te-IN", "with_timestamps": "true"},
        },
    ]


def call(api_key: str, attempt: dict, wav: Path, timeout: int) -> dict:
    url = BASE + attempt["path"]
    with wav.open("rb") as fh:
        files = {"file": (wav.name, fh, "audio/wav")}
        try:
            resp = requests.post(
                url,
                headers={"api-subscription-key": api_key},
                data=attempt["data"],
                files=files,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            return {"ok": False, "status": None, "error": f"{type(exc).__name__}: {exc}"}

    try:
        body = resp.json()
    except ValueError:
        body = {"_raw_text": resp.text[:2000]}
    return {"ok": resp.ok, "status": resp.status_code, "body": body}


# ---------------------------------------------------------------- inspection

TIMESTAMP_KEYS = ("timestamps", "words", "word_timestamps", "segments", "chunks")

START_KEYS = {"start", "start_time", "start_time_seconds", "start_ms", "from"}
END_KEYS = {"end", "end_time", "end_time_seconds", "end_ms", "to"}
TEXT_KEYS = {"word", "text", "token", "value"}


MAX_WORD_SECONDS = 3.0


def _first(node: dict, keys: set) -> object:
    for k in keys:
        if k in node:
            return node[k]
    return None


def _granularity(node: dict) -> str:
    """
    A {text, start, end} triple is not proof of word-level timing -- a
    sentence-level segment has the identical shape. Distinguish by the payload:
    a word is a single token and is short. Getting this wrong is the difference
    between 'assumption holds' and silently building stage 5 on sentence timings.
    """
    text = _first(node, TEXT_KEYS)
    if isinstance(text, str) and len(text.split()) > 1:
        return "sentence"

    start, end = _first(node, START_KEYS), _first(node, END_KEYS)
    if isinstance(start, (int, float)) and isinstance(end, (int, float)):
        span = end - start
        if any(k.endswith("_ms") for k in node):
            span /= 1000.0
        if span > MAX_WORD_SECONDS:
            return "sentence"
    return "word"


def find_word_timings(body) -> tuple[str | None, str, object]:
    """
    Walk the response for per-word (start, end).
    Returns (granularity, where, sample) where granularity is "word",
    "sentence", or None.
    """
    hits: list[tuple[str, dict]] = []

    def walk(node, path: str) -> None:
        if isinstance(node, dict):
            keys = set(node.keys())
            if (keys & START_KEYS) and (keys & END_KEYS) and (keys & TEXT_KEYS):
                hits.append((path, node))
            for k, v in node.items():
                walk(v, f"{path}.{k}" if path else k)
        elif isinstance(node, list):
            for idx, item in enumerate(node[:3]):
                walk(item, f"{path}[{idx}]")

    walk(body, "")

    for where, sample in hits:
        if _granularity(sample) == "word":
            return "word", where, sample

    # Parallel-array form, e.g. timestamps: {words: [...], start_time_seconds: [...]}
    if isinstance(body, dict):
        for key in TIMESTAMP_KEYS:
            node = body.get(key)
            if isinstance(node, dict):
                sub = set(node.keys())
                if (sub & {"words", "word"}) and any("start" in s for s in sub):
                    words = node.get("words") or node.get("word") or []
                    tokens = [w for w in words if isinstance(w, str)]
                    multiword = sum(1 for w in tokens if len(w.split()) > 1)
                    if not tokens:
                        # Shape is right but carries no data -- silent or
                        # unrecognized audio. Not evidence the design holds.
                        gran = "empty"
                    elif multiword > len(tokens) / 2:
                        gran = "sentence"
                    else:
                        gran = "word"
                    return gran, f"{key} (parallel arrays, n={len(words)})", {
                        k: (v[:5] if isinstance(v, list) else v) for k, v in node.items()
                    }

    if hits:
        where, sample = hits[0]
        return "sentence", where, sample
    return None, "", None


def summarize(name: str, result: dict) -> dict:
    line: dict = {"attempt": name, "status": result.get("status")}
    if result.get("status") is None:
        line["verdict"] = "TRANSPORT FAIL - " + result["error"]
        return line
    if not result["ok"]:
        body = result["body"]
        msg = body.get("error", body) if isinstance(body, dict) else body
        line["verdict"] = f"HTTP {result['status']} - " + json.dumps(msg, ensure_ascii=False)[:300]
        return line

    body = result["body"]
    gran, where, sample = find_word_timings(body)
    line["granularity"] = gran
    line["word_timings"] = gran == "word"
    line["timings_at"] = where or "-"
    line["top_level_keys"] = sorted(body.keys()) if isinstance(body, dict) else type(body).__name__
    transcript = ""
    if isinstance(body, dict):
        for k in ("transcript", "text", "translated_text", "output"):
            if isinstance(body.get(k), str):
                transcript = body[k]
                break
    line["transcript_head"] = transcript[:220]
    line["sample_timing"] = sample
    return line


# ---------------------------------------------------------------- main

def main() -> int:
    # Windows consoles default to cp1252, which cannot encode Telugu. Without
    # this, printing a transcript crashes with UnicodeEncodeError after the API
    # call has already succeeded -- losing the result we just paid for.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    load_env()
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("source", help="local media file or YouTube URL")
    p.add_argument("--start", type=float, default=0.0, help="offset in seconds (pick a talky part)")
    p.add_argument("--duration", type=float, default=60.0)
    p.add_argument("--all", action="store_true", help="run the full endpoint x param matrix")
    p.add_argument("--saaras-model", default="saaras:v3")
    p.add_argument("--saarika-model", default="saarika:v2.5")
    p.add_argument("--timeout", type=int, default=180)
    args = p.parse_args()

    api_key = os.environ.get("SARVAM_API_KEY")
    if not api_key:
        print("SARVAM_API_KEY is not set. Put it in .env at the repo root as:", file=sys.stderr)
        print("    SARVAM_API_KEY=your_key_here", file=sys.stderr)
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        src = Path(args.source)
        if not src.exists():
            if "://" not in args.source:
                print(f"No such file: {args.source}", file=sys.stderr)
                return 2
            print(f"Downloading audio from {args.source} ...")
            src = fetch_youtube(args.source, workdir)

        print(f"Extracting {args.duration:g}s from {args.start:g}s -> 16kHz mono wav ...")
        wav = to_wav(src, workdir, args.start, args.duration)
        print(f"  {wav.name}  ({wav.stat().st_size / 1024:.0f} KB)\n")

        attempts = build_attempts(args)
        summaries, raws = [], {}
        for attempt in attempts:
            print(f"-> {attempt['name']}")
            print(f"   POST {attempt['path']}  {attempt['data']}")
            result = call(api_key, attempt, wav, args.timeout)
            raws[attempt["name"]] = result
            line = summarize(attempt["name"], result)
            summaries.append(line)
            if line.get("verdict"):
                print(f"   {line['verdict']}\n")
            else:
                mark = {
                    "word": "WORD TIMINGS FOUND",
                    "sentence": "SENTENCE-level timings only",
                    "empty": "timestamp shape present but EMPTY (no speech?)",
                }.get(line["granularity"], "no timings at all")
                print(f"   HTTP {line['status']}  {mark}  at: {line['timings_at']}")
                print(f"   keys: {line['top_level_keys']}")
                if line["transcript_head"]:
                    print(f"   text: {line['transcript_head']}")
                print()

    raw_path = OUT_DIR / "probe_raw.json"
    raw_path.write_text(json.dumps(raws, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=" * 72)
    print("VERDICT")
    print("=" * 72)
    winners = [s for s in summaries if s.get("word_timings")]
    sentence_only = [s for s in summaries if s.get("granularity") == "sentence"]
    empty_shape = [s for s in summaries if s.get("granularity") == "empty"]
    for s in summaries:
        state = {"word": "WORD", "sentence": "SENT", "empty": "EMPT"}.get(s.get("granularity"))
        state = state or ("FAIL" if s.get("verdict") else "----")
        print(f"  [{state}] {s['attempt']}")
        if s.get("granularity"):
            print(f"          timings at: {s['timings_at']}")
            print("          sample: " + json.dumps(s["sample_timing"], ensure_ascii=False)[:400])
    print()
    if winners:
        print("Word-level timestamps confirmed via: " + winners[0]["attempt"])
        print("Design assumption holds. Proceed.")
    elif empty_shape:
        print("Timestamp SHAPE confirmed, but the arrays came back empty.")
        print("The audio contained no recognizable speech (silent/synthetic?).")
        print("Endpoint and parameter names are validated; re-run on real speech")
        print("to confirm timings actually populate.")
    elif sentence_only:
        print("SENTENCE-level timings only -- no word-level timings from any attempt.")
        print("boundary.py cannot snap to a hook word on this. Re-run with --all;")
        print("if saarika also returns sentence-level only, the design needs revisiting.")
    else:
        print("NO timestamps of any kind from any attempt.")
        print("Re-run with --all, then check the raw dump before building stage 5.")
    print(f"\nFull raw responses: {raw_path}")
    return 0 if winners else 1


if __name__ == "__main__":
    sys.exit(main())
