"""
Purpose: Normalize favorite labels to match the leaf of pathId.
Usage:
  DRY_RUN=1 /root/navigator/.venv/bin/python scripts/normalize_favorites_labels.py
  /root/navigator/.venv/bin/python scripts/normalize_favorites_labels.py
"""
from __future__ import annotations

import json
import os
from typing import Dict, Optional, Tuple

import redis

FAVORITES_PREFIX = "favorites:"


def derive_label(path_id: Optional[str]) -> str:
    if not path_id:
        return ""
    cleaned = path_id.rstrip("/")
    parts = [part for part in cleaned.split("/") if part]
    if not parts:
        return ""
    return parts[-1]


def parse_favorite_entry(raw: str) -> Optional[dict]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not parsed or not parsed.get("type") or not parsed.get("pathId"):
        return None
    return parsed


def build_redis_client() -> redis.Redis:
    url = os.environ.get("REDIS_URL")
    if url:
        return redis.Redis.from_url(url, decode_responses=True)

    host = os.environ.get("REDIS_HOST", "127.0.0.1")
    port = int(os.environ.get("REDIS_PORT", "6379"))
    username = os.environ.get("REDIS_USERNAME")
    password = os.environ.get("REDIS_PASSWORD")
    database = int(os.environ.get("REDIS_DB", "0"))
    use_tls = os.environ.get("REDIS_TLS", "false").lower() == "true"

    return redis.Redis(
        host=host,
        port=port,
        username=username,
        password=password,
        db=database,
        ssl=use_tls,
        decode_responses=True,
    )


def normalize_favorites() -> Tuple[int, int, int]:
    client = build_redis_client()
    dry_run = os.environ.get("DRY_RUN", "").lower() in {"1", "true"}

    total_entries = 0
    updated_entries = 0
    total_keys = 0

    for key in client.scan_iter(match=f"{FAVORITES_PREFIX}*", count=100):
        entries: Dict[str, str] = client.hgetall(key)
        if not entries:
            continue
        total_keys += 1
        updates: Dict[str, str] = {}

        for hash_key, raw in entries.items():
            favorite = parse_favorite_entry(raw)
            if not favorite:
                continue
            total_entries += 1
            next_label = derive_label(favorite.get("pathId"))
            if not next_label or next_label == favorite.get("label"):
                continue
            favorite["label"] = next_label
            updates[hash_key] = json.dumps(favorite)
            updated_entries += 1

        if updates and not dry_run:
            client.hset(key, mapping=updates)

    mode_label = "dry-run" if dry_run else "apply"
    print(
        f"Favorites label normalization ({mode_label}): "
        f"{updated_entries}/{total_entries} entries updated across {total_keys} keys."
    )
    return total_entries, updated_entries, total_keys


def main() -> None:
    normalize_favorites()


if __name__ == "__main__":
    main()
