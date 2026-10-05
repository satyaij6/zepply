"""
Stage A: find faces across the whole video, once.

Runs on the analysis PROXY, which is what the proxy was generated for. Full-res
detection buys nothing -- a face that is 110px wide in the 854x480 proxy is
plenty for a centroid, and the crop path is smoothed afterwards anyway.

Detector: YuNet via `cv2.FaceDetectorYN`, already present in OpenCV, so this
adds no new dependency. The alternative worth naming is ultralytics/YOLOv8-face,
which was rejected because installing it upgrades torch (2.13 -> 2.14) out from
under the MMS_FA forced aligner. Trading a working stage for a new one is a bad
deal. MediaPipe would also have worked and is light; YuNet simply needs nothing
at all. Measured on this machine: 15.8 ms/frame at 854x480 (63 fps, CPU), so a
70-minute source costs about five and a half minutes -- once, then cached.

Mouth motion is computed HERE rather than in a second pass. Recovering it later
would mean decoding the whole video again, and storing raw mouth patches would
bloat the cache by megabytes. Instead each face is matched against the nearest
face in the previous sampled frame and scored on how much its mouth region
changed, collapsing the whole question to one float per face.
"""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path

from ..config import YUNET_PATH, YUNET_URL, Settings
from ..errors import ClipperError

log = logging.getLogger(__name__)

CACHE_VERSION = 3
# Around a shot change, re-detect at full frame rate. 5fps is ample for knowing
# WHERE a face is, but it locates WHEN the source cut only to within 0.2s -- and
# with locked framing and hard cuts, that lag is visible as a flash of the
# previous framing right before each cut. Refining only the transitions costs a
# few hundred extra frames instead of tripling the whole pass.
REFINE_WINDOW = 0.30
# Mouth patches are normalised to this before differencing, so a face close to
# camera is not automatically scored as more talkative than one further away.
MOUTH_PATCH = (24, 16)
MOUTH_MATCH_IOU = 0.3


class ReframeError(ClipperError):
    """Detection could not run at all (missing model, unreadable proxy)."""


@dataclass
class Face:
    x: float
    y: float
    w: float
    h: float
    score: float
    # YuNet returns five landmarks; the last two are the mouth corners, which
    # put the mouth ROI on the actual mouth instead of guessing at the lower
    # third of the box.
    landmarks: list[list[float]] = field(default_factory=list)
    mouth_motion: float | None = None

    @property
    def cx(self) -> float:
        return self.x + self.w / 2

    @property
    def cy(self) -> float:
        return self.y + self.h / 2

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Face":
        return cls(x=d["x"], y=d["y"], w=d["w"], h=d["h"], score=d["score"],
                   landmarks=d.get("landmarks", []),
                   mouth_motion=d.get("mouth_motion"))


@dataclass
class Sample:
    t: float
    faces: list[Face]

    def to_dict(self) -> dict:
        return {"t": round(self.t, 3), "faces": [f.to_dict() for f in self.faces]}

    @classmethod
    def from_dict(cls, d: dict) -> "Sample":
        return cls(t=d["t"], faces=[Face.from_dict(f) for f in d["faces"]])


