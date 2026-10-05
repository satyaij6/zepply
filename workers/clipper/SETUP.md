# Setup

## Prerequisites

| Thing | Why | Check |
|---|---|---|
| Python 3.11+ | runtime (3.12 is fine) | `python --version` |
| ffmpeg **with libass** | Telugu caption shaping | `ffmpeg -version \| grep libass` |
| ffprobe | duration/stream probing | ships with ffmpeg |
| yt-dlp | only for YouTube URL sources | `yt-dlp --version` |

ffmpeg **must** be built with `--enable-libass --enable-libharfbuzz --enable-libfribidi`.
Without HarfBuzz, Telugu conjuncts decompose into separate glyphs and every
burned caption is subtly wrong. `tests/test_telugu_shaping.py` fails loudly if
this is the case — run it before trusting any output.

```bash
pip install -r requirements.txt
python -m pytest tests/ -v
```

## Credentials

Copy `.env.example` to `.env` and fill in:

```
SARVAM_API_KEY=...
ANTHROPIC_API_KEY=...
```

`.env` is gitignored. Nothing reads keys from anywhere else.

## ⚠️ AVG (and other antivirus) HTTPS scanning — read this before debugging TLS

**Symptom:** every Sarvam and Anthropic call dies with

```
SSLError: [SSL: CERTIFICATE_VERIFY_FAILED] unable to get local issuer certificate
```

while the same URLs load fine in a browser, and `pip install` may fail too.

**Cause:** AVG's Web/Mail Shield terminates TLS and re-signs certificates with
its own root, `CN=AVG Web/Mail Shield Root`. That root is installed in the
**Windows certificate store**, which is why browsers are happy. Python's
`requests` verifies against **certifi's bundle**, which has never heard of it.
Confirmed on this project for `api.sarvam.ai`, `api.anthropic.com` and
`pypi.org`. Note that `google.com` is *not* intercepted — so one working
request does not rule this out.

### Fix 1 — already applied in code (nothing to do)

`clipper/http.py` calls `truststore.inject_into_ssl()`, which verifies against
the OS certificate store instead. Verification stays fully **on**. This is why
`truststore` is a hard dependency in `requirements.txt`.

> Never "fix" this with `verify=False`. These requests carry API keys and user
> media. Disabling verification makes any network position a full compromise.

### Fix 2 — recommended: exclude the API hosts from AVG's HTTPS scan

Fix 1 makes the calls work, but AVG is still **decrypting the traffic**, which
means your API keys and every uploaded audio file exist in plaintext inside
AVG's proxy. Excluding the API hosts stops that.

In AVG (exact wording varies by version):

1. Open AVG → **☰ Menu → Settings**
2. **General → Exceptions → Add Exception**, and add each of:
   - `api.sarvam.ai`
   - `api.anthropic.com`
3. Then **Basic Protection → Web Shield** (some builds: *Core Shields → Web
   Shield*) → confirm **Enable HTTPS scanning** either excludes those hosts or,
   if your build offers no per-host list there, that the exceptions above are
   applied to it.
4. Restart the shell and verify:

```bash
python -c "import requests; print(requests.get('https://api.sarvam.ai/').status_code)"
```

A `404` is success — you reached Sarvam. An `SSLError` means the exception did
not take.

To confirm whether a given host is being intercepted:

```bash
python -c "import socket,ssl;from cryptography import x509; \
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE; \
s=ctx.wrap_socket(socket.create_connection(('api.sarvam.ai',443)),server_hostname='api.sarvam.ai'); \
print(x509.load_der_x509_certificate(s.getpeercert(True)).issuer.rfc4514_string())"
```

If the issuer says `AVG Web/Mail Shield Root`, it is being intercepted. A real
issuer (e.g. a public CA) means the exclusion is working.

Kaspersky, ESET, Bitdefender and corporate MITM proxies all behave the same
way; the `truststore` fix covers them equally.

## Caption font

`assets/NotoSansTelugu-Regular.ttf` is committed and pinned deliberately.
Captions are rendered with an explicit `fontsdir` rather than a fontconfig
family lookup, because on Windows that lookup is unreliable and silently falls
back to a font with **no Telugu coverage** — which renders as blank boxes with
no error.

If the file is missing, re-download it:

```bash
python -c "import requests,truststore,pathlib; truststore.inject_into_ssl(); \
pathlib.Path('assets/NotoSansTelugu-Regular.ttf').write_bytes( \
requests.get('https://github.com/google/fonts/raw/main/ofl/notosanstelugu/NotoSansTelugu%5Bwdth,wght%5D.ttf').content)"
```

## Sarvam API facts (measured on real Telugish audio, not documented)

Established by `scripts/probe_saaras.py` and direct batch-API calls against a
real 40s code-mixed ad film. **Caution: an empty/silent test clip makes Saarika
look like it returns word timings — it returns the right SHAPE with zero
entries. Only real speech reveals the truth.**

| Question | Answer |
|---|---|
| Does **Saaras v3** return timestamps? | **No.** `with_timestamps` is silently ignored, sync and batch alike. |
| What does Saaras return? | An **English translation**, not the code-mixed original. |
| Does **Saarika v2.5** return *word*-level timestamps? | **No.** Sync returned the entire 26s transcript as ONE "word" (0.0–26.0). Batch returned 2 entries, one zero-length. |
| Best timings Sarvam offers | **batch + `with_diarization`** → sentence/speaker segments with sane times, but up to 18s granularity. Not enough to snap to a hook word. |
| `saarika:v1` / `v2` | **Deprecated** — the API redirects you to `saaras:v3`. |
| Script control on STT | **Does not exist.** `output_script=roman` and `spoken-form` returned byte-identical Telugu-script output. That parameter belongs to the *Transliteration* API. |
| Unknown parameters | **Silently accepted**, never rejected. A 200 does *not* mean a parameter did anything. |
| Diarization on sync | Rejected — batch only. |
| Batch job flow | `POST {endpoint}/job/init` → PUT file to the returned Azure SAS URL → `POST {endpoint}/job` with `{job_id, job_parameters}` → `GET {endpoint}/job/{job_id}/status` → read `outputs/N.json` from the output SAS container |
| Batch status path | `/job/{id}/status` — plain `/job/{id}` returns 404 |
| Sync duration cap | 30 seconds. Longer audio must use the batch API. |

