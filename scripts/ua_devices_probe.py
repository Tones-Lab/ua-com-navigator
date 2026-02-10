#!/usr/bin/env python3
"""
Purpose:
- Probe UA Devices API responses to find device name, IP, zone, and SNMP metadata fields.
- Optionally filter to verified devices with SNMP data for poll eligibility checks.

Usage:
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_devices_probe.py --limit 50
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_devices_probe.py --endpoint /device/Devices/readForSelect
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_devices_probe.py --show-keys --sample 5
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_devices_probe.py --verified-only --exclude-metadata
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_devices_probe.py --verified-only --snmp-only

Notes/Environment:
- Uses UA credentials/settings from scripts/ua_api_helper.py.
- Prints field keys and example rows to help map ZoneName/ZoneID/SysOID.
"""
from __future__ import annotations

import argparse
import json
from typing import Any, Dict, List

from ua_api_helper import ua_request


def _extract_rows(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not payload:
        return []
    for key in ("data", "rows", "results", "items"):
        value = payload.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
        if isinstance(value, dict):
            nested = value.get(key)
            if isinstance(nested, list):
                return [row for row in nested if isinstance(row, dict)]
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    return []


def _normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {str(key): value for key, value in row.items()}


def _pick(row: Dict[str, Any], keys: List[str]) -> str:
    for key in keys:
        if key in row and row[key] is not None:
            return str(row[key]).strip()
        lower = key.lower()
        for k, v in row.items():
            if str(k).lower() == lower and v is not None:
                return str(v).strip()
    return ""


def _device_status(row: Dict[str, Any]) -> str:
    return _pick(row, ["DeviceStatus", "device_status", "Status", "status"])


def _sys_oid(row: Dict[str, Any]) -> str:
    return _pick(row, ["SysOID", "sys_oid", "SysObjectID", "sysObjectID"])


def _zone_name(row: Dict[str, Any]) -> str:
    return _pick(row, ["DeviceZoneName", "ZoneName", "zone_name", "Zone"])


def _device_name(row: Dict[str, Any]) -> str:
    return _pick(row, ["DeviceName", "CustomName", "Name", "Node", "SysName"])


def _ip(row: Dict[str, Any]) -> str:
    return _pick(row, ["IPAddress", "IPv4", "CombineIP", "IP"])


def _print_sample(rows: List[Dict[str, Any]], count: int) -> None:
    for idx, row in enumerate(rows[:count], start=1):
        print(f"\nSample {idx}:")
        print(json.dumps(row, indent=2, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe UA Devices API responses.")
    parser.add_argument("--endpoint", default="/device/Devices", help="UA API endpoint path")
    parser.add_argument("--limit", type=int, default=50, help="Number of rows to request")
    parser.add_argument("--start", type=int, default=0, help="Start offset")
    parser.add_argument("--exclude-metadata", action="store_true", help="Set excludeMetadata=true")
    parser.add_argument("--show-keys", action="store_true", help="Print unique keys found")
    parser.add_argument("--sample", type=int, default=3, help="Number of samples to print")
    parser.add_argument(
        "--discovered-only",
        action="store_true",
        help="Only include devices with DeviceStatus=Discovered",
    )
    parser.add_argument(
        "--snmp-only",
        action="store_true",
        help="Only include devices with SysOID present",
    )
    args = parser.parse_args()

    params = {
        "limit": str(args.limit),
        "start": str(args.start),
    }
    if args.exclude_metadata:
        params["excludeMetadata"] = "true"

    result = ua_request("GET", args.endpoint, params)
    rows = _extract_rows(result)
    normalized = [_normalize_row(row) for row in rows]
    if args.discovered_only:
        normalized = [row for row in normalized if _device_status(row).lower() == "discovered"]
    if args.snmp_only:
        normalized = [row for row in normalized if _sys_oid(row)]
    print(f"Endpoint: {args.endpoint}")
    print(f"Rows: {len(normalized)}")

    if args.show_keys:
        keys = set()
        for row in normalized:
            keys.update(_normalize_row(row).keys())
        print("\nKeys:")
        for key in sorted(keys):
            print(f"- {key}")

    _print_sample(normalized, args.sample)

    print("\nEligible devices:")
    for row in normalized:
        name = _device_name(row) or "(no name)"
        zone = _zone_name(row) or "Unknown zone"
        ip = _ip(row) or "(no ip)"
        status = _device_status(row) or "Unknown"
        sys_oid = _sys_oid(row) or ""
        print(f"- {name} ({zone}) | {ip} | {status} | {sys_oid}")


if __name__ == "__main__":
    main()
