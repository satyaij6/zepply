"""
Sources longer than Sarvam's per-file limit must be transcribed in parts.

Sarvam's batch job rejects any file over 7200s -- but inside a job whose state
still reads Completed. The reason sat in job_details, which was discarded, so a
7325s podcast failed as "produced no output JSON", and every podcast over two
hours would have failed the same way.

Three behaviours are pinned:

* a part boundary lands in a PAUSE near its nominal position, not mid-word;
* stitched timings sit on the source's own timeline, and speaker labels stay
  per-part, because Sarvam numbers speakers per FILE and speaker "1" in one
  part need not be the same person as speaker "1" in the next;
* the identity cap counts speakers within a part, so a two-person podcast
  split in two is still two people, not four.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clipper.errors import ASRError
from clipper.reframe.plan import speaker_count
from clipper.transcribe import (
    PART_SECONDS, SARVAM_MAX_FILE_SECONDS, _wait, split_points, stitch_parts,
)

RATE = 100   # coarse sample rate keeps synthetic hours cheap


def noisy_audio(seconds: float, quiet_at: list[float]) -> np.ndarray:
    rng = np.random.default_rng(0)
    data = rng.normal(0, 1000, int(seconds * RATE))
    for t in quiet_at:
        a = int((t - 0.5) * RATE)
        data[a:a + RATE] = 0.0            # one second of silence
    return data


# ------------------------------------------------------------- splitting

def test_parts_are_comfortably_under_the_file_limit():
    assert PART_SECONDS < SARVAM_MAX_FILE_SECONDS


def test_the_cut_moves_to_the_nearby_pause():
    duration = 7325.0
    pause = PART_SECONDS + 12.0           # within the search window
    cuts = split_points(noisy_audio(duration, [pause]), RATE, duration)
    assert len(cuts) == 2
    assert abs(cuts[0] - pause) < 1.0, cuts


def test_every_part_is_under_the_limit():
    duration = 8916.0                     # the Allari Naresh episode
    cuts = split_points(noisy_audio(duration, []), RATE, duration)
    bounds = [0.0, *cuts, duration]
    lengths = [b - a for a, b in zip(bounds, bounds[1:])]
    assert all(0 < n < SARVAM_MAX_FILE_SECONDS for n in lengths), lengths


def test_a_source_just_over_one_part_gets_one_cut():
    cuts = split_points(noisy_audio(PART_SECONDS + 300, []), RATE,
                        PART_SECONDS + 300)
    assert len(cuts) == 1


# ------------------------------------------------------------- stitching

def part(entries, text="x"):
    return {"transcript": text, "language_code": "te-IN",
            "diarized_transcript": {"entries": [
                {"transcript": t, "start_time_seconds": s,
                 "end_time_seconds": e, "speaker_id": who}
                for t, s, e, who in entries]}}


def test_stitched_times_are_on_the_source_timeline():
    stitched = stitch_parts([
        (part([("a", 0.0, 2.0, "1")]), 0.0),
        (part([("b", 1.0, 3.0, "1")]), 3601.25),
    ])
    times = [(e["start_time_seconds"], e["end_time_seconds"])
             for e in stitched["diarized_transcript"]["entries"]]
    assert times == [(0.0, 2.0), (3602.25, 3604.25)]


def test_speaker_labels_stay_per_part():
    """Speaker 1 in part 0 must not be merged with speaker 1 in part 1."""
    stitched = stitch_parts([
        (part([("a", 0.0, 2.0, "1"), ("b", 2.0, 4.0, "2")]), 0.0),
        (part([("c", 0.0, 2.0, "1")]), 3600.0),
    ])
    who = [e["speaker_id"] for e in stitched["diarized_transcript"]["entries"]]
    assert who == ["p0:1", "p0:2", "p1:1"]


def test_stitched_payload_keeps_the_shape_downstream_reads():
    stitched = stitch_parts([(part([("a", 0.0, 1.0, "1")], "hello"), 0.0),
                             (part([("b", 0.0, 1.0, "1")], "world"), 3600.0)])
    assert stitched["transcript"] == "hello world"
    assert stitched["language_code"] == "te-IN"
    assert "entries" in stitched["diarized_transcript"]


# ------------------------------------------------------------- identity cap

def test_two_people_split_in_two_are_still_two():
    turns = [(0, 1, "p0:1"), (1, 2, "p0:2"), (3600, 3601, "p1:1"),
             (3601, 3602, "p1:2")]
    assert speaker_count(turns) == 2


def test_unsplit_sources_count_as_before():
    assert speaker_count([(0, 1, "1"), (1, 2, "2"), (2, 3, "3")]) == 3
    assert speaker_count([]) == 0


# ------------------------------------------------------------- failures

class FakeResponse:
    ok = True

    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def test_a_completed_job_with_a_rejected_file_raises_the_real_reason(monkeypatch):
    """The exact record Sarvam returned for the 7325s podcast."""
    record = {
        "job_state": "Completed", "total_files": 1,
        "successful_files_count": 0, "failed_files_count": 1,
        "job_details": [{"file_name": "audio.wav", "state": "Internal Server Error",
                         "error_message": "400: Audio duration exceeds the "
                                          "maximum limit of 7200 seconds."}],
    }
    import clipper.transcribe as t

    monkeypatch.setattr(t.requests, "get", lambda *a, **k: FakeResponse(record))
    job = t._Job("job-1", "in", "q", "out", "q")
    settings = type("S", (), {"asr_base_url": "https://x", "asr_endpoint": "/stt"})()

    with pytest.raises(ASRError) as err:
        _wait(settings, {}, job)
    assert "7200 seconds" in str(err.value)


def test_a_clean_completed_job_returns(monkeypatch):
    record = {"job_state": "Completed", "failed_files_count": 0,
              "job_details": [{"file_name": "part00.wav", "state": "Success",
                               "error_message": ""}]}
    import clipper.transcribe as t

    monkeypatch.setattr(t.requests, "get", lambda *a, **k: FakeResponse(record))
    job = t._Job("job-2", "in", "q", "out", "q")
    settings = type("S", (), {"asr_base_url": "https://x", "asr_endpoint": "/stt"})()
    assert _wait(settings, {}, job)["job_state"] == "Completed"


# ------------------------------------------------------------- wav slicing

def test_parts_cover_every_frame_exactly_once(tmp_path):
    """Slicing must not drop or duplicate audio at a boundary."""
    import wave

    from clipper.transcribe import _write_parts

    rate, seconds = 16000, 10
    samples = (np.arange(rate * seconds) % 32000).astype("<i2")
    src = tmp_path / "audio.wav"
    with wave.open(str(src), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(samples.tobytes())

    out = tmp_path / "parts"
    out.mkdir()
    parts = _write_parts(src, [3.3, 7.05], out)

    assert [round(off, 4) for _, off in parts] == [0.0, 3.3, 7.05]
    joined = b""
    for path, _ in parts:
        with wave.open(str(path), "rb") as r:
            assert r.getframerate() == rate and r.getsampwidth() == 2
            joined += r.readframes(r.getnframes())
    assert joined == samples.tobytes()


# ------------------------------------------------------------- output matching

def test_outputs_are_paired_through_the_job_record_not_upload_order():
    """
    Sarvam names outputs by file id. The ids here are deliberately NOT in
    upload order, which is exactly the case a positional guess would get wrong.
    """
    from clipper.transcribe import match_outputs

    state = {"job_details": [
        {"file_name": "part00.wav", "file_id": "2"},
        {"file_name": "part01.wav", "file_id": "0"},
        {"file_name": "part02.wav", "file_id": "1"},
    ]}
    prefix = "jobs/2026-09-12/SPEECH_TO_TEXT_BULK/x/outputs/"
    outputs = {f"{prefix}0.json": {"who": "part01"},
               f"{prefix}1.json": {"who": "part02"},
               f"{prefix}2.json": {"who": "part00"}}
    got = match_outputs(state, outputs, ["part00.wav", "part01.wav", "part02.wav"],
                        [0.0, 3592.9, 7210.8])
    assert [p["who"] for p, _ in got] == ["part00", "part01", "part02"]
    assert [o for _, o in got] == [0.0, 3592.9, 7210.8]


def test_a_part_with_no_output_names_what_was_there():
    from clipper.transcribe import match_outputs

    with pytest.raises(ASRError) as err:
        match_outputs({"job_details": [{"file_name": "part00.wav", "file_id": "0"}]},
                      {"outputs/7.json": {}}, ["part00.wav"], [0.0])
    assert "part00.wav" in str(err.value) and "7.json" in str(err.value)


# ------------------------------------------------------------- segment order

def test_out_of_order_entries_are_put_back_in_time_order():
    """The shape seen on a real podcast: a short interjection listed late."""
    from clipper.transcribe import extract_segments

    payload = part([("long turn", 602.83, 605.83, "1"),
                    ("hmm", 579.37, 579.69, "2"),
                    ("next", 606.0, 609.0, "1")])
    segs = extract_segments(payload, 700.0)
    assert [s[0] for s in segs] == [579.37, 602.83, 606.0]


def test_already_ordered_entries_are_untouched():
    from clipper.transcribe import extract_segments

    payload = part([("a", 0.0, 1.0, "1"), ("b", 1.0, 2.0, "2")])
    assert [s[2] for s in extract_segments(payload, 5.0)] == ["a", "b"]
