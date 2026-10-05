#!/usr/bin/env bash
# Sequential on purpose: both runs share the transliteration cache file and
# Sarvam's rate limit. Parallel runs would race the cache and double the 429s.
cd "$(dirname "$0")"
python -m clipper.cli run "https://youtu.be/jBzp-hXRzj4?si=b8AZEv_idMwEu7_L" --top 3 > out_yt_sumanth.log 2>&1
echo "sumanth exit=$?" >> out_yt_batch.log
python -m clipper.cli run "https://youtu.be/nuKQ5SyNu_E?si=5XYnHo0P-QPaucUa" --top 3 > out_yt_allari.log 2>&1
echo "allari exit=$?" >> out_yt_batch.log
