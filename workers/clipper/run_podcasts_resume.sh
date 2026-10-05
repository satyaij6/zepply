#!/usr/bin/env bash
# Resume both from transcribe on the parts-aware ASR. Sequential for the same
# reason as before: one transliteration cache file, one Sarvam rate limit.
cd "$(dirname "$0")"
python -m clipper.cli run "https://youtu.be/jBzp-hXRzj4?si=b8AZEv_idMwEu7_L" --from transcribe --top 3 > out_yt_sumanth2.log 2>&1
echo "sumanth2 exit=$?" >> out_yt_batch.log
# Wait for the earlier Allari run (old code) to finish its ingest and exit.
while powershell -NoProfile -Command "if (Get-CimInstance Win32_Process -Filter \"Name like 'python%'\" | Where-Object { \$_.CommandLine -like '*nuKQ5SyNu_E*' }) { exit 0 } else { exit 1 }"; do sleep 15; done
python -m clipper.cli run "https://youtu.be/nuKQ5SyNu_E?si=5XYnHo0P-QPaucUa" --from transcribe --top 3 > out_yt_allari2.log 2>&1
echo "allari2 exit=$?" >> out_yt_batch.log
