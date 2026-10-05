"""
The types that cross stage boundaries.

Every stage reads and writes these as JSON on disk, so each one round-trips
through to_dict/from_dict. Word indices are GLOBAL throughout: an index always
points into the single flat transcript word list, never into a region-local
slice. That convention is what lets score.py hand boundary.py a
`hook_start_word_index` with no offset arithmetic in between.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field, fields
from typing import Any


@dataclass(frozen=True)
class Word:
    i: int          # global index into the transcript
    text: str       # native script, exactly as the ASR returned it
    start: float    # absolute seconds in the source
    end: float
    # Romanized form. Captions burn this; scoring and inspection use `text`.
    # Kept on the Word so the two can never drift apart -- they share an index.
    roman: str = ""
    # Spoken over a DIFFERENT speaker's turn -- a listener's "yes" inside the
    # host's sentence. Kept in the transcript, because it was said and may carry
    # content ("they give an accelerator"); left out of captions, because two
    # people talking at once cannot be rendered as one readable line.
    overlap: bool = False

    @property
    def caption_text(self) -> str:
        return self.roman or self.text

    @property
    def duration(self) -> float:
        return self.end - self.start

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Word":
        return cls(i=int(d["i"]), text=d["text"],
                   start=float(d["start"]), end=float(d["end"]),
                   roman=d.get("roman", ""),
                   overlap=bool(d.get("overlap", False)))


@dataclass
class Signals:
    """PASS 1 evidence, kept so a bad gate decision can be argued with."""
    pause_edges: float = 0.0
    energy_peak: float = 0.0
    energy_delta: float = 0.0
    wpm: float = 0.0
    wpm_delta: float = 0.0
    density: float = 0.0
    # How fast the SOURCE cuts inside this window, and what that did to the
    # score. Recorded even when the penalty is off, so a region can be argued
    # with later: "why was this choppy one kept" needs the number, not a guess.
    cuts_per_min: float = 0.0
    choppiness_factor: float = 1.0

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Signals":
        return cls(**{k: float(v) for k, v in d.items()})


@dataclass
class Region:
    """A PASS 1 survivor. The only thing the LLM ever sees."""
    id: str
    start_i: int
    end_i: int          # inclusive
    start: float
    end: float
    text: str
    prefilter_score: float = 0.0
    signals: Signals = field(default_factory=Signals)
    why: list[str] = field(default_factory=list)

    @property
    def duration(self) -> float:
        return self.end - self.start

    def to_dict(self) -> dict:
        d = asdict(self)
        d["signals"] = self.signals.to_dict()
        d["duration"] = round(self.duration, 3)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Region":
        return cls(
            id=d["id"], start_i=int(d["start_i"]), end_i=int(d["end_i"]),
            start=float(d["start"]), end=float(d["end"]), text=d["text"],
            prefilter_score=float(d.get("prefilter_score", 0.0)),
            signals=Signals.from_dict(d.get("signals", {})),
            why=list(d.get("why", [])),
        )


# Roles are part of the Span contract, unlike `format` which is owned entirely
# by the rubric and parsed from it at runtime.
ROLES = ("hook", "body", "point", "payoff")

JOIN_TYPES = ("hard", "fade", "card")


@dataclass
class Span:
    """
    One continuous stretch of source that becomes part of a clip.

    A clip is no longer always one window: it may be a hook joined to the
    segment it sets up, or several scattered spans on a theme. Word indices are
    global, as everywhere else.
    """
    start_word_i: int
    end_word_i: int
    role: str
    label: str | None = None

    # filled by boundary.py
    source_start: float = 0.0
    source_end: float = 0.0
    start_rule: str = ""
    end_rule: str = ""
    trace: list[str] = field(default_factory=list)
    ok: bool = True
    note: str | None = None
    # Silence available just inside each edge. A crossfade blends BOTH sides,
    # so without this much room the dissolve overlaps live speech from two
    # different places and you hear two voices at once.
    lead_silence: float = 0.0
    tail_silence: float = 0.0

    # filled by assemble.py once boundaries are known
    playback_start: float = 0.0
    playback_end: float = 0.0
    source_order: int = 0

    @property
    def duration(self) -> float:
        return self.source_end - self.source_start

    def to_dict(self) -> dict:
        d = asdict(self)
        d["duration"] = round(self.duration, 3)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Span":
        known = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in d.items() if k in known})


@dataclass
class Join:
    """The transition BEFORE spans[k+1]; joins[k] sits between span k and k+1."""
    type: str
    duration: float
    label: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Join":
        return cls(type=d["type"], duration=float(d["duration"]), label=d.get("label"))


@dataclass
class ClipPlan:
    """
    An editor's decision about what a clip IS -- its shape, not just its bounds.

    `format` is validated against the list declared in prompts/hook_rubric.txt,
    never against anything hardcoded here.
    """
    id: str
    format: str
    theme: str
    spans: list[Span]
    hook_score: float
    coherence_score: float
    standalone_score: float
    reason: str
    suggested_title: str

    joins: list[Join] = field(default_factory=list)
    ok: bool = True
    rejected_reason: str | None = None
    notes: list[str] = field(default_factory=list)

    def final(self, w_hook: float, w_standalone: float, w_coherence: float) -> float:
        return (self.hook_score * w_hook
                + self.standalone_score * w_standalone
                + self.coherence_score * w_coherence)

    @property
    def total_duration(self) -> float:
        """Assembled length: spans minus crossfade overlap, plus card time."""
        if not self.spans:
            return 0.0
        total = sum(s.duration for s in self.spans)
        # Every join is a dissolve and therefore OVERLAPS its two sides, so it
        # shortens the result. A "card" is a labelled dissolve, not a
        # full-screen title: a title card stalls a 60s reel the same way a
        # dip-to-black does, and the label reads better overlaid on the
        # incoming span than as a beat of dead air.
        for join in self.joins:
            total -= join.duration
        return total

    @property
    def source_order(self) -> list[int]:
        """Playback position of each span when sorted by source time."""
        order = sorted(range(len(self.spans)), key=lambda i: self.spans[i].source_start)
        return [order.index(i) for i in range(len(self.spans))]

    @property
    def jumps_backwards(self) -> bool:
        return any(b.source_start < a.source_start
                   for a, b in zip(self.spans, self.spans[1:]))

    @property
    def source_reach(self) -> float:
        """How far across the source this clip pulls from, in seconds."""
        if not self.spans:
            return 0.0
        return (max(s.source_end for s in self.spans)
                - min(s.source_start for s in self.spans))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "format": self.format,
            "theme": self.theme,
            "suggested_title": self.suggested_title,
            "reason": self.reason,
            "scores": {
                "hook": self.hook_score,
                "coherence": self.coherence_score,
                "standalone": self.standalone_score,
            },
            "ok": self.ok,
            "rejected_reason": self.rejected_reason,
            "notes": self.notes,
            "total_duration": round(self.total_duration, 3),
            "span_count": len(self.spans),
            "playback_order": list(range(len(self.spans))),
            "source_order": self.source_order,
            "jumps_backwards": self.jumps_backwards,
            "source_reach": round(self.source_reach, 3),
            "spans": [s.to_dict() for s in self.spans],
            "joins": [j.to_dict() for j in self.joins],
        }

    @classmethod
    def from_dict(cls, d: dict) -> "ClipPlan":
        sc = d.get("scores", {})
        return cls(
            id=d["id"], format=d["format"], theme=d.get("theme", ""),
            spans=[Span.from_dict(x) for x in d["spans"]],
            hook_score=float(sc.get("hook", 0)),
            coherence_score=float(sc.get("coherence", 0)),
            standalone_score=float(sc.get("standalone", 0)),
            reason=d.get("reason", ""), suggested_title=d.get("suggested_title", ""),
            joins=[Join.from_dict(x) for x in d.get("joins", [])],
            ok=bool(d.get("ok", True)), rejected_reason=d.get("rejected_reason"),
            notes=list(d.get("notes", [])),
        )


def words_to_json(words: list[Word]) -> list[dict]:
    return [w.to_dict() for w in words]


def words_from_json(raw: Any) -> list[Word]:
    return [Word.from_dict(d) for d in raw]
