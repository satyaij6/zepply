"""
Forced alignment: romanized words + audio -> per-word (start, end).

Sarvam returns no word-level timestamps on any model or endpoint -- its
`timestamps` field is segment-level, and on a 40s clip it produced two entries,
one of them zero-length. boundary.py cannot snap to a hook word on that, so the
timings are produced locally instead.

torchaudio's MMS_FA bundle is a multilingual CTC forced aligner whose label set
is plain Roman letters. That fits this pipeline exactly, because the caption
track is romanized anyway -- the transliteration step feeds the aligner directly
rather than needing a separate romanization pass.

Alignment is deterministic and offline: same audio plus same text always yields
the same timings, and reruns cost nothing.
"""
from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from .errors import ASRError
from .models import Word

log = logging.getLogger(__name__)

SAMPLE_RATE = 16000

# torchaudio's MMS_FA.get_model() is NOT cached: every call reconstructs the
# model and reloads a 1.2GB state dict from disk. Alignment runs once per
# diarized segment, and a 20-minute source had 40 of those -- invisible. A
# 70-minute source has 901, which would be 901 full model loads and hours of
# pure overhead. Build it once per process instead.
_BUNDLE_CACHE: dict = {}


def resolve_device(device: str) -> str:
    """
    Turn "auto" into a real device, and say which one was picked.

    Defaulting to "cpu" meant a machine with a GPU still aligned on the CPU
    unless someone remembered a flag. Measured on a 180s slice of real
    footage, the same aligner took 116s on CPU and 4.1s on an RTX 4050 -- with
    word timings identical to the millisecond -- so the GPU is the right
    default whenever it exists. An explicit "cpu" or "cuda" is honoured as-is.
    """
    if device != "auto":
        return device
    try:
        import torch

        chosen = "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        chosen = "cpu"
    log.info("align: device=auto -> %s", chosen)
    return chosen


def _aligner_parts(device: str):
    """(model, tokenizer, aligner), constructed once per device."""
    if device not in _BUNDLE_CACHE:
        from torchaudio.pipelines import MMS_FA as bundle

        log.info("align: loading the MMS_FA model (once per process)")
        _BUNDLE_CACHE[device] = (
            bundle.get_model().to(device),
            bundle.get_tokenizer(),
            bundle.get_aligner(),
        )
    return _BUNDLE_CACHE[device]

# MMS_FA's get_labels() returns the CTC blank ("-") and the star token ("*")
# alongside the real letters. They must never appear in a target sequence --
# feeding the blank index to the aligner raises "targets Tensor shouldn't
# contain blank index" and loses the entire segment. Since "-" is a perfectly
# ordinary character in romanized output, this is easy to hit and the failure
# takes a whole segment's worth of words with it.
NON_EMITTABLE = frozenset({"-", "*", "|"})


def emittable_labels(bundle) -> frozenset[str]:
    return frozenset(bundle.get_labels()) - NON_EMITTABLE

# Longer than this and the emission matrix stops fitting comfortably in RAM on
# a CPU box, so audio is aligned in chunks and the offsets added back.
CHUNK_SECONDS = 240.0
CHUNK_OVERLAP = 0.0


@dataclass
class AlignedSpan:
    start: float
    end: float
    score: float


def _normalize(token: str, labels: frozenset[str]) -> str:
    """
    Reduce a romanized token to the aligner's alphabet.

    Accents are folded rather than dropped so 'Vetukutunnaav' and 'ORR' both
    survive; anything outside the label set is removed. A token that empties out
    entirely (pure punctuation, digits) is handled by the caller.
    """
    folded = unicodedata.normalize("NFKD", token)
    folded = "".join(c for c in folded if not unicodedata.combining(c))
    folded = folded.lower()
    return "".join(c for c in folded if c in labels)


def read_wav(path: Path) -> tuple["object", int]:
    """
    Read a PCM wav with the standard library.

    torchaudio.load() delegates to torchcodec as of 2.11, which is a further
    binary dependency for no benefit here: ingest always writes 16kHz mono
    pcm_s16le via ffmpeg, so `wave` + numpy covers every file this tool
    produces. Anything else is rejected loudly rather than silently resampled.
    """
    import wave

    import numpy as np

    with wave.open(str(path), "rb") as wf:
        channels = wf.getnchannels()
        width = wf.getsampwidth()
        rate = wf.getframerate()
        raw = wf.readframes(wf.getnframes())

    if width != 2:
        raise ASRError(
            f"{path.name} is {width * 8}-bit; expected 16-bit PCM",
            hint="Re-run --from ingest; it writes pcm_s16le.",
        )
    data = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)
    return data, rate


