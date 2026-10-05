"""
Stage 4 (PASS 2): the only stage that spends LLM tokens.

The model now sees the WHOLE numbered transcript, not just the prefilter
survivors. It has to, in order to notice that a line at minute 12 sets up a
segment at minute 3 -- a gate that only showed it fifteen isolated windows could
never surface that. The prefilter regions are still computed and are passed as
hints ("these scored well on cheap signals, start here"), which is what keeps
the model anchored without preventing it from looking elsewhere.

Measured: a numbered transcript runs about 2,200 characters per minute of video,
so 20 minutes is ~22k tokens and three hours is ~200k against a 1M context
window. Single-pass is therefore the normal case at any realistic length.
Chunking is deliberately NOT implemented -- a chunked pass structurally cannot
find a theme linking minute 2 to minute 18, since no single call sees both, so
it would quietly weaken the feature it exists to support. If a file ever exceeds
the budget the run stops and says so rather than silently degrading.

Three things worth knowing:

* **Word indices are pre-numbered in the prompt** as `[1417] ఈ`, so the model
  returns global indices directly and no offset arithmetic happens here.
* **The rubric is not in this file.** prompts/hook_rubric.txt is passed verbatim,
  and the set of valid `format` values is parsed from its FORMATS block.
* **The rubric's hash is stored with the output**, so editing it invalidates
  cached plans instead of letting you tune against stale results.
"""
from __future__ import annotations

import logging
from pathlib import Path

from pydantic import BaseModel, Field, field_validator

from .config import PROMPTS_DIR, Settings
from .errors import ScoringError, TransientError
from .models import ROLES, ClipPlan, Region, Span, Word
from .retry import with_retry
from .rubric import format_menu, load_rubric

log = logging.getLogger(__name__)

RUBRIC_PATH = PROMPTS_DIR / "hook_rubric.txt"

# Rough chars-per-token for code-mixed Telugu, deliberately pessimistic.
CHARS_PER_TOKEN = 2.0
# Leave generous headroom for the rubric, the hints and the response.
PROMPT_TOKEN_BUDGET = 700_000


# ------------------------------------------------------------------ schema

class SpanOut(BaseModel):
    start_word_i: int = Field(description="Global index of the span's first word")
    end_word_i: int = Field(description="Global index of the span's last word")
    role: str = Field(description="hook | body | point | payoff")
    label: str | None = Field(default=None, description="Short label, or null")

    @field_validator("role")
    @classmethod
    def _role(cls, v: str) -> str:
        return v.strip().lower()


class PlanOut(BaseModel):
    format: str
    theme: str
    spans: list[SpanOut]
    hook_score: float = Field(ge=0, le=10)
    coherence_score: float = Field(ge=0, le=10)
    standalone_score: float = Field(ge=0, le=10)
    reason: str
    suggested_title: str


class PlanBatch(BaseModel):
    plans: list[PlanOut]


# ------------------------------------------------------------------ prompt

def number_words(words: list[Word], start_i: int = 0, end_i: int | None = None) -> str:
    end_i = len(words) - 1 if end_i is None else end_i
    return " ".join(f"[{w.i}] {w.text}" for w in words[start_i:end_i + 1])


def estimate_tokens(text: str) -> int:
    return int(len(text) / CHARS_PER_TOKEN)


def build_hints(regions: list[Region]) -> str:
    if not regions:
        return "(none)"
    lines = []
    for r in regions:
        why = "; ".join(r.why[:2])
        lines.append(
            f"  {r.id}  words [{r.start_i}..{r.end_i}]  "
            f"{r.start:.0f}-{r.end:.0f}s  score {r.prefilter_score:.2f}  {why}"
        )
    return "\n".join(lines)


def build_prompt(
    words: list[Word], regions: list[Region], formats: dict[str, str],
    settings: Settings,
) -> str:
    return "\n".join([
        "Here is the complete transcript of one video as NUMBERED WORDS. The "
        "numbers are global word indices; copy them exactly when you report a "
        "span.",
        "",
        "Propose the clips worth cutting. A clip may be one continuous segment "
        "or several spans assembled in an order you choose -- pick whichever "
        "shape actually serves the material.",
        "",
        "VALID FORMATS (from the rubric; any other value is rejected):",
        format_menu(formats),
        "",
        f"Every span must be at least {settings.min_span_seconds:.0f}s, a plan "
        f"may have at most {settings.max_spans} spans, and the assembled clip "
        f"must run {settings.plan_min_duration:.0f}-{settings.plan_max_duration:.0f}s.",
        f"Roles: {' | '.join(ROLES)}. Exactly one span has role 'hook' and it "
        f"must be first in playback order.",
        "",
        "CHEAP-SIGNAL HINTS -- these windows scored well on pause, energy and "
        "pace alone. They are a starting point, not a restriction: propose "
        "clips anywhere in the transcript, including spans that cross or ignore "
        "these entirely.",
        build_hints(regions),
        "",
        "FULL NUMBERED TRANSCRIPT:",
        number_words(words),
    ])


