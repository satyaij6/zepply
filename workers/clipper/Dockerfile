# Zepply clip worker: the clipper plus the job-queue worker (python -m worker).
#
#   docker build -t zepply-clipper workers/clipper
#   docker run --env-file workers/clipper/.env -v zepply-data:/data zepply-clipper
#
# CPU build. For a GPU host, swap the torch index URL for a CUDA one (see requirements.txt).
FROM python:3.12-slim

# Debian's ffmpeg is built with libass, and its libass with HarfBuzz and FriBidi, which
# Telugu caption shaping needs (tests/test_telugu_shaping.py checks this).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fontconfig \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt requirements-clipper.txt
COPY worker/requirements.txt requirements-worker.txt
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchaudio \
 && pip install --no-cache-dir -r requirements-clipper.txt -r requirements-worker.txt

COPY . .

# Scratch space and the ~1.2 GB alignment model live on a volume, so they survive restarts
ENV PYTHONUNBUFFERED=1 \
    ZEPPLY_WORK_DIR=/data \
    CLIPPER_OUT=/data/out \
    TORCH_HOME=/data/torch
VOLUME /data

CMD ["python", "-m", "worker"]
