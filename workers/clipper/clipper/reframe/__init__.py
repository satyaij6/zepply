"""Speaker-tracked reframe: 16:9 source -> 9:16 output that follows the talker."""

from .detect import Detections, Face, ReframeError, Sample, detect
from .active import (
    Assignment, Identity, Track, assign_speakers, build_tracks,
    cluster_identities, is_single_face, turns_from_transcript,
)
from .path import (
    FramePlan, Lock, Panel, Run, build_locks, build_panels, build_plan,
    enforce_min_dwell, apply_hysteresis, jitter, lock_for,
)
from .plan import ReframeContext, path_for_span, prepare
from .render import (
    build_span_graph, centre_crop_chain, describe, pad_to_canvas,
    single_chain, span_inputs,
    split_chains,
)

__all__ = [
    "Detections", "Face", "ReframeError", "Sample", "detect",
    "Assignment", "Identity", "Track", "assign_speakers", "build_tracks",
    "cluster_identities", "is_single_face", "turns_from_transcript",
    "FramePlan", "Lock", "Panel", "Run", "build_locks", "build_panels",
    "build_plan", "enforce_min_dwell", "apply_hysteresis", "jitter", "lock_for",
    "build_span_graph", "centre_crop_chain", "describe", "pad_to_canvas",
    "single_chain",
    "span_inputs", "split_chains",
    "ReframeContext", "prepare", "path_for_span",
]
