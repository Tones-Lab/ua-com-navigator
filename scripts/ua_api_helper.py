#!/usr/bin/env python3
"""
Purpose:
- Shared UA REST API helper with standard connection settings for this repo.

Usage:
- ./scripts/ua_api_helper.py <method> <path> [key=value ...]
    Example:
        ./scripts/ua_api_helper.py GET /rule/Rules/read node=/core/default/processing/event/fcom/overrides limit=5
- ./scripts/ua_api_helper.py redeploy-fcom
- ./scripts/ua_api_helper.py check-trap-chain
- ./scripts/ua_api_helper.py deploy-service name=fcom-processor
- ./scripts/ua_api_helper.py redeploy-service name=fcom-processor

Notes/Environment:
- Uses HTTPS with optional TLS verification disabled.
- Credentials and host are defined in this file.
- Optional overrides: FCOM_PROCESSOR_RELEASE_NAME, FCOM_PROCESSOR_NAMESPACE,
  FCOM_PROCESSOR_CLUSTER, FCOM_PROCESSOR_MATCH_HINTS (comma-separated).
"""

from __future__ import annotations

import base64
import json
import os
import ssl
import sys
import urllib.parse
import urllib.request
from typing import Any

UA_HOST = "lab-ua-tony02.tony.lab"
UA_PORT = 443
UA_USERNAME = "admin"
UA_PASSWORD = "admin"
UA_INSECURE_TLS = True

BASE_URL = f"https://{UA_HOST}:{UA_PORT}/api"

FCOM_PROCESSOR_RELEASE_NAME = os.getenv("FCOM_PROCESSOR_RELEASE_NAME", "fcom-processor")
FCOM_PROCESSOR_HELM_CHART = os.getenv("FCOM_PROCESSOR_HELM_CHART", "fcom-processor")
FCOM_PROCESSOR_NAMESPACE = os.getenv("FCOM_PROCESSOR_NAMESPACE", "")
FCOM_PROCESSOR_CLUSTER = os.getenv("FCOM_PROCESSOR_CLUSTER", "")
FCOM_PROCESSOR_MATCH_HINTS = os.getenv("FCOM_PROCESSOR_MATCH_HINTS", "")


def _build_headers() -> dict[str, str]:
    token = base64.b64encode(f"{UA_USERNAME}:{UA_PASSWORD}".encode("utf-8")).decode("ascii")
    return {
        "Authorization": f"Basic {token}",
        "Accept": "application/json",
    }


def ua_request(method: str, path: str, params: dict[str, str] | None = None) -> dict:
    query = urllib.parse.urlencode(params or {})
    url = f"{BASE_URL}{path}"
    if query:
        url = f"{url}?{query}"
    headers = _build_headers()
    context = ssl._create_unverified_context() if UA_INSECURE_TLS else None
    req = urllib.request.Request(url, headers=headers, method=method.upper())
    with urllib.request.urlopen(req, context=context, timeout=20) as resp:
        data = resp.read().decode("utf-8")
    return json.loads(data)


def _extract_installed_entries(result: dict[str, Any]) -> list[dict[str, Any]]:
    if not result:
        return []
    data = result.get("data") or result.get("results") or result.get("rows") or result.get("items")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        nested = data.get("data") or data.get("results") or data.get("rows") or data.get("items")
        if isinstance(nested, list):
            return nested
    return []


def _extract_catalog_entries(result: dict[str, Any]) -> list[dict[str, Any]]:
    if not result:
        return []
    data = result.get("data") or result.get("results") or result.get("rows") or result.get("items")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        nested = data.get("data") or data.get("results") or data.get("rows") or data.get("items")
        if isinstance(nested, list):
            return nested
    return []


def _extract_workload_entries(result: dict[str, Any]) -> list[dict[str, Any]]:
    if not result:
        return []
    data = result.get("data") or result.get("results") or result.get("rows") or result.get("items")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        nested = data.get("data") or data.get("results") or data.get("rows") or data.get("items")
        if isinstance(nested, list):
            return nested
    return []