def wav_duration(path: Path) -> float:
    data, rate = read_wav(path)
    return len(data) / rate


def _load_audio(path: Path, start: float = 0.0, duration: float | None = None):
    import torch

    data, rate = read_wav(path)
    if rate != SAMPLE_RATE:
        raise ASRError(
            f"{path.name} is {rate}Hz; the aligner needs {SAMPLE_RATE}Hz",
            hint="Re-run --from ingest; it resamples to 16kHz mono.",
        )
    if start or duration is not None:
        a = int(start * SAMPLE_RATE)
        b = len(data) if duration is None else a + int(duration * SAMPLE_RATE)
        data = data[a:b]
    return torch.from_numpy(data.copy()).unsqueeze(0)


def _align_chunk(waveform, tokens: list[str], bundle, device) -> list[AlignedSpan]:
    import torch

    model, tokenizer, aligner = _aligner_parts(device)

    with torch.inference_mode():
        emission, _ = model(waveform.to(device))
        token_spans = aligner(emission[0], tokenizer(tokens))

    # Frames -> seconds. The model downsamples, so the ratio is derived from the
    # actual emission length rather than assumed.
    ratio = waveform.size(1) / emission.size(1) / SAMPLE_RATE
    spans: list[AlignedSpan] = []
    for word_spans in token_spans:
        if not word_spans:
            spans.append(AlignedSpan(0.0, 0.0, 0.0))
            continue
        start = word_spans[0].start * ratio
        end = word_spans[-1].end * ratio
        score = sum(s.score * len(s) for s in word_spans) / max(
            sum(len(s) for s in word_spans), 1
        )
        spans.append(AlignedSpan(start, end, float(score)))
    return spans


