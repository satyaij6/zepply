"""
Stage 2: audio -> word-level transcript.

Three steps, because no single service does the whole job:

1. **Sarvam batch ASR with diarization.** Gives the code-mixed transcript and
   speaker/sentence segments with sane time bounds. Batch, not sync -- the sync
   endpoint hard-caps at 30 seconds. Raw JSON is cached by audio hash, so
   re-runs and `--from` resumes cost nothing.
2. **Per-word transliteration** to Roman. Required for the caption track, and
   it doubles as the aligner's input alphabet.
3. **Forced alignment** to recover per-word (start, end). Sarvam provides no
   word-level timing on any model or endpoint -- see SETUP.md -- so the timings
   the rest of the pipeline depends on are produced locally.

The output is a flat list of Words with global indices. Everything downstream
addresses words by that index.
"""
from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

import requests

from .align import (
    Segment, align_segments, alignment_report, resolve_device, wav_duration,
)
from .config import CACHE_DIR, Paths, Settings
from .errors import ASRError, TransientError
from .http import RETRYABLE_STATUS, ensure_tls
from .models import Word, words_to_json
from .retry import with_retry
from .transliterate import Transliterator

log = logging.getLogger(__name__)

BLOB_LIST_RE = re.compile(r"<Name>(.*?)</Name>")
POLL_INTERVAL = 5.0
POLL_TIMEOUT = 3600.0

# Sarvam's batch job rejects any single file over 7200s -- measured: a 7325s
# podcast came back "400: Audio duration exceeds the maximum limit of 7200
# seconds" inside a job whose overall state still read Completed. Parts are an
# hour, well clear of the cap, so a long source is several files in ONE job.
SARVAM_MAX_FILE_SECONDS = 7200.0
PART_SECONDS = 3600.0
# A part boundary is moved to the quietest moment within this many seconds of
# its nominal position, so the cut lands between words rather than through one.
SPLIT_SEARCH_SECONDS = 20.0
SPLIT_WINDOW_SECONDS = 0.25


# ------------------------------------------------------------------ batch ASR

@dataclass
class _Job:
    job_id: str
    input_url: str
    input_query: str
    output_url: str
    output_query: str


def _post(url: str, *, headers: dict, json_body: dict, timeout: float = 90.0) -> dict:
    def once() -> dict:
        try:
            resp = requests.post(url, headers=headers, json=json_body, timeout=timeout)
        except (requests.Timeout, requests.ConnectionError) as exc:
            raise TransientError(f"{type(exc).__name__} calling {url}") from exc
        if resp.status_code in RETRYABLE_STATUS:
            raise TransientError(f"HTTP {resp.status_code} from {url}: {resp.text[:200]}",
                                 status=resp.status_code)
        if not resp.ok:
            raise ASRError(
                f"HTTP {resp.status_code} from {url}: {resp.text[:400]}",
                hint="Check SARVAM_API_KEY, the model string, and language_code.",
            )
        return resp.json()

    return with_retry(once, what=f"POST {urlsplit(url).path}")


def _init_job(settings: Settings, headers: dict) -> _Job:
    base = settings.asr_base_url + settings.asr_endpoint
    d = _post(f"{base}/job/init", headers=headers, json_body={})
    for key in ("job_id", "input_storage_path", "output_storage_path"):
        if key not in d:
            raise ASRError(f"job/init response is missing {key!r}: {list(d)}")
    in_url, in_q = d["input_storage_path"].split("?", 1)
    out_url, out_q = d["output_storage_path"].split("?", 1)
    return _Job(d["job_id"], in_url, in_q, out_url, out_q)


def _upload(job: _Job, audio_path: Path) -> None:
    def once() -> None:
        try:
            resp = requests.put(
                f"{job.input_url}/{audio_path.name}?{job.input_query}",
                data=audio_path.read_bytes(),
                headers={"x-ms-blob-type": "BlockBlob"},
                timeout=1800,
            )
        except (requests.Timeout, requests.ConnectionError) as exc:
            raise TransientError(f"{type(exc).__name__} uploading audio") from exc
        if resp.status_code in RETRYABLE_STATUS:
            raise TransientError(f"HTTP {resp.status_code} uploading audio",
                                 status=resp.status_code)
        if not resp.ok:
            raise ASRError(
                f"Upload failed: HTTP {resp.status_code} {resp.text[:300]}",
                hint="The job's SAS URL may have expired; re-run to get a fresh one.",
            )

    with_retry(once, what="upload audio")