### Consequence: word timings are produced locally

Because no Sarvam endpoint provides word-level timing, `clipper/align.py` runs
a **CTC forced aligner** (torchaudio's `MMS_FA`) over the audio using the
romanized transcript. This is deterministic, offline, and free per run; the
model downloads once (~1.2GB) to `~/.cache/torch/hub/checkpoints/`.

Validated against the 40s reference film — the aligner and Sarvam's diarization
are independent systems and agreed on three segment starts to within **0.08s**,
and the aligner independently located the same 3s of dead air:

```
నియో        diarization= 0.67   aligner= 0.72   delta +0.05s
మీ          diarization=18.65   aligner=18.73   delta +0.08s
అన్షేకబుల్   diarization=26.99   aligner=27.05   delta +0.06s
```

> Do **not** validate alignment by comparing energy inside words vs. gaps on
> this kind of content. Ad films have continuous background score, so "gaps"
> are not silent — that check scored 1.26x and read as a failure when the
> alignment was in fact correct to within 0.08s. Cross-check against an
> independent timing source instead.

### torchaudio and torchcodec

`torchaudio.load()` delegates to `torchcodec` as of 2.11 and raises ImportError
without it. `clipper/align.py` sidesteps this by reading wavs with the standard
library `wave` module — ingest always writes 16kHz mono `pcm_s16le`, so no
extra binary dependency is needed. Do not "fix" an audio-loading error by
installing torchcodec; check that the file came from `--from ingest` instead.

### Transliteration

English loanwords come back as real English (`బెస్ట్` → `Best`,
`కనెక్టివిటీ` → `Connectivity`); Telugu romanizes phonetically
(`వెతుకుతున్నావ్` → `Vetukutunnaav`).

Calls are **per word, never per sentence**, for two measured reasons:

1. Context changes the output — the same word gave `Vetukutunnaav` alone but
   `shodhhuktnav` inside a sentence.
2. Some inputs **split** (`spoken_form` turns `ఓఆర్ఆర్` into three tokens). A
   split shifts every subsequent word index, and word indices carry the
   timings, so the caption track silently desyncs.

On the reference film, 1 slot in 82 expanded to multiple tokens
(`కమ్యూనిటీలో` → `"in the community."` — a translation leaking into
transliteration). Expansions are kept inside their single slot and counted in
the run log.

### Transliteration rate limits and failure modes (measured on a 20-minute source)

| Finding | Detail |
|---|---|
| The limit is on **concurrency**, not rate | 3 parallel workers produced constant 429s. Serial requests succeeded 6/6 at *every* delay tested, including zero. `concurrency=1`, no sleep. |
| Newline batching does not work | Sending 10 newline-separated words returns **1** line. Per-word calls are the only way to hold the one-word-one-slot invariant. |
| Deduplicate before calling | 3270 word occurrences were only 1211 distinct words -- **63% of calls saved**. Mapping a pool over every occurrence also makes duplicates race past the cache. |
| Cache incrementally | The cache flushes every 25 fetches. Saving only at the end means an interrupted run discards everything it paid for. |
| **Degenerate output** | Sarvam occasionally loops: `వచ్చింది` (8 chars) returned **383 characters** of `"Aa aa aa ..."`. Median expansion is 1.00x, so >6x is pathological. Often transient -- a retry fixed it. |

The degenerate case is worth understanding because it breaks **two** stages at
once and the second failure looks unrelated:

* the caption cue becomes far wider than the frame, and
* **CTC forced alignment fails outright** -- 383 target characters against 0.38s
  of audio is more targets than there are frames, and the error
  (`forced_align_impl ... compute.cpp:56`) takes the whole surrounding segment's
  timings with it.

Three failing segments in a 20-minute file traced back to exactly these words.
Guarding the transliteration fixed the alignment failures as a side effect.

### CTC alignment: the blank label

`MMS_FA.get_labels()` returns 29 entries -- 27 letters **plus** the CTC blank
`-` and the star `*`. Treating those as ordinary characters means any romanized
word containing a hyphen maps to the blank index, and the aligner raises
`targets Tensor shouldn't contain blank index`, losing the entire segment. Use
`clipper.align.emittable_labels()`, never `frozenset(bundle.get_labels())`.

## Output location

Rendered clips go to `C:\clipper-out\<video>\` by default, **not** into the
repo. Override with `CLIPPER_OUT` or per-run with `--out`.

This is not a style preference. The project directory is inside a OneDrive-synced
Documents folder, and OneDrive holds a file open while it uploads. Measured: three
consecutive renders failed with

```
Error opening output clip_01.mp4: Permission denied
```

because the previous clips -- tens of megabytes each -- were mid-sync when ffmpeg
tried to overwrite them. The files tested free a minute later, which is what
identified it as a transient sync lock rather than a player holding them.

`cut.py` still clears a locked destination with a short backoff, as a safety net
for the case where something else genuinely has the file open. Keeping the output
outside the synced folder is what removes the cause -- and stops every render
being uploaded to the cloud as a side effect.