def _fetch_installed_entries(limit: int = 200, max_pages: int = 25) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for page in range(1, max_pages + 1):
        start = (page - 1) * limit
        result = ua_request(
            "GET",
            "/microservice/Deploy/readForInstalled",
            {"page": str(page), "start": str(start), "limit": str(limit)},
        )
        batch = _extract_installed_entries(result)
        if not batch:
            break
        entries.extend(batch)
        if len(batch) < limit:
            break
    return entries


def _normalize_entry(entry: dict[str, Any]) -> dict[str, Any]:
    return {str(key).lower(): value for key, value in (entry or {}).items()}


def _pick_entry_value(entry: dict[str, Any], keys: list[str]) -> str:
    if not entry:
        return ""
    normalized = _normalize_entry(entry)
    for key in keys:
        if key in entry and entry[key] is not None:
            return str(entry[key])
        lower = key.lower()
        if lower in normalized and normalized[lower] is not None:
            return str(normalized[lower])
    return ""


def _parse_chart_info(chart: str, app_version: str) -> dict[str, str]:
    trimmed = str(chart or "").strip()
    version_match = None
    if trimmed:
        version_match = __import__("re").match(r"^(.*)-([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?)$", trimmed)
    if version_match:
        return {"helmchart": version_match.group(1), "version": version_match.group(2)}
    app_match = (
        str(app_version or "")
        .lstrip("vV")
    )
    app_version_match = __import__("re").search(r"([0-9]+\.[0-9]+\.[0-9]+)", app_match)
    return {"helmchart": trimmed, "version": app_version_match.group(1) if app_version_match else ""}


def _extract_custom_values(result: dict[str, Any]) -> str | None:
    if not result:
        return None
    candidates = [
        result.get("CustomValues"),
        result.get("customValues"),
        result.get("values"),
        result.get("Value"),
        result.get("value"),
    ]
    data = result.get("data")
    if isinstance(data, dict):
        candidates.extend(
            [
                data.get("CustomValues"),
                data.get("customValues"),
                data.get("values"),
                data.get("Value"),
                data.get("value"),
            ]
        )
    if isinstance(data, list) and data:
        first = data[0] if isinstance(data[0], dict) else {}
        candidates.extend(
            [
                first.get("CustomValues"),
                first.get("customValues"),
                first.get("values"),
                first.get("Value"),
                first.get("value"),
            ]
        )
    for item in candidates:
        if isinstance(item, str) and item.strip():
            return item
    return None


def _matches_target(entry: dict[str, Any], target: str) -> bool:
    if not target:
        return False
    candidates = [
        _pick_entry_value(entry, ["ReleaseName", "releaseName", "release_name"]),
        _pick_entry_value(entry, ["Helmchart", "helmchart", "chart", "chartName", "helmChart"]),
        _pick_entry_value(entry, ["Name", "name"]),
    ]
    return any(value.lower().find(target) >= 0 for value in candidates if value)


def _matches_catalog_target(entry: dict[str, Any], target: str) -> bool:
    if not target:
        return False
    name = _pick_entry_value(entry, ["name", "Name", "chart", "Chart", "helmchart", "Helmchart"])
    if not name:
        return False
    return target in name.lower()


def _pick_cluster_name(result: dict[str, Any], preferred: str = "primary-cluster") -> str:
    entries = _extract_installed_entries(result)
    names = [
        _pick_entry_value(entry, ["ClusterName", "cluster", "Cluster", "name", "Name"])
        for entry in entries
    ]
    names = [name for name in names if name]
    if preferred in names:
        return preferred
    return names[0] if names else ""


def _pick_namespace_list(result: dict[str, Any]) -> list[str]:
    entries = _extract_installed_entries(result)
    names = [_pick_entry_value(entry, ["Namespace", "namespace", "name", "Name"]) for entry in entries]
    return [name for name in names if name]


def _get_target_meta(entry: dict[str, Any]) -> dict[str, str]:
    chart_raw = _pick_entry_value(entry, ["Helmchart", "helmchart", "chart", "chartName"])
    app_version = _pick_entry_value(entry, ["app_version", "appVersion"])
    chart_info = _parse_chart_info(chart_raw, app_version)
    return {
        "name": _pick_entry_value(entry, ["ReleaseName", "releaseName", "release_name", "name"]),
        "namespace": _pick_entry_value(entry, ["Namespace", "namespace"]),
        "cluster": _pick_entry_value(entry, ["Cluster", "cluster"]),
        "chartRaw": chart_raw,
        "chartName": chart_info.get("helmchart") or chart_raw,
        "chartVersion": chart_info.get("version") or "",
    }


