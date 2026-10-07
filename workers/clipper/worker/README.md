# Zepply worker

Works two queues from the web app:

- **Promo reels** (`ReelJob`): renders the HyperFrames template in `apps/web/public/reel-templates/promo-classic`
  with `packages/reels/scripts/render.mjs`, using the owner's brand-kit logo and photos, then uploads
  the MP4. About a minute and a half per 30-second reel on a laptop. Taken first, since they're quick.
- **Clips** (`ClipJob`): long videos run through the clipper: download the source, transcribe, find the
  moments, reframe and render, then upload each clip to storage and record it as a `Clip`.

The web app shows progress while either runs. `ZEPPLY_JOBS` (`clips`, `reels` or `clips,reels`, the
default) picks which queues a machine works, so a machine without the clipper's keys can still make reels.

```
web app ──► ClipJob (QUEUED) ──► worker claims it ──► clipper ──► clips in storage + Clip rows ──► DONE
```

## Run it on your machine

1. Set up the clipper first (see `../SETUP.md`): Python 3.11+, ffmpeg with libass, and the keys.
2. Install the worker's extras:
   ```
   pip install -r requirements.txt -r worker/requirements.txt
   ```
3. Fill in `.env` (copy `.env.example`). The worker needs the same Supabase project as the web app:
   - `ZEPPLY_DATABASE_URL`: the **direct** Postgres connection string (Supabase → Settings → Database)
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
4. From `workers/clipper`:
   ```
   python -m worker
   ```
   It polls for jobs every few seconds. Ctrl+C stops it; a job in progress goes back to the queue.

Run several workers at once if you like: each job is claimed by exactly one of them.

### Promo reels only

Reels need Node.js 22+ (for `npx hyperframes`, which downloads its own Chrome on first use) and
ffmpeg, but none of the clipper's Python models or keys:

```
pip install -r worker/requirements.txt
ZEPPLY_JOBS=reels python -m worker
```

`ZEPPLY_RENDER_WORKERS` (default 2) sets how many Chrome captures run per reel; each takes about
256 MB of memory. To try the template without the queue:
`node packages/reels/scripts/render.mjs --job job.json --out reel.mp4` (see the script's header).

## Run it in a container

```
docker build -t zepply-clipper workers/clipper
docker run --env-file workers/clipper/.env -v zepply-data:/data zepply-clipper
```

The `/data` volume keeps scratch files and the ~1.2 GB alignment model between restarts. The image
is CPU-only; alignment is roughly 20× faster on a GPU (see `../requirements.txt` for the CUDA wheels).

## Before the first real job

- **Allowlist.** Video creation is invite-only until credits exist. To let someone in, set
  `canCreateVideos` to true on their row in the `User` table.
- **Upload size.** Supabase limits upload size per project (50 MB by default). Raise it under
  Storage → Settings to at least 2 GB, the limit the app enforces.
- **Buckets.** `clip-sources`, `clip-renders`, `brand-assets` and `reel-renders` are created
  automatically, private, on first use.

## What happens when things go wrong

- **The clipper fails:** the job is marked FAILED with a plain-language reason. The full log stays
  in `ZEPPLY_WORK_DIR/jobs/<job id>/clipper.log`.
- **The worker crashes or loses power:** a job that stops reporting for 10 minutes is retried once
  by any worker, then marked FAILED.
- **The job is cancelled in the app:** the worker notices within seconds and stops the render.
