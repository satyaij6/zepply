"""
Stage 7: render the top N plans.

A single-span plan takes the ORIGINAL code path, byte for byte -- one input,
one -vf chain, no filter_complex. That is deliberate: it is the case that
already works, and routing it through the assembly graph would re-encode it
differently for no benefit and turn every regression check into a false alarm.

Multi-span plans are dissolved together by assembler_render, then reframed and
captioned as one piece. Caption timings are in assembled time throughout, and
`assert_no_cue_straddles_a_join` fails the render rather than shipping a caption
that runs across a seam.

Vertical framing is a speaker-tracked reframe: the crop window follows whoever
is talking, driven per output frame through `sendcmd`. It degrades to a centre
crop -- loudly, never silently -- when detection finds too few faces, which is
what keeps screen recordings, b-roll and drone shots working.
"""
from __future__ import annotations

import json
import logging
import shutil
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from . import assembler_render, cover, emphasis, ffmpeg, reframe
from .assemble import join_windows
from .captions import (
    Cue, assert_no_cue_straddles_a_join, build_assembled_cues, build_cues,
    write_ass, write_srt,
)
from .config import ASSETS_DIR, FONT_PATH, Paths, Settings
from .errors import FFmpegError
from .models import ClipPlan, Word

log = logging.getLogger(__name__)

CAPTION_FONT_SIZE = 64

# Clips render in parallel, and two pieces of per-clip work touch shared state:
# staging the font (one dest file) and crop_path.json (read-modify-write of one
# file by every clip). Both are tiny next to an encode, so a plain lock costs
# nothing and keeps the parallel path writing exactly what the serial one did.
_FONT_LOCK = threading.Lock()
_CROP_PATH_LOCK = threading.Lock()
# Fallback only. The real rate comes from the source, because rendering at a
# different rate resamples every cut: detection times are source frame times,
# and at 25 -> 30 a boundary lands up to 2 frames off, which shows as a couple
# of frames of the previous framing on the new shot.
RENDER_FPS = 30


def source_fps(media_path: Path) -> int:
    """Frame rate of the source, so cut boundaries map to whole frames."""
    stream = ffmpeg.video_stream(media_path)
    rate = (stream or {}).get("r_frame_rate") or ""
    if "/" in rate:
        num, den = rate.split("/", 1)
        try:
            value = float(num) / float(den)
            if 1 < value < 121:
                return int(round(value))
        except (ValueError, ZeroDivisionError):
            pass
    return RENDER_FPS


def clear_output(path: Path, attempts: int = 6) -> None:
    """
    Remove a previous render before writing over it, retrying briefly.

    These outputs live under a OneDrive-synced folder, and OneDrive holds a
    file open while it uploads. Measured: all three renders of a re-run failed
    with "Error opening output ...: Permission denied" because the previous
    clips -- tens of megabytes each -- were mid-sync. The lock is transient, so
    a short backoff clears it; failing the whole render over it wastes a minute
    of encoding for a file that is free a second later.
    """
    for attempt in range(attempts):
        if not path.exists():
            return
        try:
            path.unlink()
            return
        except PermissionError:
            if attempt == attempts - 1:
                raise FFmpegError(
                    f"{path.name} is locked by another process",
                    hint=("Something is holding the previous render open -- a "
                          "video player, or OneDrive mid-sync. Close it, or "
                          "move the output directory outside OneDrive with "
                          "--out."),
                )
            time.sleep(0.5 * (attempt + 1))


def _stage_font(out_dir: Path, font_path: Path = FONT_PATH) -> Path:
    """
    Put the font next to the .ass file.

    ffmpeg runs with cwd=out_dir and bare relative paths, because the subtitle
    filters split arguments on ':' -- an absolute Windows path would be parsed
    as a filter option and the graph would fail to build.
    """
    fonts = out_dir / "fonts"
    dest = fonts / font_path.name
    # Without the lock two threads can both see a missing dest and copy over
    # each other, leaving ffmpeg a half-written font to shape Telugu with.
    with _FONT_LOCK:
        fonts.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            shutil.copy(font_path, dest)
    return fonts