# ------------------------------------------------------------------ calling

def _client(settings: Settings):
    try:
        import anthropic
    except ImportError as exc:
        raise ScoringError("The anthropic SDK is not installed",
                           hint="pip install anthropic") from exc
    from .http import ensure_tls

    ensure_tls()
    return anthropic.Anthropic(api_key=settings.require_anthropic())


def _call(client, settings: Settings, rubric: str, prompt: str) -> PlanBatch:
    import anthropic

    def once() -> PlanBatch:
        try:
            # Streamed, because a budget large enough to hold both the thinking
            # and the plans would otherwise risk an HTTP timeout on a long
            # transcript.
            with client.messages.stream(
                model=settings.score_model,
                max_tokens=settings.score_max_tokens,
                system=rubric,
                thinking={"type": "adaptive"},
                output_config={"effort": settings.score_effort},
                messages=[{"role": "user", "content": prompt}],
                output_format=PlanBatch,
            ) as stream:
                response = stream.get_final_message()
        except (anthropic.RateLimitError, anthropic.APIConnectionError,
                anthropic.InternalServerError) as exc:
            raise TransientError(f"Claude call failed: {type(exc).__name__}",
                                 status=getattr(exc, "status_code", None)) from exc
        except anthropic.APIStatusError as exc:
            raise ScoringError(
                f"Claude returned {exc.status_code}: {str(exc)[:300]}",
                hint="A 400 usually means the schema or prompt is malformed; "
                     "retrying will not help.",
            ) from exc

        if response.stop_reason == "max_tokens":
            # Retrying is pointless -- the same prompt will exhaust the same
            # budget. Say what actually happened instead of failing four times.
            raise ScoringError(
                f"The response hit max_tokens ({settings.score_max_tokens}) before "
                f"finishing; thinking used the whole budget "
                f"({response.usage.output_tokens} output tokens, blocks: "
                f"{[b.type for b in response.content]})",
                hint=("Raise score_max_tokens, or lower score_effort "
                      f"(currently {settings.score_effort!r}) so less of the "
                      "budget goes to thinking."),
            )

        parsed = response.parsed_output
        if parsed is None:
            raise TransientError(
                f"Claude returned no parseable structured output "
                f"(stop_reason={response.stop_reason}, "
                f"blocks={[b.type for b in response.content]})"
            )
        return parsed

    return with_retry(once, what="score plans", attempts=4, base_delay=2.0)


def to_plans(batch: PlanBatch) -> list[ClipPlan]:
    plans: list[ClipPlan] = []
    for n, out in enumerate(batch.plans, 1):
        plans.append(ClipPlan(
            id=f"p{n:02d}",
            format=out.format.strip(),
            theme=out.theme.strip(),
            spans=[
                Span(start_word_i=s.start_word_i, end_word_i=s.end_word_i,
                     role=s.role, label=(s.label or None))
                for s in out.spans
            ],
            hook_score=round(out.hook_score, 2),
            coherence_score=round(out.coherence_score, 2),
            standalone_score=round(out.standalone_score, 2),
            reason=out.reason.strip(),
            suggested_title=out.suggested_title.strip(),
        ))
    return plans


def score_regions(
    words: list[Word], regions: list[Region], settings: Settings,
    *, rubric_path: Path = RUBRIC_PATH,
) -> tuple[list[ClipPlan], dict[str, str], str]:
    """Returns (plans, formats declared by the rubric, rubric hash)."""
    rubric, formats, rubric_hash = load_rubric(rubric_path)
    prompt = build_prompt(words, regions, formats, settings)

    tokens = estimate_tokens(prompt) + estimate_tokens(rubric)
    log.info("score: %d words, %d hint regions, ~%dk prompt tokens, model=%s, "
             "rubric=%s, formats=%s",
             len(words), len(regions), tokens // 1000, settings.score_model,
             rubric_hash, ",".join(sorted(formats)))

    if tokens > PROMPT_TOKEN_BUDGET:
        raise ScoringError(
            f"The transcript needs ~{tokens // 1000}k tokens, over the "
            f"{PROMPT_TOKEN_BUDGET // 1000}k budget",
            hint=("Chunking is deliberately not implemented: a chunked pass cannot "
                  "spot a theme linking two distant parts of the video, which is "
                  "the point of multi-span plans. Split the source, or raise "
                  "PROMPT_TOKEN_BUDGET if the model's context allows."),
        )

    client = _client(settings)
    batch = _call(client, settings, rubric, prompt)
    plans = to_plans(batch)
    if not plans:
        raise ScoringError(
            "Claude proposed no clips",
            hint="Check the rubric is not so strict that nothing qualifies.",
        )
    log.info("score: %d plans proposed (%s)", len(plans),
             ", ".join(sorted({p.format for p in plans})))
    return plans, formats, rubric_hash
