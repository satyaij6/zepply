"""
Supabase Storage over its REST API, with the service-role key.

Buckets (names shared with apps/web/lib/clip-engine.ts):
    clip-sources   uploads from the browser; the worker downloads them
    clip-renders   finished clips, thumbnails and captions; the app serves them via signed URLs
    brand-assets   logos and photos from the brand kit; the worker downloads them for reels
    reel-renders   finished promo reels
"""
from __future__ import annotations

import shutil
from pathlib import Path
from urllib.parse import quote

import requests

SOURCES = "clip-sources"
RENDERS = "clip-renders"
# Promo reels (apps/web/lib/reels/options.ts REEL_BUCKETS)
BRAND_ASSETS = "brand-assets"
REEL_RENDERS = "reel-renders"


class Storage:
    def __init__(self, base_url: str, service_key: str):
        self.base = f"{base_url}/storage/v1"
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {service_key}", "apikey": service_key})
        self._ready: set[str] = set()

    def _object_url(self, bucket: str, path: str) -> str:
        return f"{self.base}/object/{bucket}/{quote(path, safe='/')}"

    def ensure_bucket(self, bucket: str) -> None:
        if bucket in self._ready:
            return
        res = self.session.get(f"{self.base}/bucket/{bucket}", timeout=30)
        if res.status_code != 200:
            res = self.session.post(f"{self.base}/bucket", json={"id": bucket, "name": bucket, "public": False}, timeout=30)
            if res.status_code not in (200, 201, 409) and "already exists" not in res.text:
                res.raise_for_status()
        self._ready.add(bucket)

    def download(self, bucket: str, path: str, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        with self.session.get(self._object_url(bucket, path), stream=True, timeout=(30, 300)) as res:
            res.raise_for_status()
            with open(dest, "wb") as fh:
                shutil.copyfileobj(res.raw, fh, length=8 * 1024 * 1024)
        return dest

    def upload(self, bucket: str, path: str, file: Path, content_type: str) -> str:
        self.ensure_bucket(bucket)
        with open(file, "rb") as fh:
            res = self.session.post(
                self._object_url(bucket, path),
                data=fh,
                headers={"Content-Type": content_type, "x-upsert": "true"},
                timeout=(30, 600),
            )
        res.raise_for_status()
        return path