def card_cues(plan: ClipPlan, settings: Settings) -> list[Cue]:
    """Labels for spans introduced by a `card` join, in assembled time."""
    cues: list[Cue] = []
    for n, join in enumerate(plan.joins):
        if join.type != "card" or not join.label or n + 1 >= len(plan.spans):
            continue
        span = plan.spans[n + 1]
        start = span.playback_start
        end = min(start + settings.card_duration, span.playback_end)
        if end > start:
            cues.append(Cue(start=start, end=end, text=join.label))
    return cues


def _write_crop_path(paths: Paths, index: int, paths_used: list) -> None:
    """
    Record what the camera decided, per clip.

    Written even when the reframe fell back, because "why is this centre
    cropped" is exactly the question this file has to answer.
    """
    # Read-modify-write of one file shared by every clip: unlocked, two
    # parallel renders both read the same `existing` and the second write
    # drops the first clip's entry entirely.
    with _CROP_PATH_LOCK:
        existing: dict = {}
        if paths.crop_path.exists():
            try:
                existing = json.loads(paths.crop_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                existing = {}
        existing[f"clip_{index:02d}"] = [p.to_dict() for p in paths_used if p]
        paths.crop_path.parent.mkdir(parents=True, exist_ok=True)
        paths.crop_path.write_text(json.dumps(existing, indent=2), encoding="utf-8")


def render_plan(
    plan: ClipPlan, index: int, words: list[Word], media_path: Path, paths: Paths,
    settings: Settings, *, burn_captions: bool = True, reframe_ctx=None,
    source_size: tuple[int, int] | None = None, debug_reframe: bool = False,
    fps: int = RENDER_FPS, frame_plans: list | None = None,
    punches: list | None = None, cover_text: str | None = None,
) -> tuple[Path, Path]:
    out_dir = paths.root
    out_dir.mkdir(parents=True, exist_ok=True)
    layout = settings.layout_style
    _stage_font(out_dir, ASSETS_DIR / layout.captions['font'])
    if layout.headline['enabled']:
        # Both headline faces are staged. libass substitutes a missing glyph
        # from whatever is in this directory, so staging the fallback is what
        # turns "it happened to work" into "it is declared to work" -- and the
        # style loader has already checked the pair can draw the script.
        _stage_font(out_dir, ASSETS_DIR / layout.headline['font'])
        _stage_font(out_dir, ASSETS_DIR / layout.headline['fallback_font'])

    video = paths.clip(index, "mp4")
    ass = paths.clip(index, "ass")
    srt = paths.clip(index, "srt")
    clear_output(video)
    single = len(plan.spans) == 1

    if single:
        span = plan.spans[0]
        cues = build_cues(words, span.source_start, span.source_end, settings,
                          font_size=CAPTION_FONT_SIZE)
        cards: list[Cue] = []
    else:
        cues = build_assembled_cues(plan, words, settings,
                                    font_size=CAPTION_FONT_SIZE)
        cards = card_cues(plan, settings)
        assert_no_cue_straddles_a_join(cues, join_windows(plan))

    write_ass(cues, ass, settings, font_size=CAPTION_FONT_SIZE, cards=cards,
              headline_text=plan.suggested_title)
    write_srt(cues, srt)
    log.info(
        "cut: clip_%02d %s %.1fs, %d span(s), %d cues%s",
        index, plan.format, plan.total_duration, len(plan.spans), len(cues),
        f", {len(cards)} label(s)" if cards else "",
    )

    zoom = emphasis.zoom_chain(punches or [], settings, fps)
    if single:
        _render_single(plan, video, ass, media_path, settings,
                       burn_captions=burn_captions, out_dir=out_dir,
                       reframe_ctx=reframe_ctx, index=index,
                       source_size=source_size, paths=paths, fps=fps,
                       frame_plans=frame_plans, zoom=zoom)
    else:
        _render_assembled(plan, video, ass, media_path, settings,
                          burn_captions=burn_captions, out_dir=out_dir,
                          reframe_ctx=reframe_ctx, index=index,
                          source_size=source_size, paths=paths, fps=fps,
                          frame_plans=frame_plans, zoom=zoom)

    if debug_reframe and reframe_ctx is not None:
        _render_debug_overlays(plan, index, reframe_ctx, paths, settings)

    if not video.exists() or video.stat().st_size < 1024:
        raise FFmpegError(
            f"clip_{index:02d} produced no usable video",
            hint="Check the source still exists and every span is inside it.",
        )

    if settings.covers:
        _stage_font(out_dir, ASSETS_DIR / cover.FONT)
        _stage_font(out_dir, ASSETS_DIR / cover.FALLBACK_FONT)
        if frame_plans is None:
            frame_plans = plan_framings(plan, reframe_ctx, settings,
                                        source_size=source_size, fps=fps)
        cover.render(plan, index, media_path, out_dir, settings,
                     frame_plans=frame_plans, ctx=reframe_ctx, fps=fps,
                     text=cover_text or plan.suggested_title)
    return video, srt


def plan_framings(plan: ClipPlan, ctx, settings: Settings, *,
                  source_size: tuple[int, int] | None, fps: int) -> list:
    """
    Framing plans for every span of one clip.

    Split out from the render so it can run BEFORE the encode pool. Planning is
    pure Python and holds the GIL, so doing it inside the pool serialises it
    anyway -- and worse, holds every ffmpeg call behind all of the planning.
    Each span gets its own plan: a compilation cuts between moments that may be
    framed completely differently, and one plan across the assembled timeline
    would carry framing from one shot into another.
    """
    source_w, source_h = source_size or (settings.out_width, settings.out_height)
    return [
        _frame_plan(ctx, span, settings, source_w=source_w, source_h=source_h,
                    fps=fps)
        for span in plan.spans
    ]


def _frame_plan(ctx, span, settings: Settings, *, source_w: int, source_h: int,
                fps: int):
    """Framing runs for one span, or None when reframing is unavailable."""
    if ctx is None:
        return None
    plan = reframe.path_for_span(
        ctx, start=span.source_start, duration=span.duration, fps=fps,
        source_w=source_w, source_h=source_h, settings=settings,
    )
    return None if plan.fallback else plan


def _render_single(
    plan: ClipPlan, video: Path, ass: Path, media_path: Path, settings: Settings,
    *, burn_captions: bool, out_dir: Path, reframe_ctx=None, index: int = 1,
    source_size: tuple[int, int] | None = None, paths: Paths | None = None,
    fps: int = RENDER_FPS, frame_plans: list | None = None, zoom: str = "",
) -> None:
    """
    Single-span path.

    Kept separate from the assembly graph: it is the case that already works,
    and routing it through concat would re-encode it differently for no benefit.
    A span with one layout run is one static crop and one input, which is the
    simplest command the tool can emit.
    """
    span = plan.spans[0]
    if frame_plans is None:
        frame_plans = plan_framings(plan, reframe_ctx, settings,
                                    source_size=source_size, fps=fps)
    fp = frame_plans[0]
    if paths is not None:
        _write_crop_path(paths, index, [fp] if fp else [])

    if fp is None:
        crop = reframe.centre_crop_chain(settings)
        pad = reframe.pad_to_canvas(settings)
        chain = ",".join(part for part in (crop, zoom, pad) if part)
        vf = (f"{chain},ass={ass.name}:fontsdir=fonts:shaping=complex"
              if burn_captions else chain)
        ffmpeg.run(
            ["-ss", f"{span.source_start:.3f}", "-t", f"{span.duration:.3f}",
             "-i", str(media_path), "-vf", vf,
             "-c:v", "libx264", "-preset", "medium", "-crf", "20",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
             "-movflags", "+faststart", video.name],
            cwd=out_dir, what=f"{video.stem} render (centre crop)",
        )
        return

    parts, vlabel, used = reframe.build_span_graph(
        fp, settings, first_input=0, label="s0", fps=fps
    )
    parts.append(
        f"[{used}:a]aformat=sample_fmts=fltp:sample_rates=48000"
        f":channel_layouts=stereo,asetpts=PTS-STARTPTS[aout]"
    )
    if zoom:
        parts.append(f"[{vlabel}]{zoom}[vzoom]")
        vlabel = "vzoom"
    pad = reframe.pad_to_canvas(settings)
    if pad:
        parts.append(f"[{vlabel}]{pad}[vpad]")
        vlabel = "vpad"
    if burn_captions:
        parts.append(f"[{vlabel}]ass={ass.name}:fontsdir=fonts:shaping=complex[vout]")
        vlabel = "vout"

    ffmpeg.run(
        [*reframe.span_inputs(fp, str(media_path), span.source_start, span.duration),
         "-filter_complex", ";".join(parts),
         "-map", f"[{vlabel}]", "-map", "[aout]",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart", video.name],
        cwd=out_dir,
        what=f"{video.stem} render ({reframe.describe(fp)})",
    )


def _render_assembled(
    plan: ClipPlan, video: Path, ass: Path, media_path: Path, settings: Settings,
    *, burn_captions: bool, out_dir: Path, reframe_ctx=None, index: int = 1,
    source_size: tuple[int, int] | None = None, paths: Paths | None = None,
    fps: int = RENDER_FPS, frame_plans: list | None = None, zoom: str = "",
) -> None:
    if frame_plans is None:
        frame_plans = plan_framings(plan, reframe_ctx, settings,
                                    source_size=source_size, fps=fps)
    if paths is not None and any(frame_plans):
        _write_crop_path(paths, index, frame_plans)

    args = assembler_render.build_command(
        plan, str(media_path), video.name, settings,
        ass_name=ass.name if burn_captions else None, fps=fps,
        frame_plans=frame_plans, zoom=zoom,
    )
    ffmpeg.run(args, cwd=out_dir,
               what=f"{video.stem} render ({len(plan.spans)} spans)")


def _render_debug_overlays(
    plan: ClipPlan, index: int, ctx, paths: Paths, settings: Settings,
) -> None:
    """
    Proxy with each run's crop window drawn, so a framing decision can be
    reviewed without re-rendering finals.
    """
    from .reframe.render import describe

    for part, span in enumerate(plan.spans):
        try:
            fp = reframe.path_for_span(
                ctx, start=span.source_start, duration=span.duration,
                fps=RENDER_FPS,
                source_w=ctx.detections.width, source_h=ctx.detections.height,
                settings=settings,
            )
            boxes = []
            for run in fp.runs:
                targets = (run.panels if run.kind == "split"
                           else [type("P", (), {"crop_x": run.crop_x,
                                                "crop_y": run.crop_y,
                                                "crop_w": fp.crop_w,
                                                "crop_h": fp.crop_h})()])
                for t in targets:
                    boxes.append(
                        f"drawbox=x={int(t.crop_x)}:y={int(t.crop_y)}"
                        f":w={int(t.crop_w)}:h={int(t.crop_h)}"
                        f":color={'cyan' if run.kind == 'split' else 'yellow'}@0.9"
                        f":t=3:enable='between(t,{run.start:.2f},{run.end:.2f})'"
                    )
            dest = paths.root / f"clip_{index:02d}_s{part}_debug.mp4"
            ffmpeg.run(
                ["-ss", f"{span.source_start:.3f}", "-t", f"{span.duration:.3f}",
                 "-i", str(ctx.proxy_path), "-vf", ",".join(boxes) or "null",
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
                 "-an", dest.name],
                cwd=paths.root, what=f"clip_{index:02d} debug overlay",
            )
            log.info("reframe: debug overlay -> %s (%s)", dest, describe(fp))
        except Exception as exc:  # noqa: BLE001 - a debug aid must never fail a run
            log.warning("reframe: debug overlay for clip_%02d span %d failed: %s",
                        index, part, exc)


def cut_plans(
    plans: list[ClipPlan], words: list[Word], media_path: Path, paths: Paths,
    settings: Settings, *, top_n: int | None = None, burn_captions: bool = True,
    asr_cache: Path | None = None, debug_reframe: bool = False,
    kit: dict | None = None,
) -> list[dict]:
    ffmpeg.ensure_caption_stack(
        ASSETS_DIR / settings.layout_style.captions['font'])
    if not media_path.exists():
        raise FFmpegError(
            f"Source media not found: {media_path}",
            hint="It may have moved since ingest. Re-run --from ingest.",
        )

    stream = ffmpeg.video_stream(media_path)
    source_size = ((int(stream["width"]), int(stream["height"]))
                   if stream and "width" in stream else None)
    fps = source_fps(media_path)
    log.info("cut: rendering at the source rate (%dfps) so cut boundaries land "
             "on whole frames", fps)

    # Detection and speaker matching are whole-video and cached, so this runs
    # once no matter how many clips get cut.
    ctx = reframe.prepare(
        paths, settings, proxy_path=paths.proxy,
        source_w=source_size[0] if source_size else settings.out_width,
        asr_cache=asr_cache,
    )

    selected = plans[: top_n if top_n is not None else settings.top_n]

    clip_kits = (kit or {}).get("clips", {})

    def _entry(n: int, plan: ClipPlan, video: Path, srt: Path) -> dict:
        entry = plan.to_dict()
        entry["index"] = n
        entry["video_path"] = str(video)
        entry["srt_path"] = str(srt)
        cover_path = paths.root / f"clip_{n:02d}_cover.jpg"
        entry["cover_path"] = str(cover_path) if cover_path.exists() else None
        entry["punches"] = [p.to_dict() for p in punches.get(n, [])]
        entry.update(clip_kits.get(str(n), {}))
        entry["final_score"] = round(
            plan.final(settings.w_hook, settings.w_standalone, settings.w_coherence), 4
        )
        return entry

    # Plan every clip's framing BEFORE any encode starts.
    #
    # Planning is pure Python and holds the GIL, so running it inside the pool
    # gains nothing and costs the thing parallelism was for: measured on a
    # 70-minute source, three threads planning at once pinned ONE core for ~9
    # minutes and no ffmpeg started until a thread finished. Serial here, so the
    # first encode begins as soon as the first plan is ready.
    framings: dict[int, list] = {}
    punches: dict[int, list] = {}
    started = time.monotonic()
    for n, plan in enumerate(selected, 1):
        framings[n] = plan_framings(plan, ctx, settings,
                                    source_size=source_size, fps=fps)
        try:
            punches[n] = emphasis.choose(plan, words, paths.audio, settings,
                                         frame_plans=framings[n])
        except Exception as exc:  # noqa: BLE001 - an effect must never cost the clip
            log.warning("cut: clip_%02d punch-ins skipped: %s", n, exc)
            punches[n] = []
        log.debug("cut: clip_%02d framing planned (%.1fs elapsed)",
                  n, time.monotonic() - started)
    if ctx is not None:
        log.info("cut: planned framing for %d clips in %.1fs",
                 len(selected), time.monotonic() - started)

    def _render(n: int, plan: ClipPlan):
        return render_plan(plan, n, words, media_path, paths, settings,
                           burn_captions=burn_captions, reframe_ctx=ctx,
                           source_size=source_size,
                           debug_reframe=debug_reframe, fps=fps,
                           frame_plans=framings[n], punches=punches[n],
                           cover_text=clip_kits.get(str(n), {}).get("cover_text"))

    # What remains per clip IS an independent ffmpeg process, so threads are
    # enough here: the GIL is released while the subprocess encodes. `ctx` is
    # computed once by prepare() above and only read from here, so sharing it
    # across the pool is safe.
    workers = max(1, min(settings.render_workers, len(selected)))
    done: dict[int, dict] = {}
    if workers == 1:
        for n, plan in enumerate(selected, 1):
            try:
                done[n] = _entry(n, plan, *_render(n, plan))
            except (FFmpegError, AssertionError) as exc:
                # One bad clip must not lose the others.
                log.error("cut: clip_%02d (%s) failed: %s", n, plan.id, exc)
    else:
        log.info("cut: rendering %d clips, %d at a time", len(selected), workers)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(_render, n, plan): (n, plan)
                       for n, plan in enumerate(selected, 1)}
            for future in as_completed(futures):
                n, plan = futures[future]
                try:
                    done[n] = _entry(n, plan, *future.result())
                except (FFmpegError, AssertionError) as exc:
                    # One bad clip must not lose the others.
                    log.error("cut: clip_%02d (%s) failed: %s", n, plan.id, exc)

    # as_completed yields in finish order; clips.json stays in rank order.
    rendered = [done[n] for n in sorted(done)]

    write_clips_json(rendered, paths, settings, kit=kit)
    log.info("cut: rendered %d/%d clips -> %s", len(rendered), len(selected), paths.root)
    return rendered


def write_clips_json(clips: list[dict], paths: Paths, settings: Settings,
                     *, kit: dict | None = None) -> Path:
    payload = {
        "video": paths.name,
        "weights": {
            "hook": settings.w_hook,
            "standalone": settings.w_standalone,
            "coherence": settings.w_coherence,
        },
        "profile": settings.profile,
        "score_model": settings.score_model,
        "clips": clips,
        "source_kit": (kit or {}).get("source"),
    }
    paths.clips_json.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return paths.clips_json