@dataclass
class Detections:
    width: int
    height: int
    fps: float
    duration: float
    samples: list[Sample]

    @property
    def detection_ratio(self) -> float:
        if not self.samples:
            return 0.0
        return sum(1 for s in self.samples if s.faces) / len(self.samples)

    @property
    def max_faces(self) -> int:
        return max((len(s.faces) for s in self.samples), default=0)

    def to_dict(self) -> dict:
        return {
            "version": CACHE_VERSION,
            "width": self.width, "height": self.height,
            "fps": self.fps, "duration": round(self.duration, 3),
            "detection_ratio": round(self.detection_ratio, 4),
            "max_faces": self.max_faces,
            "samples": [s.to_dict() for s in self.samples],
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Detections":
        return cls(width=d["width"], height=d["height"], fps=d["fps"],
                   duration=d["duration"],
                   samples=[Sample.from_dict(s) for s in d["samples"]])


# ------------------------------------------------------------------ helpers

def file_hash(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while block := fh.read(chunk):
            h.update(block)
    return h.hexdigest()


def ensure_model(path: Path = YUNET_PATH) -> Path:
    if path.exists():
        return path
    raise ReframeError(
        f"Face detection model missing: {path}",
        hint=f"Download it once from {YUNET_URL} into assets/ (227 KB). "
             f"See SETUP.md.",
    )


def iou(a: Face, b: Face) -> float:
    lo_x, lo_y = max(a.x, b.x), max(a.y, b.y)
    hi_x = min(a.x + a.w, b.x + b.w)
    hi_y = min(a.y + a.h, b.y + b.h)
    if hi_x <= lo_x or hi_y <= lo_y:
        return 0.0
    inter = (hi_x - lo_x) * (hi_y - lo_y)
    union = a.w * a.h + b.w * b.h - inter
    return inter / union if union > 0 else 0.0


def _mouth_patch(gray, face: Face):
    """
    A normalised grey patch around the mouth.

    Sized from the mouth-corner landmarks when available, and from the lower
    third of the bbox when they are not, so detection still works if a future
    detector returns no landmarks.
    """
    import cv2
    import numpy as np

    if len(face.landmarks) >= 5:
        (rx, ry), (lx, ly) = face.landmarks[3], face.landmarks[4]
        cx, cy = (rx + lx) / 2, (ry + ly) / 2
        half_w = max(abs(lx - rx) * 0.9, face.w * 0.18)
        half_h = max(face.h * 0.14, 4.0)
    else:
        cx, cy = face.cx, face.y + face.h * 0.78
        half_w, half_h = face.w * 0.28, face.h * 0.14

    x0 = int(max(0, cx - half_w))
    x1 = int(min(gray.shape[1], cx + half_w))
    y0 = int(max(0, cy - half_h))
    y1 = int(min(gray.shape[0], cy + half_h))
    if x1 - x0 < 4 or y1 - y0 < 3:
        return None
    return cv2.resize(gray[y0:y1, x0:x1], MOUTH_PATCH,
                      interpolation=cv2.INTER_AREA).astype(np.float32)


def _layout_of(sample: Sample, bucket: float = 100.0) -> tuple:
    """A coarse signature of who is where, used only to spot shot changes."""
    return tuple(sorted(round(f.cx / bucket) for f in sample.faces))


def _refine_transitions(cap, detector, samples: list[Sample], src_fps: float,
                        width: int, height: int) -> list[Sample]:
    """
    Re-detect at full rate around each shot change.

    The coarse pass says a cut happened somewhere in the 0.2s between two
    samples; this pins it to the frame. Measured before adding it, every empty
    frame in a render sat in the 0.07s immediately before a run boundary --
    the crop holding the old framing until the next coarse sample proved the
    subject had gone.
    """
    import cv2

    changes = [
        samples[i].t for i in range(1, len(samples))
        if _layout_of(samples[i]) != _layout_of(samples[i - 1])
    ]
    if not changes:
        return samples

    extra: list[Sample] = []
    for t in changes:
        lo = max(0.0, t - REFINE_WINDOW)
        start_frame = int(round(lo * src_fps))
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        for k in range(int(round(REFINE_WINDOW * src_fps)) + 1):
            ok, frame = cap.read()
            if not ok:
                break
            ft = (start_frame + k) / src_fps
            if any(abs(ft - s.t) < 1e-3 for s in samples):
                continue
            detector.setInputSize((frame.shape[1], frame.shape[0]))
            _, raw = detector.detect(frame)
            faces = [
                Face(x=float(r[0]), y=float(r[1]), w=float(r[2]), h=float(r[3]),
                     score=float(r[-1]),
                     landmarks=[[float(r[4 + 2 * i]), float(r[5 + 2 * i])]
                                for i in range(5)])
                for r in (raw if raw is not None else [])
            ]
            extra.append(Sample(t=ft, faces=faces))

    merged = sorted(samples + extra, key=lambda s: s.t)
    log.info("reframe: refined %d shot change(s) with %d extra frames "
             "(cut timing now accurate to ~%.0fms)",
             len(changes), len(extra), 1000 / src_fps)
    return merged


# ------------------------------------------------------------------ detection

def detect(
    proxy_path: Path, cache_path: Path, settings: Settings,
    *, use_cache: bool = True,
) -> Detections:
    """Detect faces across the entire proxy, cached by proxy hash + parameters."""
    import cv2
    import numpy as np

    model = ensure_model()
    digest = file_hash(proxy_path)[:16]
    key = (f"{digest}-{settings.reframe_fps}-{settings.reframe_score_threshold}"
           f"-v{CACHE_VERSION}")

    if use_cache and cache_path.exists():
        try:
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            if cached.get("key") == key:
                log.info("reframe: face cache hit (%s)", cache_path.name)
                return Detections.from_dict(cached["detections"])
            log.info("reframe: face cache is stale, re-detecting")
        except (json.JSONDecodeError, KeyError):
            log.warning("reframe: face cache unreadable, re-detecting")

    cap = cv2.VideoCapture(str(proxy_path))
    if not cap.isOpened():
        raise ReframeError(
            f"Could not open the analysis proxy: {proxy_path}",
            hint="Re-run --from ingest to regenerate it.",
        )

    src_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, int(round(src_fps / settings.reframe_fps)))

    detector = cv2.FaceDetectorYN.create(
        str(model), "", (width, height),
        score_threshold=settings.reframe_score_threshold,
    )
    log.info("reframe: detecting on %s (%dx%d @ %.1ffps, every %d frames)",
             proxy_path.name, width, height, src_fps, step)

    samples: list[Sample] = []
    prev_faces: list[Face] = []
    prev_patches: list = []
    index = 0

    while True:
        # grab() advances without decoding, so skipped frames cost almost
        # nothing -- far cheaper than seeking per sample on a long file.
        if not cap.grab():
            break
        if index % step:
            index += 1
            continue
        ok, frame = cap.retrieve()
        index += 1
        if not ok:
            continue

        t = (index - 1) / src_fps
        detector.setInputSize((frame.shape[1], frame.shape[0]))
        _, raw = detector.detect(frame)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        faces: list[Face] = []
        patches: list = []
        for row in (raw if raw is not None else []):
            face = Face(
                x=float(row[0]), y=float(row[1]), w=float(row[2]), h=float(row[3]),
                score=float(row[-1]),
                landmarks=[[float(row[4 + 2 * i]), float(row[5 + 2 * i])]
                           for i in range(5)],
            )
            patch = _mouth_patch(gray, face)
            # Match to the previous sample only when the boxes genuinely
            # overlap. Across a hard cut the nearest face is a different
            # person, and differencing their mouths is noise, not speech.
            if patch is not None and prev_faces:
                best = max(range(len(prev_faces)),
                           key=lambda k: iou(face, prev_faces[k]))
                if iou(face, prev_faces[best]) >= MOUTH_MATCH_IOU \
                        and prev_patches[best] is not None:
                    diff = np.abs(patch - prev_patches[best])
                    face.mouth_motion = round(float(diff.mean()), 4)
            faces.append(face)
            patches.append(patch)

        samples.append(Sample(t=t, faces=faces))
        prev_faces, prev_patches = faces, patches

        if total and len(samples) % 600 == 0:
            log.info("reframe: %d samples (%.0f%%)", len(samples),
                     100 * index / total)

    samples = _refine_transitions(cap, detector, samples, src_fps, width, height)
    cap.release()

    duration = index / src_fps if src_fps else 0.0
    result = Detections(width=width, height=height, fps=settings.reframe_fps,
                        duration=duration, samples=samples)
    log.info("reframe: %d samples, %.0f%% carry a face, up to %d face(s) at once",
             len(samples), 100 * result.detection_ratio, result.max_faces)

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(
        json.dumps({"key": key, "proxy": str(proxy_path),
                    "detections": result.to_dict()}, ensure_ascii=False),
        encoding="utf-8",
    )
    return result
