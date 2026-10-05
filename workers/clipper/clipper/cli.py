"""
Command line entry point.

    clipper run <file|url> [--from STAGE] [--top N] [--profile P]
    clipper reject <video> <clip_id> --reason "..."
    clipper explain <video> [region_id]

Every stage writes its output to work/ and can be resumed with --from, so a
failure in scoring never costs another transcription.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import scenes, store
from .assemble import assemble, finalize, plans_payload
from .boundary import resolve_plans
from .config import PROFILES, load_settings, paths_for
from .cut import cut_plans
from .errors import ClipperError
from .ingest import ingest, name_for_url, slugify
from .models import ClipPlan, Region, Word, words_from_json
from .prefilter import build_regions
from .rank import rank as rank_plans
from .rubric import load_rubric
from .score import RUBRIC_PATH, score_regions
from .store import STAGES, read_json, stage_index, write_json
from .transcribe import transcribe

log = logging.getLogger("clipper")


def _setup_logging(verbose: bool) -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)-7s %(name)s: %(message)s",
    )


def _load_words(paths) -> list[Word]:
    payload = read_json(paths.transcript, stage="prefilter", produced_by="transcribe")
    return words_from_json(payload["words"])


def _load_regions(paths) -> tuple[list[Region], list[Region]]:
    payload = read_json(paths.regions, stage="score", produced_by="prefilter")
    return (
        [Region.from_dict(d) for d in payload["regions"]],
        [Region.from_dict(d) for d in payload.get("near_misses", [])],
    )


def cmd_run(args: argparse.Namespace) -> int:
    settings = load_settings(
        profile=args.profile, top_n=args.top, keep_top=args.keep_top,
        score_model=args.model, caption_pos=args.caption_pos,
        style_preset=args.style_preset,
        reframe=(False if args.no_reframe else None),
        layout=args.layout, render_workers=args.render_workers,
    )
    name = args.name or (name_for_url(args.source) if "://" in args.source
                         else slugify(Path(args.source).stem))
    paths = paths_for(name, Path(args.out) if args.out else None)
    paths.ensure()

    start_at = stage_index(args.from_stage)
    if start_at > 0:
        store.check_resume(args.from_stage, paths)

    def should(stage: str) -> bool:
        return stage_index(stage) >= start_at

    # ---- ingest ----------------------------------------------------
    if should("ingest"):
        meta = ingest(args.source, paths, force=args.force)
    else:
        meta_raw = read_json(paths.meta, stage=args.from_stage, produced_by="ingest")
        from .ingest import Meta

        meta = Meta.from_dict(meta_raw)

    # ---- transcribe ------------------------------------------------
    if should("transcribe"):
        words = transcribe(paths, settings, audio_hash=meta.audio_sha256,
                           use_cache=not args.no_cache, device=args.device)
    else:
        words = _load_words(paths)
    log.info("run: %d words", len(words))

    # ---- prefilter (PASS 1, no LLM) --------------------------------
    if should("prefilter"):
        # Where the SOURCE cuts, so choppy stretches lose before they can
        # become clips. One cached decode of the proxy; 37s on a 70-minute
        # source, against transcription's tens of minutes.
        cuts = scenes.cuts_for(paths, settings) if settings.cut_penalty > 0 else []
        regions, near_misses = build_regions(words, paths.audio, settings,
                                             cuts=cuts)
        write_json(paths.regions, {
            "profile": settings.profile,
            "weights": vars(settings.weights),
            "kept": len(regions),
            "regions": [r.to_dict() for r in regions],
            "near_misses": [r.to_dict() for r in near_misses],
        })
    else:
        regions, near_misses = _load_regions(paths)
    log.info("run: %d regions survive the gate", len(regions))
    if not regions:
        log.error("run: nothing survived the prefilter; nothing to score")
        return 1

    if args.dry_run:
        from .score import build_prompt, estimate_tokens
        from .rubric import load_rubric as _lr

        rubric_text, formats, _ = _lr(RUBRIC_PATH)
        prompt = build_prompt(words, regions, formats, settings)
        tokens = estimate_tokens(prompt) + estimate_tokens(rubric_text)
        log.info("run: --dry-run stops here. The whole transcript (%d words) plus "
                 "%d hint regions is ~%dk tokens in ONE call to %s. Formats: %s",
                 len(words), len(regions), tokens // 1000, settings.score_model,
                 ", ".join(sorted(formats)))
        return 0

    # ---- score (PASS 2, LLM) ---------------------------------------
    if should("score"):
        plans, formats, rubric_hash = score_regions(words, regions, settings)
        write_json(paths.scores, {
            "model": settings.score_model,
            "rubric_sha256": rubric_hash,
            "formats_declared": sorted(formats),
            "plans": [p.to_dict() for p in plans],
        })
    else:
        payload = read_json(paths.scores, stage=args.from_stage, produced_by="score")
        plans = [ClipPlan.from_dict(d) for d in payload["plans"]]
        _, formats, rubric_hash = load_rubric(RUBRIC_PATH)

    # ---- assemble --------------------------------------------------
    if should("assemble"):
        accepted, rejected = assemble(plans, words, formats, settings)
    else:
        payload = read_json(paths.plans, stage=args.from_stage, produced_by="assemble")
        accepted = [ClipPlan.from_dict(d) for d in payload["plans"]]
        rejected = [ClipPlan.from_dict(d) for d in payload.get("rejected_plans", [])]

    # ---- boundary (per span) ---------------------------------------
    if should("boundary"):
        resolve_plans(accepted, words, settings)
        accepted, late = finalize(accepted, words, formats, settings)
        rejected.extend(late)
        write_json(paths.plans, plans_payload(accepted, rejected, formats, rubric_hash))
    else:
        payload = read_json(paths.boundaries, stage=args.from_stage,
                            produced_by="boundary")
        accepted = [ClipPlan.from_dict(d) for d in payload["plans"]]

    if not accepted:
        log.error("run: every plan was rejected; see %s", paths.plans)
        return 1
    log.info("run: %d plans renderable, %d rejected", len(accepted), len(rejected))

    # ---- rank ------------------------------------------------------
    if should("rank"):
        # The same choppiness measure as the prefilter, applied to the spans
        # the model actually chose. Regions are only hints, so this is the
        # stage that decides which clips get cut.
        rank_cuts = (scenes.cuts_for(paths, settings)
                     if settings.cut_penalty > 0 else [])
        accepted = rank_plans(accepted, settings, cuts=rank_cuts)
        write_json(paths.ranked, {"plans": [p.to_dict() for p in accepted]})
        write_json(paths.boundaries, {"plans": [p.to_dict() for p in accepted]})

    # ---- cut -------------------------------------------------------
    if should("cut"):
        from .config import CACHE_DIR

        rendered = cut_plans(accepted, words, Path(meta.media_path), paths, settings,
                             top_n=settings.top_n, burn_captions=not args.no_captions,
                             asr_cache=CACHE_DIR / f"{meta.audio_sha256}.json",
                             debug_reframe=args.debug_reframe)
        # cut_plans keeps going past a failed clip so one bad render cannot
        # lose the others -- but the run must not then report success. Measured:
        # all three renders died of "Cannot allocate memory" and the run still
        # exited 0, so a batch script logged it as done with no clips on disk.
        expected = min(settings.top_n, len(accepted))
        if len(rendered) < expected:
            log.error("run: only %d of %d clips rendered; rerun with --from cut "
                      "(add --render-workers 1 if ffmpeg ran out of memory)",
                      len(rendered), expected)
            return 1

    log.info("run: done -> %s", paths.root)
    return 0


def cmd_reject(args: argparse.Namespace) -> int:
    """
    Record a manual rejection as future training data.

    The record is deliberately denormalized. A year from now the intermediates
    may be long gone, and a row that only holds a clip id teaches nothing.
    """
    paths = paths_for(args.video, Path(args.out) if args.out else None)
    if not paths.clips_json.exists():
        raise ClipperError(f"No clips.json for {args.video}",
                           hint="Run the pipeline first.")
    payload = json.loads(paths.clips_json.read_text(encoding="utf-8"))

    wanted = args.clip_id.removeprefix("clip_")
    match = next(
        (c for c in payload["clips"]
         if str(c["index"]) == wanted.lstrip("0") or f"{c['index']:02d}" == wanted
         or c.get("id") == args.clip_id),
        None,
    )
    if match is None:
        ids = ", ".join(f"clip_{c['index']:02d}" for c in payload["clips"])
        raise ClipperError(f"No clip {args.clip_id!r} in {paths.clips_json}",
                           hint=f"Available: {ids}")

    # Denormalized on purpose: a year from now the intermediates may be gone,
    # and a row holding only a clip id teaches nothing.
    record = {
        "rejected_at": datetime.now(timezone.utc).isoformat(),
        "video": paths.name,
        "clip_id": f"clip_{match['index']:02d}",
        "plan_id": match.get("id"),
        "reason": args.reason,
        "format": match.get("format"),
        "theme": match.get("theme"),
        "final_score": match.get("final_score"),
        "scores": match.get("scores"),
        "suggested_title": match.get("suggested_title"),
        "llm_reason": match.get("reason"),
        "total_duration": match.get("total_duration"),
        "span_count": match.get("span_count"),
        "source_order": match.get("source_order"),
        "jumps_backwards": match.get("jumps_backwards"),
        "spans": match.get("spans"),
        "joins": match.get("joins"),
        "notes": match.get("notes"),
    }
    store.append_jsonl(paths.rejects, record)
    print(f"recorded rejection of clip_{match['index']:02d} -> {paths.rejects}")
    return 0


def cmd_explain(args: argparse.Namespace) -> int:
    """Why did a region survive the gate -- or not?"""
    paths = paths_for(args.video, Path(args.out) if args.out else None)
    payload = read_json(paths.regions, stage="explain", produced_by="prefilter")
    rows = payload["regions"] + payload.get("near_misses", [])
    if args.region_id:
        rows = [r for r in rows if r["id"] == args.region_id]
        if not rows:
            raise ClipperError(f"No region {args.region_id!r}")

    for r in rows:
        kept = r["id"].startswith("r")
        print(f"\n{r['id']}  {'KEPT' if kept else 'near-miss'}  "
              f"{r['start']:.1f}-{r['end']:.1f}s ({r['duration']:.0f}s)  "
              f"score={r['prefilter_score']:.3f}")
        for reason in r["why"]:
            print(f"    - {reason}")
        sig = r["signals"]
        print("    signals: " + "  ".join(f"{k}={v}" for k, v in sig.items()))
        if args.text:
            print(f"    text: {r['text'][:300]}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="clipper", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("-v", "--verbose", action="store_true")
    p.add_argument("--out", help="output root (default: ./out)")
    p.add_argument("--list-styles", action="store_true",
                   help="print the layout presets in styles/ and exit")
    sub = p.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="run the pipeline")
    run.add_argument("source", help="local media file or URL")
    run.add_argument("--from", dest="from_stage", default="ingest", choices=STAGES)
    run.add_argument("--name", help="output folder name (default: from filename)")
    run.add_argument("--top", type=int, help="how many clips to cut (default 5)")
    run.add_argument("--keep-top", type=int, help="prefilter survivors (default 15)")
    run.add_argument("--profile", choices=sorted(PROFILES), help="prefilter weights")
    run.add_argument("--model", help="scoring model (default claude-sonnet-5)")
    run.add_argument("--caption-pos", choices=["bottom", "center", "top"])
    run.add_argument("--style", dest="style_preset",
                     help="layout preset from styles/ (default clean)")
    run.add_argument("--device", default="auto",
                     help="alignment device: auto (cuda if available), cuda, cpu")
    run.add_argument("--render-workers", type=int,
                     help="clips to encode at once (default 3, 1 = serial)")
    run.add_argument("--no-captions", action="store_true", help="skip burn-in")
    run.add_argument("--no-reframe", action="store_true",
                     help="centre crop instead of speaker tracking")
    run.add_argument("--layout", choices=["auto", "single", "split"],
                     help="auto splits the screen when both people are visible")
    run.add_argument("--debug-reframe", action="store_true",
                     help="also write proxy overlays showing the crop window")
    run.add_argument("--no-cache", action="store_true", help="ignore the ASR cache")
    run.add_argument("--force", action="store_true", help="re-ingest even if present")
    run.add_argument("--dry-run", action="store_true",
                     help="stop before spending LLM tokens")
    run.set_defaults(func=cmd_run)

    rej = sub.add_parser("reject", help="record a manual rejection")
    rej.add_argument("video")
    rej.add_argument("clip_id")
    rej.add_argument("--reason", required=True)
    rej.set_defaults(func=cmd_reject)

    exp = sub.add_parser("explain", help="why a region survived the prefilter")
    exp.add_argument("video")
    exp.add_argument("region_id", nargs="?")
    exp.add_argument("--text", action="store_true", help="include transcript text")
    exp.set_defaults(func=cmd_explain)
    return p


def cmd_list_styles() -> int:
    """Print what is in styles/, so a user can see what --style accepts."""
    from . import styles

    found = styles.available()
    if not found:
        log.error("no style files in %s", styles.STYLES_DIR)
        return 1
    for name in sorted(found):
        try:
            style = styles.load_style(found[name])
            note = style.description or "(no description)"
        except ClipperError as exc:
            note = f"BROKEN -- {exc}"
        print(f"{name:12s} {note}")
    return 0


def main(argv: list[str] | None = None) -> int:
    # Checked before parse_args so it works without a subcommand.
    if argv is None:
        argv = sys.argv[1:]
    if "--list-styles" in argv:
        _setup_logging(False)
        return cmd_list_styles()
    args = build_parser().parse_args(argv)
    _setup_logging(args.verbose)
    try:
        return args.func(args)
    except ClipperError as exc:
        log.error("%s", exc)
        return 1
    except KeyboardInterrupt:
        log.warning("interrupted; intermediates are on disk, resume with --from")
        return 130


if __name__ == "__main__":
    sys.exit(main())
