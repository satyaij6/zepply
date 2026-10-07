"""The post kit's clean-up: what reaches the app must already be valid for it."""
from clipper.models import Word
from clipper.postkit import Chapter, ClipKit, Kit, SourceKit, _normalise, chapters_text, timed_transcript


def _kit(chapters, tags=("#Telugu Podcast", "rgv", "RGV")):
    return Kit(
        clips=[ClipKit(clip=1, titles=["a", " ", "b"], caption=" hi ", hashtags=list(tags), cover_text="Big *idea*"),
               ClipKit(clip=9, titles=["out of range"], caption="", hashtags=[], cover_text="")],
        source=SourceKit(titles=["t"], description="d", chapters=[Chapter(start_seconds=s, title=t) for s, t in chapters]),
    )


def test_hashtags_are_bare_lowercase_and_unique():
    out = _normalise(_kit([]), 2, None)
    assert out["clips"]["1"]["hashtags"] == ["telugupodcast", "rgv"]
    assert out["clips"]["1"]["titles"] == ["a", "b"]
    assert "9" not in out["clips"]


def test_chapters_start_at_zero_and_respect_youtube_rules():
    chapters = [(5, "Intro"), (8, "Too close"), (120, "Two"), (400, "Three"), (9999, "Past the end")]
    out = _normalise(_kit(chapters), 1, 600.0)["source"]["chapters"]
    assert out[0]["start"] == 0
    assert [c["title"] for c in out] == ["Intro", "Two", "Three"]
    assert chapters_text(out) == "0:00 Intro\n2:00 Two\n6:40 Three"


def test_fewer_than_three_chapters_are_dropped():
    out = _normalise(_kit([(0, "A"), (100, "B")]), 1, None)
    assert out["source"]["chapters"] == []


def test_timed_transcript_marks_lines():
    words = [Word(i=i, text=f"w{i}", start=i * 1.0, end=i * 1.0 + 0.5) for i in range(45)]
    lines = timed_transcript(words).splitlines()
    assert lines[0].startswith("[0:00] w0")
    assert lines[1].startswith("[0:21] w21")  # w20 ends the first 20s line