def align(
    audio_path: Path,
    roman_words: list[str],
    *,
    original_words: list[str] | None = None,
    device: str = "cpu",
    chunk_seconds: float = CHUNK_SECONDS,
) -> list[Word]:
    """
    Align `roman_words` against `audio_path`, returning one Word per input.

    The output length always equals the input length. Tokens the aligner cannot
    consume (pure punctuation, bare digits) still get a slot, interpolated
    between their neighbours -- dropping them would shift every index after and
    silently desync the captions.
    """
    if not roman_words:
        return []

    try:
        import torch  # noqa: F401
        import torchaudio  # noqa: F401
        from torchaudio.pipelines import MMS_FA as bundle
    except ImportError as exc:
        raise ASRError(
            "Forced alignment needs torch and torchaudio",
            hint="pip install torch torchaudio  (see SETUP.md)",
        ) from exc

    labels = emittable_labels(bundle)
    normalized = [_normalize(w, labels) for w in roman_words]
    alignable = [i for i, t in enumerate(normalized) if t]

    if not alignable:
        raise ASRError(
            "No word survived normalization for alignment",
            hint="The transliteration step probably returned empty or non-Roman text.",
        )
    skipped = len(normalized) - len(alignable)
    if skipped:
        log.info("align: %d/%d tokens are unalignable; interpolating their spans",
                 skipped, len(normalized))

    total = _load_audio(audio_path).size(1) / SAMPLE_RATE
    log.info("align: %.1fs audio, %d words, device=%s", total, len(roman_words), device)

    spans_by_index: dict[int, AlignedSpan] = {}

    if total <= chunk_seconds:
        waveform = _load_audio(audio_path)
        spans = _align_chunk(waveform, [normalized[i] for i in alignable], bundle, device)
        for idx, span in zip(alignable, spans):
            spans_by_index[idx] = span
    else:
        # Split the word list proportionally to time. Approximate, but each
        # chunk is re-aligned independently so drift does not accumulate.
        n_chunks = int(total // chunk_seconds) + 1
        per = len(alignable) / n_chunks
        for c in range(n_chunks):
            offset = c * chunk_seconds
            dur = min(chunk_seconds, total - offset)
            if dur <= 0.1:
                continue
            lo, hi = int(c * per), int((c + 1) * per) if c < n_chunks - 1 else len(alignable)
            idxs = alignable[lo:hi]
            if not idxs:
                continue
            log.info("align: chunk %d/%d  %.1fs-%.1fs  %d words",
                     c + 1, n_chunks, offset, offset + dur, len(idxs))
            waveform = _load_audio(audio_path, offset, dur)
            spans = _align_chunk(waveform, [normalized[i] for i in idxs], bundle, device)
            for idx, span in zip(idxs, spans):
                spans_by_index[idx] = AlignedSpan(
                    span.start + offset, span.end + offset, span.score
                )

    return _to_words(roman_words, original_words, spans_by_index, total)


def _to_words(
    roman_words: list[str],
    original_words: list[str] | None,
    spans: dict[int, AlignedSpan],
    total: float,
) -> list[Word]:
    """Fill every slot, interpolating the ones the aligner skipped."""
    out: list[Word] = []
    text_source = original_words if original_words is not None else roman_words
    if len(text_source) != len(roman_words):
        raise ASRError(
            f"original_words ({len(text_source)}) and roman_words "
            f"({len(roman_words)}) differ in length"
        )

    last_end = 0.0
    for i, roman in enumerate(roman_words):
        span = spans.get(i)
        if span is None:
            # Borrow from the next aligned neighbour so ordering holds.
            nxt = next((spans[j] for j in range(i + 1, len(roman_words)) if j in spans), None)
            start = last_end
            end = nxt.start if nxt else min(last_end + 0.05, total)
            span = AlignedSpan(start, max(start, end), 0.0)
        out.append(Word(i=i, text=text_source[i], start=round(span.start, 3),
                        end=round(max(span.end, span.start), 3),
                        roman=roman))
        last_end = out[-1].end
    return out


@dataclass
class Segment:
    """A unit of audio with known text and approximate bounds."""
    start: float
    end: float
    words: list[str]          # original script
    roman: list[str]          # romanized, same length


# wav2vec2 self-attention is quadratic in frames (~50/sec), so a long chunk
# does not merely run slowly -- it exhausts RAM. Segments longer than this are
# subdivided.
MAX_SEGMENT_SECONDS = 30.0


def align_segments(
    audio_path: Path,
    segments: list[Segment],
    *,
    device: str = "cpu",
    pad: float = 0.25,
) -> list[Word]:
    """
    Align each segment against its own slice of audio.

    Preferred over aligning a whole long recording in one pass. Splitting a
    20-minute file into fixed time chunks means guessing which words belong to
    which chunk, and a single bad guess shifts everything after it. Diarized
    segments come with their text already paired to a time range, so each
    alignment problem is small, independent, and self-correcting: an error in
    one segment cannot propagate into the next.

    `pad` widens each slice slightly, since segment bounds from the ASR are
    approximate and a word clipped at the edge aligns poorly.
    """
    try:
        import torch  # noqa: F401
        from torchaudio.pipelines import MMS_FA as bundle
    except ImportError as exc:
        raise ASRError(
            "Forced alignment needs torch and torchaudio",
            hint="pip install torch torchaudio  (see SETUP.md)",
        ) from exc

    labels = emittable_labels(bundle)
    total = wav_duration(audio_path)
    out: list[Word] = []
    index = 0

    for n, seg in enumerate(segments, 1):
        if len(seg.words) != len(seg.roman):
            raise ASRError(
                f"segment {n}: {len(seg.words)} words but {len(seg.roman)} romanized"
            )
        if not seg.words:
            continue

        lo = max(0.0, seg.start - pad)
        hi = min(total, seg.end + pad)
        if hi - lo < 0.05:
            continue

        pieces = _split_segment(seg, lo, hi)
        for piece_lo, piece_hi, piece_words, piece_roman in pieces:
            normalized = [_normalize(w, labels) for w in piece_roman]
            alignable = [i for i, t in enumerate(normalized) if t]
            spans: dict[int, AlignedSpan] = {}
            if alignable:
                got = _align_or_halve(
                    audio_path, piece_lo, piece_hi,
                    [normalized[i] for i in alignable], bundle, device, n,
                )
                for idx, span in zip(alignable, got):
                    spans[idx] = AlignedSpan(span.start, span.end, span.score)

            piece_out = _to_words(piece_roman, piece_words, spans, total)
            for w in piece_out:
                out.append(Word(i=index, text=w.text, roman=w.roman,
                                start=max(w.start, piece_lo),
                                end=min(max(w.end, w.start), piece_hi)))
                index += 1

        if n % 20 == 0 or n == len(segments):
            log.info("align: %d/%d segments, %d words", n, len(segments), index)

    return _enforce_monotonic(out)


def _align_or_halve(
    audio_path: Path, lo: float, hi: float, tokens: list[str],
    bundle, device, seg_no: int, depth: int = 0,
) -> list[AlignedSpan]:
    """
    Align a piece; on failure, split it in half and try each side.

    CTC alignment requires at least as many audio frames as target characters.
    A piece can violate that when the proportional word split hands too many
    words to too little audio -- densely-spoken stretches especially. Halving
    fixes the ratio for the half that is actually dense instead of throwing the
    whole piece away, which is what the even-spread fallback amounts to.
    """
    try:
        waveform = _load_audio(audio_path, lo, hi - lo)
        spans = _align_chunk(waveform, tokens, bundle, device)
        return [AlignedSpan(s.start + lo, s.end + lo, s.score) for s in spans]
    except Exception as exc:  # noqa: BLE001 - torchaudio raises bare RuntimeError
        if depth >= 3 or len(tokens) < 2 or (hi - lo) < 1.0:
            log.warning("align: segment %d piece %.1f-%.1fs failed (%s); "
                        "spreading %d words evenly",
                        seg_no, lo, hi, str(exc)[:80], len(tokens))
            return _spread(len(tokens), lo, hi)

        mid_t = len(tokens) // 2
        mid_s = lo + (hi - lo) / 2
        log.debug("align: segment %d halving %.1f-%.1fs (%d tokens) at depth %d",
                  seg_no, lo, hi, len(tokens), depth)
        return (
            _align_or_halve(audio_path, lo, mid_s, tokens[:mid_t],
                            bundle, device, seg_no, depth + 1)
            + _align_or_halve(audio_path, mid_s, hi, tokens[mid_t:],
                              bundle, device, seg_no, depth + 1)
        )


def _spread(count: int, lo: float, hi: float) -> list[AlignedSpan]:
    """
    Even fallback timings across a span.

    Used when a piece cannot be aligned. The words are still in the right
    region of audio and still in order, which keeps pause detection and cutting
    usable; the score of 0.0 marks them as unverified.
    """
    if count <= 0:
        return []
    step = max((hi - lo) / count, 0.01)
    return [AlignedSpan(lo + i * step, lo + (i + 1) * step, 0.0) for i in range(count)]


def _split_segment(seg: Segment, lo: float, hi: float):
    """Subdivide an over-long segment, splitting its words proportionally."""
    span = hi - lo
    if span <= MAX_SEGMENT_SECONDS:
        return [(lo, hi, seg.words, seg.roman)]

    parts = int(span // MAX_SEGMENT_SECONDS) + 1
    per_time = span / parts
    per_word = len(seg.words) / parts
    pieces = []
    for p in range(parts):
        a = lo + p * per_time
        b = hi if p == parts - 1 else lo + (p + 1) * per_time
        wa = int(p * per_word)
        wb = len(seg.words) if p == parts - 1 else int((p + 1) * per_word)
        if wb > wa:
            pieces.append((a, b, seg.words[wa:wb], seg.roman[wa:wb]))
    return pieces


def _enforce_monotonic(words: list[Word]) -> list[Word]:
    """
    Segments are aligned independently, so a padded slice can produce a word
    that starts fractionally before its predecessor ended. Nudge rather than
    reorder -- prefilter measures pause gaps off these values and a negative
    gap would read as a boundary.
    """
    fixed: list[Word] = []
    last_end = 0.0
    for w in words:
        start = max(w.start, last_end)
        end = max(w.end, start)
        fixed.append(Word(i=w.i, text=w.text, roman=w.roman,
                          start=round(start, 3), end=round(end, 3)))
        last_end = end
    return fixed


def alignment_report(words: list[Word], audio_duration: float) -> dict:
    """
    Sanity numbers worth logging every run.

    A forced aligner fails quietly: it always returns spans, they are just
    wrong. Monotonic ordering and sane coverage are the cheap tells.
    """
    if not words:
        return {"words": 0}
    non_monotonic = sum(
        1 for a, b in zip(words, words[1:]) if b.start < a.start - 1e-3
    )
    zero_length = sum(1 for w in words if w.end - w.start <= 0)
    covered = words[-1].end - words[0].start
    return {
        "words": len(words),
        "first_start": words[0].start,
        "last_end": words[-1].end,
        "audio_duration": round(audio_duration, 2),
        "coverage_pct": round(100 * covered / audio_duration, 1) if audio_duration else 0.0,
        "non_monotonic": non_monotonic,
        "zero_length": zero_length,
        "mean_word_seconds": round(
            sum(w.end - w.start for w in words) / len(words), 3
        ),
    }