def _wait(settings: Settings, headers: dict, job: _Job) -> dict:
    # NOTE: the status path is /job/{id}/status. A plain /job/{id} returns 404.
    url = f"{settings.asr_base_url}{settings.asr_endpoint}/job/{job.job_id}/status"
    deadline = time.time() + POLL_TIMEOUT
    last = ""
    while time.time() < deadline:
        try:
            resp = requests.get(url, headers=headers, timeout=60)
            state = resp.json() if resp.ok else {}
        except requests.RequestException:
            state = {}
        status = str(state.get("job_state") or "")
        if status != last:
            log.info("transcribe: job %s -> %s", job.job_id, status or "?")
            last = status
        if status == "Completed":
            # "Completed" describes the JOB, not its files. A file Sarvam
            # rejected still leaves the job Completed, with the reason only in
            # job_details -- which used to be discarded, so the failure surfaced
            # later as a baffling "no output JSON".
            # Judged by failed_files_count and a per-file error_message, not by
            # the per-file `state` string: a rejected file's state read
            # "Internal Server Error", and nothing confirms what a successful
            # one reads, so matching state names would guess.
            failed = [d for d in state.get("job_details") or []
                      if d.get("error_message")]
            if state.get("failed_files_count") or failed:
                reasons = "; ".join(
                    f"{d.get('file_name', '?')}: {d.get('error_message') or d.get('state')}"
                    for d in failed) or json.dumps(state)[:400]
                raise ASRError(f"Sarvam rejected audio in job {job.job_id}",
                               hint=reasons)
            return state
        if status == "Failed":
            raise ASRError(
                f"Sarvam job {job.job_id} failed",
                hint=json.dumps(state)[:400],
            )
        time.sleep(POLL_INTERVAL)
    raise ASRError(
        f"Sarvam job {job.job_id} did not finish within {POLL_TIMEOUT:.0f}s",
        hint="Long sources can take a while; re-run --from transcribe to resume.",
    )


def _fetch_outputs(job: _Job) -> dict[str, dict]:
    """Every output JSON in the job, keyed by blob name."""
    parts = urlsplit(job.output_url)
    segs = parts.path.lstrip("/").split("/", 1)
    container = f"{parts.scheme}://{parts.netloc}/{segs[0]}"
    listing = requests.get(
        f"{container}?{job.output_query}&restype=container&comp=list&prefix={segs[1]}",
        timeout=120,
    )
    if not listing.ok:
        raise ASRError(f"Could not list job output: HTTP {listing.status_code}")
    names = [n for n in BLOB_LIST_RE.findall(listing.text) if n.endswith(".json")]
    if not names:
        raise ASRError(
            "Sarvam job completed but produced no output JSON",
            hint="Check the job status record's job_details for a per-file error.",
        )
    out: dict[str, dict] = {}
    for name in names:
        resp = requests.get(f"{container}/{name}?{job.output_query}", timeout=300)
        if not resp.ok:
            raise ASRError(f"Could not download {name}: HTTP {resp.status_code}")
        out[name] = resp.json()
    return out


def _fetch_output(job: _Job) -> dict:
    parts = urlsplit(job.output_url)
    segs = parts.path.lstrip("/").split("/", 1)
    container = f"{parts.scheme}://{parts.netloc}/{segs[0]}"
    listing = requests.get(
        f"{container}?{job.output_query}&restype=container&comp=list&prefix={segs[1]}",
        timeout=120,
    )
    if not listing.ok:
        raise ASRError(f"Could not list job output: HTTP {listing.status_code}")
    names = [n for n in BLOB_LIST_RE.findall(listing.text) if n.endswith(".json")]
    if not names:
        raise ASRError(
            "Sarvam job completed but produced no output JSON",
            hint="The uploaded audio may have been rejected; check the job status record.",
        )
    resp = requests.get(f"{container}/{names[0]}?{job.output_query}", timeout=300)
    if not resp.ok:
        raise ASRError(f"Could not download {names[0]}: HTTP {resp.status_code}")
    return resp.json()


