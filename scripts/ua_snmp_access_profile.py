#!/usr/bin/env python3
"""
Purpose:
- Resolve a device to its SNMP access profile and fetch the profile via UA REST API.

Usage:
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_snmp_access_profile.py --access-id 1
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_snmp_access_profile.py --device-id 45
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_snmp_access_profile.py --ip 192.168.3.11
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_snmp_access_profile.py --name "lab-ua-tony02"

Notes/Environment:
- Uses UA credentials/settings from scripts/ua_api_helper.py.
- Fetches devices from /device/Devices to resolve DeviceSNMPAccessID.
- Fetches SNMP access profile from /discovery/snmp/{id}.
"""
from __future__ import annotations

import argparse
import json
from typing import Any, Dict, List, Optional

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


def _pick(row: Dict[str, Any], keys: List[str]) -> str:
    for key in keys:
        if key in row and row[key] is not None:
            return str(row[key]).strip()
        lower = key.lower()
        for k, v in row.items():
            if str(k).lower() == lower and v is not None:
                return str(v).strip()
    return ""


def _normalize_device(row: Dict[str, Any]) -> Dict[str, str]:
    return {
        "id": _pick(row, ["DeviceID", "device_id", "id", "ID"]),
        "name": _pick(
            row,
            [
                "DeviceName",
                "CustomName",
                "Name",
                "Node",
                "Hostname",
                "HostName",
            ],
        ),
        "ip": _pick(row, ["IPAddress", "IPv4", "CombineIP", "IP", "ip"]),
        "zone": _pick(row, ["DeviceZoneName", "ZoneName", "zone_name", "Zone"]),
        "access_id": _pick(row, ["DeviceSNMPAccessID", "device_snmp_access_id"]),
    }


def _load_devices(limit: int, start: int) -> List[Dict[str, str]]:
    payload = ua_request(
        "GET",
        "/device/Devices",
        {
            "limit": str(limit),
            "start": str(start),
            "excludeMetadata": "false",
        },
    )
    rows = _extract_rows(payload)
    return [_normalize_device(row) for row in rows]


def _find_device(
    devices: List[Dict[str, str]],
    device_id: str | None,
    ip: str | None,
    name: str | None,
) -> Optional[Dict[str, str]]:
    if device_id:
        return next((device for device in devices if device.get("id") == device_id), None)
    if ip:
        return next((device for device in devices if device.get("ip") == ip), None)
    if name:
        lowered = name.lower()
        return next(
            (
                device
                for device in devices
                if (device.get("name") or "").lower().find(lowered) >= 0
            ),
            None,
        )
    return None


def _fetch_snmp_access(access_id: str) -> Dict[str, Any]:
    return ua_request("GET", f"/discovery/snmp/{access_id}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Resolve a device to its SNMP access profile using UA REST API."
    )
    parser.add_argument("--access-id", help="SNMP access profile ID")
    parser.add_argument("--device-id", help="DeviceID to resolve")
    parser.add_argument("--ip", help="IP address to resolve")
    parser.add_argument("--name", help="Device name or substring")
    parser.add_argument("--limit", type=int, default=500, help="Device list page size")
    parser.add_argument("--start", type=int, default=0, help="Device list start offset")
    args = parser.parse_args()

    access_id = (args.access_id or "").strip()
    if not access_id:
        devices = _load_devices(args.limit, args.start)
        device = _find_device(devices, args.device_id, args.ip, args.name)
        if not device:
            raise SystemExit("No matching device found for the provided selector.")
        access_id = device.get("access_id") or ""
        if not access_id or access_id == "0":
            raise SystemExit("Device does not have a valid DeviceSNMPAccessID.")
        print(
            json.dumps(
                {
                    "device": device,
                    "resolved_access_id": access_id,
                },
                indent=2,
            )
        )

    profile = _fetch_snmp_access(access_id)
    print(json.dumps(profile, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
