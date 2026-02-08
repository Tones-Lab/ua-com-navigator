#!/usr/bin/env python3
"""
Compare COM UI microservice status vs UA API truth.

Sources:
- UA API truth via scripts/ua_api_helper.py check-trap-chain
- COM backend /api/v1/microservice/status (requires COM_UI_SESSION_ID)
- COM backend /api/v1/health/connectivity (no auth)

Env:
- COM_UI_BASE_URL (default: https://localhost:5173)
- COM_UI_SESSION_ID (optional, for /microservice/status)
- COM_UI_USERNAME / COM_UI_PASSWORD (optional, auto-login)
- COM_UI_SERVER_LABEL (optional, server label match for login)
- COM_UI_FORCE_REFRESH (set to 1 to bypass cache)
"""
from __future__ import annotations

import json
import os
import ssl
import subprocess
import sys
import urllib.request
from http.cookiejar import CookieJar
from typing import Any


def _base_url() -> str:
    raw = os.getenv("COM_UI_BASE_URL", "https://localhost:5173").rstrip("/")
    return raw


def _api_url(path: str) -> str:
    return f"{_base_url()}/api/v1{path}"


def _fetch_json(url: str, session_id: str | None = None) -> dict[str, Any]:
    headers = {"Accept": "application/json"}
    if session_id:
        headers["Cookie"] = f"FCOM_SESSION_ID={session_id}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    context = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=context, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _fetch_json_with_opener(opener: urllib.request.OpenerDirector, url: str) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"Accept": "application/json"}, method="GET")
    with opener.open(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _post_json_with_opener(
    opener: urllib.request.OpenerDirector,
    url: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )
    with opener.open(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _login_and_get_session_id() -> str | None:
    username = os.getenv("COM_UI_USERNAME")
    password = os.getenv("COM_UI_PASSWORD")
    if not username or not password:
        return None

    label_hint = (os.getenv("COM_UI_SERVER_LABEL") or "").strip().lower()
    base = _base_url()
    cookie_jar = CookieJar()
    context = ssl._create_unverified_context()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
    opener.addheaders = [("User-Agent", "com-microservice-check/1.0")]

    servers_url = f"{base}/api/v1/servers"
    servers = _fetch_json_with_opener(opener, servers_url)
    if not isinstance(servers, list) or not servers:
        raise RuntimeError("No servers returned from /api/v1/servers")

    selected = servers[0]
    if label_hint:
        for server in servers:
            label = str(server.get("label") or server.get("name") or server.get("server_id") or "").lower()
            if label_hint in label:
                selected = server
                break

    server_id = selected.get("server_id") or selected.get("id")
    if not server_id:
        raise RuntimeError("Server entry missing server_id")

    login_url = f"{base}/api/v1/auth/login"
    _post_json_with_opener(
        opener,
        login_url,
        {
            "server_id": server_id,
            "auth_type": "basic",
            "username": username,
            "password": password,
        },
    )

    for cookie in cookie_jar:
        if cookie.name == "FCOM_SESSION_ID":
            return cookie.value

    return None


def _run_ua_helper() -> dict[str, Any]:
    helper = os.path.join(os.path.dirname(__file__), "ua_api_helper.py")
    result = subprocess.run(
        [sys.executable, helper, "check-trap-chain"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ua_api_helper.py failed")
    return json.loads(result.stdout)


def _index_required(entries: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(item.get("name", "")): item for item in entries if item.get("name")}


def _summarize_required(entries: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    for item in entries:
        lines.append(
            f"- {item.get('label') or item.get('name')}: installed={item.get('installed')} running={item.get('running')}"
        )
    return lines


def main() -> int:
    print("COM UI base:", _base_url())

    ua_data = _run_ua_helper()
    ua_required = ua_data.get("required") or []
    ua_index = _index_required(ua_required)

    print("\nUA API truth (check-trap-chain):")
    print("\n".join(_summarize_required(ua_required)))

    session_id = os.getenv("COM_UI_SESSION_ID")
    if not session_id:
        try:
            session_id = _login_and_get_session_id()
        except Exception as exc:
            print(f"\nAuto-login failed: {exc}")
            session_id = None
    status_data: dict[str, Any] | None = None
    if session_id:
        try:
            refresh = os.getenv("COM_UI_FORCE_REFRESH") == "1"
            status_url = _api_url("/microservice/status")
            if refresh:
                status_url = f"{status_url}?refresh=1"
            status_data = _fetch_json(status_url, session_id=session_id)
        except Exception as exc:
            print(f"\nCOM /microservice/status failed: {exc}")
    else:
        print("\nCOM /microservice/status skipped (no session).")

    try:
        connectivity = _fetch_json(_api_url("/health/connectivity"))
        print("\nCOM /health/connectivity:")
        print(json.dumps(connectivity, indent=2))
    except Exception as exc:
        print(f"\nCOM /health/connectivity failed: {exc}")

    if not status_data:
        return 0

    com_required = status_data.get("required") or []
    com_index = _index_required(com_required)

    mismatches: list[str] = []
    for key, ua_entry in ua_index.items():
        com_entry = com_index.get(key)
        if not com_entry:
            mismatches.append(f"Missing in COM status: {key}")
            continue
        for field in ("installed", "running"):
            if bool(ua_entry.get(field)) != bool(com_entry.get(field)):
                mismatches.append(
                    f"{key} {field} mismatch: ua={ua_entry.get(field)} com={com_entry.get(field)}"
                )

    print("\nCOM /microservice/status:")
    print("\n".join(_summarize_required(com_required)))

    if mismatches:
        print("\nMISMATCHES:")
        print("\n".join(f"- {item}" for item in mismatches))
        return 2

    print("\nNo mismatches found between UA API and COM status.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
