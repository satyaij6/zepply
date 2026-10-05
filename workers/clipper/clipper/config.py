"""
Every tunable lives here. Nothing downstream hardcodes a threshold.

The prefilter weights are guesses on day one, by design -- they get retuned from
rejects.jsonl once there are enough manual rejections to learn from.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

from .errors import ConfigError

ROOT = Path(__file__).resolve().parent.parent


def _default_out_root() -> Path:
    """
    Where rendered clips go.

    Deliberately NOT inside the repo. This project lives under a OneDrive-synced
    Documents folder, and OneDrive holds a file open while it
    uploads -- measured, three consecutive renders died with "Error opening
    output ...: Permission denied" because the previous clips were mid-sync.
    Retrying around that treats the symptom; keeping tens of megabytes of video
    out of a synced folder removes the cause, and stops every render from being
    uploaded to the cloud as a side effect.

    Override with CLIPPER_OUT, or per-run with --out.
    """
    override = os.environ.get("CLIPPER_OUT")
    if override:
        return Path(override)
    if os.name == "nt":
        return Path(os.environ.get("SystemDrive", "C:") + "/clipper-out")
    return ROOT / "out"


OUT_ROOT = _default_out_root()
PROMPTS_DIR = ROOT / "prompts"
ASSETS_DIR = ROOT / "assets"
CACHE_DIR = ROOT / ".cache" / "asr"

FONT_PATH = ASSETS_DIR / "NotoSansTelugu-Regular.ttf"
YUNET_PATH = ASSETS_DIR / "face_detection_yunet_2023mar.onnx"
YUNET_URL = ("https://github.com/opencv/opencv_zoo/raw/main/models/"
             "face_detection_yunet/face_detection_yunet_2023mar.onnx")
FONT_FAMILY = "Noto Sans Telugu"


# --------------------------------------------------------------- prefilter

@dataclass(frozen=True)
class Weights:
    """Composite weights for PASS 1. Must sum to ~1.0."""
    pause_edges: float
    energy_peak: float
    energy_delta: float
    wpm_delta: float
    density: float

    def validate(self) -> None:
        total = sum((self.pause_edges, self.energy_peak, self.energy_delta,
                     self.wpm_delta, self.density))
        if abs(total - 1.0) > 0.01:
            raise ConfigError(f"Prefilter weights sum to {total:.3f}, expected 1.0")


PROFILES: dict[str, Weights] = {
    # Talking head: emphasis and laughter spikes are the strongest signal.
    "talking_head": Weights(
        pause_edges=0.15, energy_peak=0.20, energy_delta=0.30,
        wpm_delta=0.20, density=0.15,
    ),
    # Walkthrough: steadier, quieter delivery. Energy discriminates poorly, so
    # lean on pace change and speech density instead.
    "walkthrough": Weights(
        pause_edges=0.20, energy_peak=0.10, energy_delta=0.15,
        wpm_delta=0.30, density=0.25,
    ),
}


# --------------------------------------------------------------- settings

@dataclass
class Settings:
    sarvam_api_key: str = ""
    anthropic_api_key: str = ""

    # ASR. Saaras silently ignores with_timestamps and returns no timings at
    # all; Saarika returns timestamps.{words,start_time_seconds,end_time_seconds}.
    # Word timings are non-negotiable -- boundary.py snaps to a hook word.
    asr_endpoint: str = "/speech-to-text"
    asr_model: str = "saarika:v2.5"
    asr_language: str = "te-IN"
    asr_base_url: str = "https://api.sarvam.ai"
    asr_chunk_seconds: float = 25.0
    asr_chunk_overlap: float = 0.0

    # Scoring. Sonnet by default: rubric-following over ~15 short passages does
    # not need Opus, and this runs at volume. Override with --model to A/B.
    score_model: str = "claude-sonnet-5"
    score_batch_size: int = 8
    # Measured: on a 20-minute transcript, adaptive thinking consumed all 16000
    # output tokens and the response stopped at max_tokens with ONLY a thinking
    # block -- no structured output at all. The budget has to cover thinking
    # AND the plans. Streaming is what makes a budget this size safe from HTTP
    # timeouts.
    score_max_tokens: int = 32000
    # Caps how deep the thinking goes. "high" is the API default and is what
    # exhausted the budget above; scoring against a written rubric does not
    # need it.
    score_effort: str = "medium"

    # Windowing
    min_duration: float = 20.0
    max_duration: float = 75.0
    pause_gap: float = 0.6
    rms_window: float = 5.0
    keep_top: int = 30
    max_region_overlap: float = 0.5
    profile: str = "talking_head"

    # Boundary rules
    start_pause_min: float = 0.4
    start_lookback_max: float = 3.0
    hook_backoff: float = 1.2
    end_pad: float = 0.4
    max_recut: int = 3
    # Sentence-final punctuation from the ASR. Measured on a real 20-minute
    # source: 5.1% of words carry it, and it is the ONLY reliable end-of-thought
    # signal available -- pause size is not. Gaps >=0.4s land on a sentence end
    # 23% of the time, and gaps >=1.0s land on one 0% of the time, so a bigger
    # pause is actively worse evidence than a smaller one.
    sentence_terminators: str = ".?!।"
    # How far to hunt for a clean sentence ending.
    sentence_search: float = 30.0
    # A clip that ends on a finished thought is worth a little length overrun;
    # 75s becomes ~86s at most. Ending mid-word to respect an exact cap is a
    # worse clip than a slightly longer one that lands.
    end_overshoot: float = 1.15

    # ---- assembly (multi-span clips) ----------------------------------
    max_spans: int = 5                 # beyond this it reads as a slideshow
    min_span_seconds: float = 3.0      # shorter spans read as choppy, not intentional
    plan_min_duration: float = 20.0
    plan_max_duration: float = 90.0
    # Two spans this close in source, and consecutive in playback, are really
    # one span. Merging them avoids rendering a transition across continuous
    # speech, which is audible and looks like a mistake.
    merge_gap: float = 0.35
    hard_join_max_gap: float = 1.5     # a short forward skip reads better as a cut
    fade_duration: float = 0.25
    # A "hard" cut is rendered as a one-frame dissolve. Visually identical to a
    # cut, and it keeps every join in one uniform xfade chain instead of
    # splicing concat and xfade filters together in the same graph.
    hard_duration: float = 0.04
    card_duration: float = 1.2
    plan_dedup_overlap: float = 0.6    # of the shorter plan, by source time

    # ---- boundary -----------------------------------------------------
    # Preferred end pause. Note (measured on a real 20-minute source): pauses
    # >=0.8s land on a sentence end only 10% of the time vs 23% at >=0.4s, so
    # this tier is weak on its own -- punctuation is ranked above it and does
    # most of the work.
    end_pause_strong: float = 0.8
    end_pause_strong_window: float = 2.5

    # Ranking
    w_hook: float = 0.5
    w_standalone: float = 0.3
    w_coherence: float = 0.2
    max_clip_overlap: float = 0.25
    top_n: int = 5

    # ---- source choppiness ---------------------------------------------
    # The reframe FOLLOWS the source. A stretch the editor intercut every 1.5s
    # becomes a reel that cuts every 1.5s -- each shot correctly framed, and
    # still unwatchable in a tight 9:16 crop. min_run cannot merge across a
    # source cut, because the person is not in the next frame at all, so the
    # only stage that can prevent it is selection.
    #
    # Applied as a multiplier on the prefilter score rather than as another
    # entry in Weights: the weights are a tuned set that must sum to 1.0, and
    # folding this in would mean rebalancing all of them for a signal that is
    # about the PICTURE rather than the speech.
    # Calibrated against a real 70-minute source averaging 9 cuts/min, whose
    # 30 surviving regions ran from 4.5 to 24.3 cuts/min. With the penalty off,
    # 8 of those 30 were above 12/min and one of them became the clip that was
    # reported as flashing (15.3/min). At limit=10 penalty=1.0 the survivors
    # top out at 11.8/min with the set still full at 30 -- decisive without
    # starving the LLM of candidates. A gentler 0.35 only moved the worst from
    # 24.3 to 16.7, which was not enough to change what got picked.
    scene_threshold: float = 0.3       # ffmpeg scene score for "a cut"
    max_cuts_per_minute: float = 10.0  # one every 6s; calmer than this is free
    cut_penalty: float = 1.0           # decay exponent past the limit; 0 = off
    # Renders are independent ffmpeg processes, so the top N can encode at
    # once. Past ~3 the encodes just contend for the same cores and each one
    # slows down as much as the batch gains; 1 restores the old serial path.
    render_workers: int = 3

    # ---- speaker-tracked reframe --------------------------------------
    reframe: bool = True
    # Detection runs on the low-res proxy: full-res detection is wasted work,
    # and 5fps is well below what the smoothing absorbs anyway.
    reframe_fps: float = 5.0
    reframe_score_threshold: float = 0.6
    # Below this fraction of frames carrying a face, fall back to centre crop.
    # Screen recordings, b-roll and drone shots must not break the pipeline.
    reframe_min_detection_ratio: float = 0.5

    # Tracking and identity
    track_iou: float = 0.3
    track_max_gap: int = 3             # sampled frames a track may go missing
    max_identities: int = 4

    # Camera behaviour
    #
    # The crop is LOCKED per speaker, not tracked. Following head movement
    # continuously reads as cheap; a static frame per person reads as directed.
    # Every switch is a hard cut: an eased pan between two people passes through
    # the midpoint, where nobody is standing.
    switch_hysteresis: float = 1.2     # a new speaker must hold this long
    # Minimum time the camera stays put once it has moved. A different control
    # from hysteresis, which only filters turns SHORTER than its threshold.
    # Measured: three switches landed inside 8.4s because speakers genuinely
    # alternated every ~4s, and raising hysteresis from 0.6s to 2.0s changed the
    # switch count not at all. Hard cuts make a burst more jarring, not less.
    min_dwell: float = 6.0
    # A new lock is taken when an identity's face position clusters more than
    # this far apart. On real footage one person sat at x=801 in one camera
    # angle and x=979 in another -- 14% of frame width. A single median lock
    # would have put them 160px off-centre in a 405px crop for 41 of 90 seconds.
    framing_tolerance: float = 0.08
    # Absorb any shot shorter than this into the one before it. These appear
    # when the editor cuts to someone for barely a second: the target is
    # genuinely visible at the switch instant and gone immediately after, so
    # no amount of look-ahead avoids them. Holding the previous, correct shot
    # for another second beats a 1.3s flash of the wrong thing.
    min_run: float = 2.0

    # Framing. Dead-centre vertical placement is the classic mistake that makes
    # a reframe look wrong, so the face sits high.
    face_anchor_y: float = 0.38
    reframe_zoom: float = 1.0

    # ---- split screen -------------------------------------------------
    # When both people are on camera, stacking them beats choosing one.
    layout: str = "auto"               # auto | single | split
    split_min_hold: float = 1.0        # both visible this long before splitting
    # Panel width is bounded by how far apart the locks are: two panels wider
    # than their separation would each contain BOTH faces, which looks like a
    # bug rather than a layout.
    split_panel_margin: float = 0.96   # of the available separation
    split_min_panel_width: float = 240.0

    # Output / captions
    out_width: int = 1080
    out_height: int = 1920
    caption_pos: str = "bottom"        # bottom | center | top
    caption_max_width_pct: float = 0.86
    caption_max_seconds: float = 1.6
    caption_fallback_max_chars: int = 28
    # Layout preset, loaded from styles/<name>.toml. Owns the canvas, where the
    # video sits inside it, the headline, and the caption look -- see
    # clipper/styles.py. "clean" reproduces the full-bleed output this tool
    # produced before presets existed, and a regression test holds it to that.
    #
    # NOT named `layout`: that is already the reframe's auto|single|split
    # choice, and two different meanings on one word in one dataclass is how a
    # caller sets the wrong one.
    style_preset: str = "clean"

    @property
    def layout_style(self):
        from . import styles

        return styles.get(self.style_preset)

    @property
    def video_rect(self):
        """
        Where the picture is drawn inside the canvas.

        Every crop and scale downstream sizes against THIS, not the canvas.
        For a full-bleed style the two are the same, which is what keeps the
        default output byte-identical to what this tool produced before
        presets existed.
        """
        return self.layout_style.video_rect(self.out_width, self.out_height)

    @property
    def video_w(self) -> int:
        return int(self.video_rect.w)

    @property
    def video_h(self) -> int:
        return int(self.video_rect.h)

    @property
    def weights(self) -> Weights:
        try:
            w = PROFILES[self.profile]
        except KeyError:
            raise ConfigError(
                f"Unknown profile {self.profile!r}",
                hint=f"Known profiles: {', '.join(sorted(PROFILES))}",
            ) from None
        w.validate()
        return w

    def require_sarvam(self) -> str:
        if not self.sarvam_api_key:
            raise ConfigError(
                "SARVAM_API_KEY is not set",
                hint="Add it to .env at the repo root. See SETUP.md.",
            )
        return self.sarvam_api_key

    def require_anthropic(self) -> str:
        if not self.anthropic_api_key:
            raise ConfigError(
                "ANTHROPIC_API_KEY is not set",
                hint="Add it to .env at the repo root. See SETUP.md.",
            )
        return self.anthropic_api_key


def load_settings(**overrides) -> Settings:
    """Read .env, then apply explicit CLI overrides on top."""
    load_dotenv(ROOT / ".env")
    s = Settings(
        sarvam_api_key=os.environ.get("SARVAM_API_KEY", ""),
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
    )
    for k, v in overrides.items():
        if v is None:
            continue
        if not hasattr(s, k):
            raise ConfigError(f"Unknown setting {k!r}")
        setattr(s, k, v)
    return s


# --------------------------------------------------------------- paths

@dataclass(frozen=True)
class Paths:
    """
    Layout for one video. Stage artifacts live under work/ so any stage can be
    re-run independently with --from.
    """
    name: str
    root: Path

    @property
    def work(self) -> Path: return self.root / "work"
    @property
    def meta(self) -> Path: return self.work / "meta.json"
    @property
    def audio(self) -> Path: return self.work / "audio.wav"
    @property
    def proxy(self) -> Path: return self.work / "proxy.mp4"
    @property
    def transcript(self) -> Path: return self.work / "transcript.json"
    @property
    def regions(self) -> Path: return self.work / "regions.json"
    @property
    def scores(self) -> Path: return self.work / "scores.json"
    @property
    def plans(self) -> Path: return self.work / "plans.json"
    @property
    def faces(self) -> Path: return self.work / "faces.json"
    @property
    def crop_path(self) -> Path: return self.work / "crop_path.json"
    @property
    def boundaries(self) -> Path: return self.work / "boundaries.json"
    @property
    def ranked(self) -> Path: return self.work / "ranked.json"
    @property
    def clips_json(self) -> Path: return self.root / "clips.json"
    @property
    def rejects(self) -> Path: return self.root / "rejects.jsonl"

    def clip(self, index: int, ext: str = "mp4") -> Path:
        return self.root / f"clip_{index:02d}.{ext}"

    def ensure(self) -> None:
        self.work.mkdir(parents=True, exist_ok=True)


def paths_for(video_name: str, out_dir: Path | None = None) -> Paths:
    base = (out_dir or OUT_ROOT) / video_name
    return Paths(name=video_name, root=base)