def run_asr(audio_path: Path, settings: Settings, *, audio_hash: str,
            use_cache: bool = True) -> dict:
    """Sarvam batch ASR, cached on disk by audio hash."""
    cache_path = CACHE_DIR / f"{audio_hash}.json"
    if use_cache and cache_path.exists():
        log.info("transcribe: cache hit %s", cache_path.name)
        return json.loads(cache_path.read_text(encoding="utf-8"))

    ensure_tls()
    headers = {"api-subscription-key": settings.require_sarvam(),
               "Content-Type": "application/json"}

    duration = wav_duration(audio_path)
    if duration > PART_SECONDS:
        payload = _run_asr_in_parts(audio_path, settings, headers, duration)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                              encoding="utf-8")
        log.info("transcribe: cached raw ASR -> %s", cache_path)
        return payload

    log.info("transcribe: starting Sarvam batch job (%s)", settings.asr_model)
    job = _init_job(settings, headers)
    _upload(job, audio_path)
    _post(
        f"{settings.asr_base_url}{settings.asr_endpoint}/job",
        headers=headers,
        json_body={
            "job_id": job.job_id,
            "job_parameters": {
                "model": settings.asr_model,
                "language_code": settings.asr_language,
                "with_timestamps": True,
                # Diarized segments are the alignment units. Without them we
                # would have to guess which words belong to which audio chunk.
                "with_diarization": True,
            },
        },
    )
    _wait(settings, headers, job)
    payload = _fetch_output(job)

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                          encoding="utf-8")
    log.info("transcribe: cached raw ASR -> %s", cache_path)
    return payload


