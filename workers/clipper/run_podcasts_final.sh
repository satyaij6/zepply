#!/usr/bin/env bash
# One after the other: shared transliteration cache and Sarvam rate limit.
cd "$(dirname "$0")"
python -m clipper.cli run "https://youtu.be/jBzp-hXRzj4" --from transcribe --top 3 > out_yt_sumanth3.log 2>&1
echo "sumanth3 exit=$?" >> out_yt_batch.log
python -m clipper.cli run "https://youtu.be/nuKQ5SyNu_E" --from transcribe --top 3 > out_yt_allari3.log 2>&1
echo "allari3 exit=$?" >> out_yt_batch.log
