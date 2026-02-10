#!/usr/bin/env python3
"""
Summarize override entry counts from UA rules via REST API.

Usage:
  /root/navigator/.venv/bin/python /root/navigator/scripts/ua_override_counts.py

Notes:
- Uses UA credentials/settings from scripts/ua_api_helper.py.
- Mirrors the overview index path resolution for overrides root.
"""
from __future__ import annotations

import json
import os
import sys
import time
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Tuple

sys.path.append("/root/navigator/scripts")
from ua_api_helper import ua_request  # noqa: E402

DEFAULT_PATH_PREFIX = "id-core/default/processing/event/fcom/_objects"
PATH_PREFIX = os.getenv("COMS_PATH_PREFIX", DEFAULT_PATH_PREFIX).strip("/")


def list_rules(node: str, limit: int = 500) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    start = 0
    while True:
        payload = ua_request_with_retry(
            "GET",
            "/rule/Rules/read",
            {
                "node": node,
                "limit": str(limit),
                "start": str(start),
                "excludeMetadata": "true",
            },
        )
        batch = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(batch, list) or not batch:
            break
        entries.extend([row for row in batch if isinstance(row, dict)])
        if len(batch) < limit:
            break
        start += len(batch)
    return entries


def ua_request_with_retry(method: str, path: str, params: Dict[str, str], attempts: int = 3) -> Dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return ua_request(method, path, params)
        except Exception as exc:  # pragma: no cover - network retries
            last_error = exc
            if attempt < attempts:
                time.sleep(0.4 * attempt)
    raise last_error or RuntimeError("UA request failed")


def is_folder(entry: Dict[str, Any]) -> bool:
    name = str(entry.get("PathName") or entry.get("PathID") or "").lower()
    return not name.endswith(".json")


def list_directory_recursive(node: str) -> List[Dict[str, Any]]:
    entries = list_rules(node)
    all_entries = list(entries)
    for entry in entries:
        if not is_folder(entry):
            continue
        path_id = str(entry.get("PathID") or "").strip()
        if not path_id:
            continue
        all_entries.extend(list_directory_recursive(path_id))
    return all_entries


def extract_rule_text(payload: Dict[str, Any]) -> str:
    data = payload.get("data") if isinstance(payload, dict) else None
    if isinstance(data, list) and data:
        rule_text = data[0].get("RuleText")
        if isinstance(rule_text, str):
            return rule_text
    rule_text = payload.get("RuleText") if isinstance(payload, dict) else None
    if isinstance(rule_text, str):
        return rule_text
    return ""


def parse_overrides(rule_text: str) -> List[Dict[str, Any]]:
    if not rule_text:
        return []
    try:
        parsed = json.loads(rule_text)
    except Exception:
        return []
    if isinstance(parsed, list):
        return [item for item in parsed if isinstance(item, dict)]
    if isinstance(parsed, dict):
        if not parsed:
            return []
        return [parsed]
    return []


def count_override_entries(overrides: Iterable[Dict[str, Any]]) -> int:
    entries = [item for item in overrides if isinstance(item, dict)]
    typed = [item for item in entries if str(item.get("_type", "")).lower() == "override"]
    return len(typed) if typed else len(entries)


def resolve_overrides_root(path_prefix: str) -> str:
    if "/_objects" in path_prefix:
        return path_prefix.replace("/_objects", "") + "/overrides"
    return path_prefix + "/overrides"


def parse_override_file_metadata(
    path_id: str, overrides_root: str
) -> Tuple[str, str]:
    file_name = path_id.split("/")[-1]
    stem = file_name.replace(".override.json", "")
    parts = [part for part in stem.split(".") if part]
    vendor = parts[0] if parts else ""

    relative = path_id.replace(overrides_root.rstrip("/") + "/", "")
    rel_parts = [part for part in relative.split("/") if part]
    folder_protocol = rel_parts[-2] if len(rel_parts) > 1 else ""
    protocol = folder_protocol if folder_protocol.lower() in ("trap", "syslog") else "fcom"
    return protocol, vendor


def normalize_override_protocol(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in ("trap", "syslog"):
        return normalized
    return "fcom"


def collect_vendor_pairs(path_prefix: str) -> List[Tuple[str, str]]:
    pairs: List[Tuple[str, str]] = []
    protocol_entries = list_rules(path_prefix)
    protocol_folders = [entry for entry in protocol_entries if is_folder(entry)]
    for protocol_entry in protocol_folders:
        protocol_name = str(protocol_entry.get("PathName") or protocol_entry.get("PathID") or "").split(
            "/"
        )[-1]
        if not protocol_name or protocol_name.lower() == "overrides":
            continue
        protocol_node = str(protocol_entry.get("PathID") or f"{path_prefix}/{protocol_name}")
        vendor_listing = list_rules(protocol_node)
        for vendor_entry in vendor_listing:
            vendor_name = str(vendor_entry.get("PathName") or vendor_entry.get("PathID") or "").split(
                "/"
            )[-1]
            if vendor_name.lower() == "overrides":
                continue
            if is_folder(vendor_entry):
                pairs.append((protocol_name, vendor_name))
    return pairs


def main() -> int:
    overrides_root = resolve_overrides_root(PATH_PREFIX)
    override_listing = list_directory_recursive(overrides_root)
    override_files = [
        entry
        for entry in override_listing
        if str(entry.get("PathName") or entry.get("PathID") or "").lower().endswith(".override.json")
    ]

    totals = defaultdict(int)
    file_totals: Dict[str, int] = {}
    overall = 0

    for entry in override_files:
        path_id = str(entry.get("PathID") or entry.get("PathName") or "").strip()
        if not path_id:
            continue
        data = ua_request_with_retry("GET", f"/rule/Rules/{path_id}", {"revision": "HEAD"})
        rule_text = extract_rule_text(data)
        overrides = parse_overrides(rule_text)
        count = count_override_entries(overrides)
        overall += count
        file_totals[path_id] = count
        file_protocol, vendor = parse_override_file_metadata(path_id, overrides_root)
        for override_entry in overrides:
            if not isinstance(override_entry, dict):
                continue
            method = str(override_entry.get("method") or "").strip()
            protocol = normalize_override_protocol(method) if method else file_protocol
            totals[f"{protocol}::{vendor}"] += 1

    vendor_pairs = collect_vendor_pairs(PATH_PREFIX)

    output = {
        "path_prefix": PATH_PREFIX,
        "overrides_root": overrides_root,
        "override_files": len(override_files),
        "overall_override_entries": overall,
        "totals_by_protocol_vendor": dict(sorted(totals.items())),
        "file_totals": dict(sorted(file_totals.items())),
        "known_vendor_pairs": sorted({f"{protocol}::{vendor}" for protocol, vendor in vendor_pairs}),
    }
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