def split_points(samples, rate: int, duration: float,
                 part_seconds: float = PART_SECONDS) -> list[float]:
    """
    Where to cut a long source, in seconds -- each near a multiple of
    `part_seconds`, moved to the quietest short window within
    SPLIT_SEARCH_SECONDS so the cut falls in a pause rather than mid-word.
    """
    import numpy as np

    cuts: list[float] = []
    nominal = part_seconds
    hop = max(1, int(SPLIT_WINDOW_SECONDS * rate))
    while nominal < duration - 1.0:
        lo = max(0, int((nominal - SPLIT_SEARCH_SECONDS) * rate))
        hi = min(len(samples), int((nominal + SPLIT_SEARCH_SECONDS) * rate))
        window = np.asarray(samples[lo:hi], dtype=np.float64)
        n = len(window) // hop
        if n == 0:
            cuts.append(nominal)
        else:
            energy = (window[: n * hop].reshape(n, hop) ** 2).mean(axis=1)
            quiet = int(np.argmin(energy))
            cuts.append((lo + quiet * hop + hop // 2) / rate)
        nominal = cuts[-1] + part_seconds
    return cuts


def _write_parts(audio_path: Path, cuts: list[float], dest: Path
                 ) -> list[tuple[Path, float]]:
    """Slice the wav at `cuts` by exact frame count. Returns (path, offset)."""
    import wave

    parts: list[tuple[Path, float]] = []
    with wave.open(str(audio_path), "rb") as src:
        rate, total = src.getframerate(), src.getnframes()
        bounds = [0] + [int(round(c * rate)) for c in cuts] + [total]
        for i, (a, b) in enumerate(zip(bounds, bounds[1:])):
            src.setpos(a)
            frames = src.readframes(b - a)
            path = dest / f"part{i:02d}.wav"
            with wave.open(str(path), "wb") as out:
                out.setnchannels(src.getnchannels())
                out.setsampwidth(src.getsampwidth())
                out.setframerate(rate)
                out.writeframes(frames)
            parts.append((path, a / rate))
    return parts


def stitch_parts(results: list[tuple[dict, float]]) -> dict:
    """
    One payload from per-part payloads, on the source's own timeline.

    Speaker ids are namespaced per part ("p0:1", "p1:1"). Sarvam diarizes each
    FILE independently, so speaker "1" in one part need not be the same person
    as speaker "1" in the next; merging the labels would silently attribute one
    person's turns to another, which the reframe then frames. Anything that
    needs a speaker COUNT must count within a part, not across them -- see
    reframe.plan.speaker_count.
    """
    if not results:
        raise ASRError("No ASR parts to stitch")
    first = results[0][0]
    entries, texts = [], []
    for index, (payload, offset) in enumerate(results):
        dz = payload.get("diarized_transcript")
        for e in (dz.get("entries") if isinstance(dz, dict) else None) or []:
            start, end = e.get("start_time_seconds"), e.get("end_time_seconds")
            if start is None or end is None:
                continue
            entries.append({
                **e,
                "start_time_seconds": round(float(start) + offset, 3),
                "end_time_seconds": round(float(end) + offset, 3),
                "speaker_id": f"p{index}:{e.get('speaker_id', '0')}",
            })
        if payload.get("transcript"):
            texts.append(payload["transcript"].strip())
    stitched = {k: v for k, v in first.items()
                if k not in ("transcript", "timestamps", "diarized_transcript")}
    stitched["transcript"] = " ".join(texts)
    stitched["diarized_transcript"] = {"entries": entries}
    stitched["parts"] = [{"offset": off} for _, off in results]
    return stitched


def _run_asr_in_parts(audio_path: Path, settings: Settings, headers: dict,
                      duration: float) -> dict:
    import tempfile

    from .align import read_wav

    samples, rate = read_wav(audio_path)
    cuts = split_points(samples, rate, duration)
    del samples
    log.info("transcribe: %.0fs source exceeds one part; splitting at %s",
             duration, ", ".join(f"{c:.1f}s" for c in cuts))

    with tempfile.TemporaryDirectory() as tmp:
        parts = _write_parts(audio_path, cuts, Path(tmp))
        for path, _ in parts:
            if wav_duration(path) > SARVAM_MAX_FILE_SECONDS:
                raise ASRError(f"{path.name} is still over Sarvam's file limit")
        log.info("transcribe: starting Sarvam batch job (%s), %d parts",
                 settings.asr_model, len(parts))
        job = _init_job(settings, headers)
        for path, _ in parts:
            _upload(job, path)
        _post(
            f"{settings.asr_base_url}{settings.asr_endpoint}/job",
            headers=headers,
            json_body={
                "job_id": job.job_id,
                "job_parameters": {
                    "model": settings.asr_model,
                    "language_code": settings.asr_language,
                    "with_timestamps": True,
                    "with_diarization": True,
                },
            },
        )
        state = _wait(settings, headers, job)
        outputs = _fetch_outputs(job)

    offsets = [offset for _, offset in parts]
    names = [path.name for path, _ in parts]
    return stitch_parts(match_outputs(state, outputs, names, offsets))


def match_outputs(state: dict, outputs: dict[str, dict], names: list[str],
                  offsets: list[float]) -> list[tuple[dict, float]]:
    """
    Pair each uploaded part with its output JSON, via the job record.

    Outputs are named by FILE ID ("0.json", "1.json"), not by the uploaded
    file's name, and nothing guarantees ids follow upload order. The job's
    job_details is the only record of which id belongs to which file, so the
    pairing reads it rather than guessing -- a wrong guess would stitch hour
    two's transcript onto hour one's timeline, silently.
    """
    ids = {str(d.get("file_name")): str(d.get("file_id"))
           for d in state.get("job_details") or []}
    by_base = {name.rsplit("/", 1)[-1]: payload
               for name, payload in outputs.items()}
    results: list[tuple[dict, float]] = []
    for name, offset in zip(names, offsets):
        file_id = ids.get(name)
        payload = by_base.get(f"{file_id}.json") if file_id is not None else None
        if payload is None:
            raise ASRError(
                f"Could not match an output JSON to {name}",
                hint=(f"job_details ids: {ids}; outputs: "
                      f"{', '.join(sorted(by_base))}"))
        results.append((payload, offset))
    return results


# ------------------------------------------------------------------ segments

# A segment counts as simultaneous when at least this much of it is covered by
# another speaker's segments. A share, not a length: a listener's two-word
# interjection is fully covered however long it runs, while the host's 30s
# block around it is covered by a second or two and stays a caption.
#
# Measured before choosing it. On a lively two-person podcast 356 of 1295
# segments qualify -- alarming by count, but they are short: 6.0% of words are
# hidden, and because the voice being spoken over keeps its caption, speech
# with NO caption on screen at all is 1.49% of speaking time. On the calmer
# source the same rule hides 2.6% of words and blanks 0.49%.
SIMULTANEOUS_SHARE = 0.5


def simultaneous(segments: list[tuple[float, float, str, str]]) -> list[bool]:
    """
    Which segments are spoken over a different speaker's turn.

    Judged by overlap with ANOTHER speaker, never by duration. Measured on a
    two-person podcast: all 15 out-of-order entries sat entirely inside the
    other speaker's segment, and some were real content rather than "hmm" --
    a length cutoff would have kept the short noise and dropped the long
    phrase, which is backwards. Mutual crosstalk where BOTH sides are mostly
    overlapped marks both, which leaves a brief caption gap rather than two
    lines fighting for the same space.
    """
    flags: list[bool] = []
    for i, (s, e, _, who) in enumerate(segments):
        span = e - s
        if span <= 0:
            flags.append(False)
            continue
        cover: list[tuple[float, float]] = []
        for j, (s2, e2, _, who2) in enumerate(segments):
            if j == i or who2 == who or s2 >= e or e2 <= s:
                continue
            cover.append((max(s, s2), min(e, e2)))
        cover.sort()
        covered, cur_s, cur_e = 0.0, None, None
        for a, b in cover:
            if cur_e is None or a > cur_e:
                if cur_e is not None:
                    covered += cur_e - cur_s
                cur_s, cur_e = a, b
            else:
                cur_e = max(cur_e, b)
        if cur_e is not None:
            covered += cur_e - cur_s
        flags.append(covered >= SIMULTANEOUS_SHARE * span)
    return flags


def extract_segments(payload: dict, audio_duration: float) -> list[tuple[float, float, str]]:
    """Diarized segments as (start, end, text), in time order."""
    return [(s, e, t) for s, e, t, _ in diarized_segments(payload, audio_duration)]


def diarized_segments(payload: dict, audio_duration: float
                      ) -> list[tuple[float, float, str, str]]:
    """
    Prefer diarized entries; fall back to the flat transcript as one segment.

    Sarvam's `timestamps` field is deliberately ignored -- on real audio it
    returns one entry spanning the whole file (see SETUP.md).
    """
    dz = payload.get("diarized_transcript")
    entries = dz.get("entries") if isinstance(dz, dict) else None
    segments: list[tuple[float, float, str, str]] = []
    if entries:
        for e in entries:
            text = (e.get("transcript") or "").strip()
            start, end = e.get("start_time_seconds"), e.get("end_time_seconds")
            if not text or start is None or end is None:
                continue
            if float(end) <= float(start):
                continue
            segments.append((float(start), float(end), text,
                             str(e.get("speaker_id", "0"))))

    if segments:
        # Sarvam does not always emit entries in time order. On a two-person
        # podcast it listed a listener's 0.3s interjection AFTER a turn that
        # started 23s later -- 15 times in one hour -- while a different source
        # came back perfectly ordered. Segment order becomes global word order,
        # and everything downstream assumes words move forward in time (the
        # prefilter's window scan stops early on that assumption), so order is
        # restored here. A no-op for sources that were already sorted.
        inversions = sum(1 for a, b in zip(segments, segments[1:]) if b[0] < a[0])
        if inversions:
            log.info("transcribe: %d diarized segments arrived out of time "
                     "order; sorting", inversions)
            segments.sort(key=lambda seg: (seg[0], seg[1]))
        log.info("transcribe: %d diarized segments", len(segments))
        return segments

    transcript = (payload.get("transcript") or "").strip()
    if not transcript:
        raise ASRError(
            "Sarvam returned an empty transcript",
            hint="Does the audio actually contain speech? Check work/audio.wav.",
        )
    log.warning(
        "transcribe: no diarized segments; aligning the whole file as one span. "
        "Timings will be less reliable on long sources."
    )
    return [(0.0, audio_duration, transcript, "0")]


def order_words(words: list, per_segment_words: list[list[str]],
                overlapped: list[bool]) -> list:
    """
    Flag each word's segment as simultaneous, then put words in time order.

    Aligned words come out grouped by segment. When a listener's interjection
    sits inside the host's segment, that grouping runs host words to 602s,
    then the interjection back at 579s, then the next segment -- so the gap
    from 579.7s to 602.8s reads as a 23-second PAUSE where the host was
    talking continuously. The prefilter builds window boundaries and its pause
    score from exactly those gaps. Sorting by time removes the fiction; the
    flag keeps the interjection out of captions without deleting it.
    """
    from dataclasses import replace

    flagged = []
    cursor = 0
    for seg_words, is_overlap in zip(per_segment_words, overlapped):
        for w in words[cursor:cursor + len(seg_words)]:
            flagged.append(replace(w, overlap=is_overlap) if is_overlap else w)
        cursor += len(seg_words)
    flagged.extend(words[cursor:])      # never expected; never silently lost

    ordered = sorted(enumerate(flagged), key=lambda p: (p[1].start, p[1].end, p[0]))
    return [replace(w, i=n) for n, (_, w) in enumerate(ordered)]


# ------------------------------------------------------------------ stage

def transcribe(
    paths: Paths,
    settings: Settings,
    *,
    audio_hash: str,
    use_cache: bool = True,
    device: str = "cpu",
) -> list[Word]:
    audio_path = paths.audio
    if not audio_path.exists():
        raise ASRError(
            f"{audio_path} is missing",
            hint="Run --from ingest first.",
        )

    duration = wav_duration(audio_path)
    payload = run_asr(audio_path, settings, audio_hash=audio_hash, use_cache=use_cache)
    raw_segments = diarized_segments(payload, duration)
    overlapped = simultaneous(raw_segments)
    if any(overlapped):
        log.info("transcribe: %d of %d segments are spoken over another "
                 "speaker; kept in the transcript, left out of captions",
                 sum(overlapped), len(raw_segments))

    # Romanize every segment's words in one batch so the cache and the thread
    # pool are used once, not once per segment.
    per_segment_words = [text.split() for _, _, text, _ in raw_segments]
    flat = [w for seg in per_segment_words for w in seg]
    log.info("transcribe: %d words across %d segments", len(flat), len(raw_segments))

    translit = Transliterator(settings.require_sarvam())
    flat_roman = translit.words(flat)

    segments: list[Segment] = []
    cursor = 0
    for (start, end, _, _), seg_words in zip(raw_segments, per_segment_words):
        n = len(seg_words)
        segments.append(
            Segment(start=start, end=end, words=seg_words,
                    roman=flat_roman[cursor:cursor + n])
        )
        cursor += n

    words = align_segments(audio_path, segments, device=resolve_device(device))
    words = order_words(words, per_segment_words, overlapped)

    report = alignment_report(words, duration)
    log.info("transcribe: alignment %s", json.dumps(report))
    if report.get("non_monotonic"):
        log.warning("transcribe: %d non-monotonic words survived", report["non_monotonic"])
    if report.get("coverage_pct", 0) < 40:
        log.warning(
            "transcribe: alignment covers only %.1f%% of the audio -- "
            "check that the transcript matches this file",
            report["coverage_pct"],
        )

    paths.transcript.parent.mkdir(parents=True, exist_ok=True)
    paths.transcript.write_text(
        json.dumps(
            {
                "audio_sha256": audio_hash,
                "duration": duration,
                "language_code": payload.get("language_code"),
                "asr_model": settings.asr_model,
                "segments": len(segments),
                "alignment": report,
                "words": words_to_json(words),
            },
            ensure_ascii=False, indent=2,
        ),
        encoding="utf-8",
    )
    log.info("transcribe: wrote %d words -> %s", len(words), paths.transcript)
    return words