def _build_deploy_id(target: dict[str, str]) -> str:
    if not target.get("name") or not target.get("namespace") or not target.get("cluster"):
        return ""
    return f"id-{target['name']}-=-{target['namespace']}-=-{target['cluster']}"


def _fetch_workload_entries(cluster: str, namespace: str) -> list[dict[str, Any]]:
    if not cluster or not namespace:
        return []
    node = f"/{cluster}/{namespace}"
    result = ua_request(
        "GET",
        "/microservice/Workload/readForTree",
        {"node": node, "type": "deployment"},
    )
    return _extract_workload_entries(result)


def _parse_ready(value: Any) -> tuple[float, float]:
    if isinstance(value, str) and "/" in value:
        left, right = value.split("/", 1)
        return _parse_number(left), _parse_number(right)
    parsed = _parse_number(value)
    return parsed, parsed


def _parse_number(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _is_running(entry: dict[str, Any] | None) -> bool:
    if not entry:
        return False
    ready, total = _parse_ready(entry.get("ready"))
    available = _parse_number(entry.get("available"))
    return ready > 0 and (total == 0 or ready >= total) and available > 0


def _fetch_catalog_entries(limit: int = 500) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    start = 0
    while True:
        result = ua_request("GET", "/microservice/Catalogs", {"start": str(start), "limit": str(limit)})
        batch = _extract_catalog_entries(result)
        if not batch:
            break
        entries.extend(batch)
        if len(batch) < limit:
            break
        start += limit
    return entries


def _format_target_entry(entry: dict[str, Any]) -> str:
    meta = _get_target_meta(entry)
    parts = [
        f"release={meta.get('name') or 'unknown'}",
        f"namespace={meta.get('namespace') or 'unknown'}",
        f"cluster={meta.get('cluster') or 'unknown'}",
        f"helmchart={meta.get('chartName') or meta.get('chartRaw') or 'unknown'}",
        f"version={meta.get('chartVersion') or 'unknown'}",
    ]
    return ", ".join(parts)


def _collect_hint_candidates(
    entries: list[dict[str, Any]],
    namespace_override: str,
    hints: list[str],
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for entry in entries:
        if namespace_override and _pick_entry_value(entry, ["Namespace", "namespace"]) != namespace_override:
            continue
        if any(_matches_target(entry, hint) for hint in hints if hint):
            candidates.append(entry)
    return candidates


def check_trap_chain() -> None:
    required = [
        {"key": "trap-collector", "label": "Trap Collector", "hints": ["trap-collector", "trap collector"]},
        {"key": "fcom-processor", "label": "FCOM Processor", "hints": ["fcom-processor", "fcom processor"]},
        {"key": "event-sink", "label": "Event Sink", "hints": ["event-sink", "event sink"]},
    ]
    installed = _fetch_installed_entries()
    catalogs = _fetch_catalog_entries()

    workloads: dict[str, dict[str, dict[str, Any]]] = {}
    for entry in installed:
        cluster = _pick_entry_value(entry, ["Cluster", "cluster"])
        namespace = _pick_entry_value(entry, ["Namespace", "namespace"])
        if not cluster or not namespace:
            continue
        key = f"{cluster}::{namespace}"
        if key in workloads:
            continue
        data = _fetch_workload_entries(cluster, namespace)
        workloads[key] = {item.get("name"): item for item in data if item.get("name")}

    def find_match(entries: list[dict[str, Any]], hints: list[str], matcher) -> dict[str, Any] | None:
        for entry in entries:
            if any(matcher(entry, hint) for hint in hints):
                return entry
        return None

    status = []
    missing = []
    for item in required:
        hints = [hint.lower() for hint in item["hints"]]
        installed_entry = find_match(installed, hints, _matches_target)
        catalog_entry = find_match(catalogs, hints, _matches_catalog_target)
        cluster = _pick_entry_value(installed_entry or {}, ["Cluster", "cluster"]) if installed_entry else ""
        namespace = _pick_entry_value(installed_entry or {}, ["Namespace", "namespace"]) if installed_entry else ""
        workload_key = f"{cluster}::{namespace}" if cluster and namespace else ""
        workload_entry = workloads.get(workload_key, {}).get(item["key"]) if workload_key else None
        entry_status = {
            "name": item["key"],
            "label": item["label"],
            "installed": bool(installed_entry),
            "available": bool(catalog_entry),
            "running": bool(installed_entry) and _is_running(workload_entry),
            "cluster": cluster,
            "namespace": namespace,
            "workload": {
                "ready": workload_entry.get("ready") if workload_entry else "",
                "available": workload_entry.get("available") if workload_entry else "",
                "uptodate": workload_entry.get("uptodate") if workload_entry else "",
            }
        }
        status.append(entry_status)
        if not entry_status["installed"]:
            missing.append(item["key"])

    print(json.dumps({"success": True, "required": status, "missing": missing}, indent=2))


def deploy_service(service_name: str) -> None:
    if not service_name:
        raise RuntimeError("Missing service name")

    clusters = ua_request("GET", "/microservice/Clusters", {"start": "0", "limit": "100"})
    cluster_name = _pick_cluster_name(clusters)
    if not cluster_name:
        raise RuntimeError("No clusters found")

    namespaces_result = ua_request(
        "GET",
        "/microservice/Deploy/readClusterData",
        {"Cluster": cluster_name, "start": "0", "limit": "200"},
    )
    namespaces = _pick_namespace_list(namespaces_result)
    if not namespaces:
        raise RuntimeError("No namespaces found for cluster")

    installed = _fetch_installed_entries()
    if any(_matches_target(entry, service_name.lower()) for entry in installed):
        print(json.dumps({"success": True, "alreadyInstalled": True}, indent=2))
        return

    catalogs = _fetch_catalog_entries()
    catalog_entry = None
    for entry in catalogs:
        if _matches_catalog_target(entry, service_name.lower()):
            catalog_entry = entry
            break
    if not catalog_entry:
        raise RuntimeError("Helm chart not found in catalog")

    chart_name = _pick_entry_value(entry=catalog_entry, keys=["name", "Name", "chart", "Chart", "helmchart", "Helmchart"])
    version = _pick_entry_value(entry=catalog_entry, keys=["version", "Version"])
    if not chart_name or not version:
        raise RuntimeError("Missing catalog chart name or version")

    namespace = namespaces[0]
    preferred_entry = None
    for entry in installed:
        if _matches_target(entry, "trap-collector") or _matches_target(entry, "event-sink"):
            preferred_entry = entry
            break
    preferred_namespace = _pick_entry_value(preferred_entry or {}, ["Namespace", "namespace"])
    if preferred_namespace and preferred_namespace in namespaces:
        namespace = preferred_namespace
    if service_name == "fcom-processor":
        namespace_override = FCOM_PROCESSOR_NAMESPACE.strip()
        if namespace_override and namespace_override in namespaces:
            namespace = namespace_override

    values = ua_request(
        "GET",
        "/microservice/Catalogs/readForHelmchartValues",
        {"Helmchart": chart_name, "Version": version},
    )
    custom_values = _extract_custom_values(values)

    payload = {
        "Cluster": cluster_name,
        "Namespace": namespace,
        "Helmchart": chart_name,
        "ReleaseName": chart_name,
        "Version": version,
        "CustomValues": custom_values,
    }
    missing = [key for key, value in payload.items() if key != "CustomValues" and not value]
    if missing:
        raise RuntimeError(f"Missing required deploy fields: {', '.join(missing)}")

    deploy_result = ua_request("POST", "/microservice/Deploy", payload)
    if not deploy_result.get("success"):
        raise RuntimeError("Failed to deploy microservice")
    print(json.dumps({"success": True, "deployResult": deploy_result}, indent=2))


def redeploy_service(service_name: str) -> None:
    if not service_name:
        raise RuntimeError("Missing service name")
    clusters = ua_request("GET", "/microservice/Clusters", {"start": "0", "limit": "100"})
    cluster_name = _pick_cluster_name(clusters)
    if not cluster_name:
        raise RuntimeError("No clusters found")

    namespaces_result = ua_request(
        "GET",
        "/microservice/Deploy/readClusterData",
        {"Cluster": cluster_name, "start": "0", "limit": "200"},
    )
    namespaces = _pick_namespace_list(namespaces_result)
    if not namespaces:
        raise RuntimeError("No namespaces found for cluster")

    installed = _fetch_installed_entries()
    target_entry = None
    for entry in installed:
        if _matches_target(entry, service_name.lower()):
            target_entry = entry
            break
    if not target_entry:
        raise RuntimeError("Microservice release not found")

    target_meta = _get_target_meta(target_entry)
    if not target_meta.get("cluster"):
        target_meta["cluster"] = cluster_name
    if not target_meta.get("namespace") or target_meta["namespace"] not in namespaces:
        raise RuntimeError("Installed chart namespace not found in cluster namespaces")

    deploy_id = _build_deploy_id(target_meta)
    if not deploy_id:
        raise RuntimeError("Missing deploy id")

    values_response = ua_request(
        "GET",
        "/microservice/Deploy",
        {
            "Cluster": target_meta.get("cluster", ""),
            "Namespace": target_meta.get("namespace", ""),
            "Helmchart": target_meta.get("chartName") or target_meta.get("chartRaw", ""),
            "ReleaseName": target_meta.get("name", ""),
            "Version": target_meta.get("chartVersion", ""),
        },
    )
    custom_values = _extract_custom_values(values_response)
    if not custom_values:
        raise RuntimeError("Missing CustomValues")

    payload = {
        "Cluster": target_meta.get("cluster", ""),
        "Namespace": target_meta.get("namespace", ""),
        "Helmchart": target_meta.get("chartName") or target_meta.get("chartRaw", ""),
        "ReleaseName": target_meta.get("name", ""),
        "Version": target_meta.get("chartVersion", ""),
        "CustomValues": custom_values,
    }
    missing = [key for key, value in payload.items() if key != "CustomValues" and not value]
    if missing:
        raise RuntimeError(f"Missing required deploy fields: {', '.join(missing)}")

    delete_result = ua_request("DELETE", f"/microservice/deploy/{deploy_id}")
    if not delete_result.get("success"):
        raise RuntimeError("Failed to uninstall")

    deploy_result = ua_request("POST", "/microservice/Deploy", payload)
    if not deploy_result.get("success"):
        raise RuntimeError("Failed to redeploy")
    print(json.dumps({"success": True, "deployResult": deploy_result}, indent=2))


def redeploy_fcom_processor() -> None:
    clusters = ua_request("GET", "/microservice/Clusters", {"start": "0", "limit": "100"})
    cluster_override = FCOM_PROCESSOR_CLUSTER.strip()
    cluster_name = cluster_override or _pick_cluster_name(clusters)
    if not cluster_name:
        raise RuntimeError("No clusters found")
    if cluster_override:
        cluster_entries = _extract_installed_entries(clusters)
        cluster_names = {
            _pick_entry_value(entry, ["ClusterName", "cluster", "Cluster", "name", "Name"])
            for entry in cluster_entries
        }
        if cluster_override not in cluster_names:
            raise RuntimeError("Provided cluster not found in cluster list")

    namespaces_result = ua_request(
        "GET",
        "/microservice/Deploy/readClusterData",
        {"Cluster": cluster_name, "start": "0", "limit": "200"},
    )
    namespaces = _pick_namespace_list(namespaces_result)
    if not namespaces:
        raise RuntimeError("No namespaces found for cluster")

    namespace_override = FCOM_PROCESSOR_NAMESPACE.strip()
    if namespace_override and namespace_override not in namespaces:
        raise RuntimeError("Provided namespace not found in cluster namespaces")

    entries = _fetch_installed_entries()
    if not entries:
        raise RuntimeError("No installed Helm charts found")

    target_name = (FCOM_PROCESSOR_RELEASE_NAME or FCOM_PROCESSOR_HELM_CHART or "fcom-processor").lower()
    target_entry = None
    for entry in entries:
        if not _matches_target(entry, target_name):
            continue
        if namespace_override and _pick_entry_value(entry, ["Namespace", "namespace"]) != namespace_override:
            continue
        target_entry = entry
        break
    if not target_entry:
        hint_values = [value.strip().lower() for value in FCOM_PROCESSOR_MATCH_HINTS.split(",") if value.strip()]
        if not hint_values:
            hint_values = ["fcom-processor", "fcom processor"]
        hinted = _collect_hint_candidates(entries, namespace_override, hint_values)
        if len(hinted) == 1:
            target_entry = hinted[0]
        else:
            print("FCOM Processor release not found. Candidates:")
            for entry in hinted[:20]:
                print(f"- {_format_target_entry(entry)}")
            if not hinted:
                print("- (no matches for hints)")
            print("Hint: set FCOM_PROCESSOR_RELEASE_NAME and FCOM_PROCESSOR_NAMESPACE explicitly.")
            raise RuntimeError("FCOM Processor release not found")

    target_meta = _get_target_meta(target_entry)
    if not target_meta.get("cluster"):
        target_meta["cluster"] = cluster_name
    if namespace_override:
        target_meta["namespace"] = namespace_override
    if not target_meta.get("namespace") or target_meta["namespace"] not in namespaces:
        raise RuntimeError("Installed chart namespace not found in cluster namespaces")

    deploy_id = _build_deploy_id(target_meta)
    if not deploy_id:
        raise RuntimeError("Missing deploy id for FCOM Processor")

    values_response = ua_request(
        "GET",
        "/microservice/Deploy",
        {
            "Cluster": target_meta.get("cluster", ""),
            "Namespace": target_meta.get("namespace", ""),
            "Helmchart": target_meta.get("chartName") or target_meta.get("chartRaw", ""),
            "ReleaseName": target_meta.get("name", ""),
            "Version": target_meta.get("chartVersion", ""),
        },
    )
    custom_values = _extract_custom_values(values_response)
    if not custom_values:
        raise RuntimeError("Missing CustomValues for FCOM Processor")

    payload = {
        "Cluster": target_meta.get("cluster", ""),
        "Namespace": target_meta.get("namespace", ""),
        "Helmchart": target_meta.get("chartName") or target_meta.get("chartRaw", ""),
        "ReleaseName": target_meta.get("name", ""),
        "Version": target_meta.get("chartVersion", ""),
        "CustomValues": custom_values,
    }
    missing = [key for key, value in payload.items() if key != "CustomValues" and not value]
    if missing:
        raise RuntimeError(f"Missing required deploy fields: {', '.join(missing)}")

    delete_result = ua_request("DELETE", f"/microservice/deploy/{deploy_id}")
    if not delete_result.get("success"):
        raise RuntimeError("Failed to uninstall FCOM Processor")

    deploy_result = ua_request("POST", "/microservice/Deploy", payload)
    if not deploy_result.get("success"):
        raise RuntimeError("Failed to redeploy FCOM Processor")

    print(json.dumps({"success": True, "deployResult": deploy_result}, indent=2))


def _parse_params(args: list[str]) -> dict[str, str]:
    params: dict[str, str] = {}
    for arg in args:
        if "=" not in arg:
            continue
        key, value = arg.split("=", 1)
        params[key] = value
    return params


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: ua_api_helper.py <METHOD> <PATH> [key=value ...] | redeploy-fcom")
        return 1
    if sys.argv[1] == "redeploy-fcom":
        redeploy_fcom_processor()
        return 0
    if sys.argv[1] == "check-trap-chain":
        check_trap_chain()
        return 0
    if sys.argv[1] == "deploy-service":
        params = _parse_params(sys.argv[2:])
        deploy_service(params.get("name", ""))
        return 0
    if sys.argv[1] == "redeploy-service":
        params = _parse_params(sys.argv[2:])
        redeploy_service(params.get("name", ""))
        return 0
    if len(sys.argv) < 3:
        print("Usage: ua_api_helper.py <METHOD> <PATH> [key=value ...]")
        return 1
    method = sys.argv[1]
    path = sys.argv[2]
    params = _parse_params(sys.argv[3:])
    payload = ua_request(method, path, params)
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
