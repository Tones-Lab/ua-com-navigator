#!/usr/bin/env python3
"""Redeploy the FCOM Processor using UA microservice APIs.

Usage example:
  python3 scripts/redeploy_fcom_processor.py \
    --base-url https://ua-host:8443/api \
    --username admin --password secret --insecure

For client cert auth:
  python3 scripts/redeploy_fcom_processor.py \
    --base-url https://ua-host:8443/api \
    --cert /path/cert.pem --key /path/key.pem --ca-cert /path/ca.pem
"""

import argparse
import json
import sys
from typing import Any, Dict, Optional, Tuple

try:
    import requests
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: requests. Install with 'pip install requests'.") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Redeploy FCOM Processor via UA APIs")
    parser.add_argument("--base-url", required=True, help="UA API base URL, e.g. https://host:8443/api")
    parser.add_argument("--username", help="Basic auth username")
    parser.add_argument("--password", help="Basic auth password")
    parser.add_argument("--cert", help="Client certificate path (PEM)")
    parser.add_argument("--key", help="Client key path (PEM)")
    parser.add_argument("--ca-cert", help="CA cert path (PEM)")
    parser.add_argument("--insecure", action="store_true", help="Disable TLS verification")
    parser.add_argument("--release", default="fcom-processor", help="Release name to redeploy")
    parser.add_argument("--namespace", help="Namespace to target (override auto-detect)")
    parser.add_argument("--cluster", help="Cluster to target (override auto-detect)")
    parser.add_argument(
        "--match-hints",
        help="Comma-separated fallback match hints (e.g. fcom-processor,\"fcom processor\")",
    )
    parser.add_argument("--page", type=int, default=1, help="Installed charts page")
    parser.add_argument("--start", type=int, default=0, help="Installed charts start")
    parser.add_argument("--limit", type=int, default=25, help="Installed charts limit")
    return parser.parse_args()


def exit_error(message: str, payload: Optional[Dict[str, Any]] = None, code: int = 1) -> None:
    if payload is not None:
        print(message)
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(message)
    raise SystemExit(code)


def get_session(args: argparse.Namespace) -> requests.Session:
    session = requests.Session()
    if args.username and args.password:
        session.auth = (args.username, args.password)
    if args.cert and args.key:
        session.cert = (args.cert, args.key)
    elif args.cert:
        session.cert = args.cert
    if args.ca_cert:
        session.verify = args.ca_cert
    elif args.insecure:
        session.verify = False
    return session


def request_json(
    session: requests.Session,
    method: str,
    url: str,
    params: Optional[Dict[str, Any]] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    response = session.request(method, url, params=params, json=payload, timeout=30)
    try:
        data = response.json()
    except ValueError:
        exit_error(f"Non-JSON response from {method} {url}", {"status": response.status_code})
    if response.status_code >= 400:
        exit_error(f"HTTP {response.status_code} from {method} {url}", data)
    return data


def pick_cluster(data: Any, preferred: str = "primary-cluster") -> Optional[str]:
    if isinstance(data, dict):
        data = data.get("data")
    if not isinstance(data, list):
        return None
    names = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        name = (
            entry.get("name")
            or entry.get("Name")
            or entry.get("cluster")
            or entry.get("Cluster")
            or entry.get("ClusterName")
        )
        if isinstance(name, str) and name.strip():
            names.append(name.strip())
    if not names:
        return None
    if preferred in names:
        return preferred
    return names[0]


def extract_custom_values(result: Dict[str, Any]) -> Optional[str]:
    candidates = [
        result.get("CustomValues"),
        result.get("customValues"),
        result.get("values"),
        result.get("Value"),
        result.get("value"),
    ]
    data = result.get("data")
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            candidates.extend(
                [
                    first.get("CustomValues"),
                    first.get("customValues"),
                    first.get("values"),
                    first.get("Value"),
                    first.get("value"),
                ]
            )
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
    for item in candidates:
        if isinstance(item, str) and item.strip():
            return item
    return None


def normalize_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    return {str(key).lower(): value for key, value in entry.items()}


def pick_entry_value(entry: Dict[str, Any], keys: Tuple[str, ...]) -> str:
    normalized = normalize_entry(entry)
    for key in keys:
        if key in entry and entry[key] is not None:
            return str(entry[key])
        lower = key.lower()
        if lower in normalized and normalized[lower] is not None:
            return str(normalized[lower])
    return ""


def parse_chart_info(chart: str, app_version: str) -> Tuple[str, str]:
    chart = (chart or "").strip()
    if chart:
        import re

        match = re.match(r"^(.*)-([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?)$", chart)
        if match:
            return match.group(1), match.group(2)
    version = (app_version or "").lstrip("vV")
    return chart, version


def matches_target(entry: Dict[str, Any], target: str) -> bool:
    if not target:
        return False
    target = target.lower()
    candidates = [
        pick_entry_value(entry, ("ReleaseName", "releaseName", "release_name")),
        pick_entry_value(entry, ("Helmchart", "helmchart", "chart", "chartName", "helmChart")),
        pick_entry_value(entry, ("Name", "name")),
    ]
    return any(target in value.lower() for value in candidates if value)


def format_target_entry(entry: Dict[str, Any]) -> str:
    name = pick_entry_value(entry, ("ReleaseName", "releaseName", "release_name", "name")) or "unknown"
    namespace = pick_entry_value(entry, ("Namespace", "namespace")) or "unknown"
    cluster = pick_entry_value(entry, ("Cluster", "cluster")) or "unknown"
    chart_raw = pick_entry_value(entry, ("Helmchart", "helmchart", "chart", "chartName"))
    app_version = pick_entry_value(entry, ("app_version", "appVersion"))
    chart_name, chart_version = parse_chart_info(chart_raw, app_version)
    return (
        f"release={name}, namespace={namespace}, cluster={cluster}, "
        f"helmchart={chart_name or chart_raw or 'unknown'}, version={chart_version or 'unknown'}"
    )


def fetch_catalog_entries(
    session: requests.Session,
    base_url: str,
    limit: int = 500,
) -> list[Dict[str, Any]]:
    entries: list[Dict[str, Any]] = []
    start = 0
    while True:
        result = request_json(
            session,
            "GET",
            f"{base_url}/microservice/Catalogs",
            params={"start": start, "limit": limit},
        )
        data = result.get("data")
        batch: list[Dict[str, Any]] = []
        if isinstance(data, list):
            batch = [entry for entry in data if isinstance(entry, dict)]
        elif isinstance(data, dict):
            nested = data.get("data")
            if isinstance(nested, list):
                batch = [entry for entry in nested if isinstance(entry, dict)]
        if not batch:
            break
        entries.extend(batch)
        if len(batch) < limit:
            break
        start += limit
    return entries


def matches_catalog_target(entry: Dict[str, Any], target: str) -> bool:
    if not target:
        return False
    name = pick_entry_value(entry, ("name", "Name", "chart", "Chart", "helmchart", "Helmchart"))
    return bool(name) and target.lower() in name.lower()


def build_required_status(
    installed: list[Dict[str, Any]],
    catalogs: list[Dict[str, Any]],
) -> tuple[list[Dict[str, Any]], list[str]]:
    required = [
        {"key": "trap-collector", "label": "Trap Collector", "hints": ["trap-collector", "trap collector"]},
        {"key": "fcom-processor", "label": "FCOM Processor", "hints": ["fcom-processor", "fcom processor"]},
        {"key": "event-sink", "label": "Event Sink", "hints": ["event-sink", "event sink"]},
    ]
    status: list[Dict[str, Any]] = []
    missing: list[str] = []
    for item in required:
        hints = [hint.lower() for hint in item["hints"]]
        installed_match = next(
            (entry for entry in installed if any(matches_target(entry, hint) for hint in hints)),
            None,
        )
        catalog_match = next(
            (entry for entry in catalogs if any(matches_catalog_target(entry, hint) for hint in hints)),
            None,
        )
        entry_status = {
            "name": item["key"],
            "label": item["label"],
            "installed": bool(installed_match),
            "available": bool(catalog_match),
        }
        status.append(entry_status)
        if not entry_status["installed"]:
            missing.append(item["key"])
    return status, missing


def fetch_installed_entries(
    session: requests.Session,
    base_url: str,
    limit: int,
    max_pages: int = 25,
) -> list[Dict[str, Any]]:
    entries: list[Dict[str, Any]] = []
    for page in range(1, max_pages + 1):
        start = (page - 1) * limit
        installed = request_json(
            session,
            "GET",
            f"{base_url}/microservice/Deploy/readForInstalled",
            params={"page": page, "start": start, "limit": limit},
        )
        data = installed.get("data")
        if not isinstance(data, list) or not data:
            break
        entries.extend([entry for entry in data if isinstance(entry, dict)])
        if len(data) < limit:
            break
    return entries


def main() -> None:
    args = parse_args()
    session = get_session(args)
    base_url = args.base_url.rstrip("/")

    clusters_url = f"{base_url}/microservice/Clusters"
    clusters = request_json(session, "GET", clusters_url, params={"start": 0, "limit": 100})
    cluster_override = args.cluster.strip() if isinstance(args.cluster, str) else ""
    cluster_name = cluster_override or pick_cluster(clusters)
    if not cluster_name:
        exit_error("No clusters found", clusters)
    if cluster_override:
        cluster_entries = clusters.get("data") if isinstance(clusters, dict) else None
        cluster_names = set()
        if isinstance(cluster_entries, list):
            for entry in cluster_entries:
                if isinstance(entry, dict):
                    name = pick_entry_value(entry, ("ClusterName", "cluster", "Cluster", "name", "Name"))
                    if name:
                        cluster_names.add(name)
        if cluster_names and cluster_override not in cluster_names:
            exit_error("Provided cluster not found", {"cluster": cluster_override, "clusters": list(cluster_names)})

    namespaces_url = f"{base_url}/microservice/Deploy/readClusterData"
    namespaces = request_json(
        session,
        "GET",
        namespaces_url,
        params={"Cluster": cluster_name, "start": 0, "limit": 200},
    )
    namespace_list = []
    data = namespaces.get("data")
    if isinstance(data, list):
        for entry in data:
            if isinstance(entry, dict):
                name = entry.get("name") or entry.get("Name") or entry.get("namespace")
                if isinstance(name, str) and name.strip():
                    namespace_list.append(name.strip())
            elif isinstance(entry, str) and entry.strip():
                namespace_list.append(entry.strip())
    if not namespace_list:
        exit_error("No namespaces found for cluster", namespaces)
    namespace_override = args.namespace.strip() if isinstance(args.namespace, str) else ""
    if namespace_override and namespace_override not in namespace_list:
        exit_error("Provided namespace not found in cluster namespaces", {
            "namespace": namespace_override,
            "namespaces": namespace_list,
        })

    entries = fetch_installed_entries(session, base_url, max(args.limit, 1))
    if not entries:
        exit_error("No installed Helm charts found", {"cluster": cluster_name})

    catalogs = fetch_catalog_entries(session, base_url)
    required_status, required_missing = build_required_status(entries, catalogs)
    if required_missing:
        print("Warning: missing required microservices for trap collection")
        print(json.dumps({"required": required_status, "missing": required_missing}, indent=2))

    target = None
    for entry in entries:
        if namespace_override and pick_entry_value(entry, ("Namespace", "namespace")) != namespace_override:
            continue
        if matches_target(entry, args.release.lower()):
            target = entry
            break

    if not target:
        hint_values = []
        if isinstance(args.match_hints, str) and args.match_hints.strip():
            hint_values = [value.strip().lower() for value in args.match_hints.split(",") if value.strip()]
        if not hint_values:
            hint_values = ["fcom-processor", "fcom processor"]
        hinted = [
            entry
            for entry in entries
            if (not namespace_override or pick_entry_value(entry, ("Namespace", "namespace")) == namespace_override)
            and any(matches_target(entry, hint) for hint in hint_values)
        ]
        if len(hinted) == 1:
            target = hinted[0]
        else:
            print("FCOM Processor release not found. Candidates:")
            for entry in hinted[:20]:
                print(f"- {format_target_entry(entry)}")
            if not hinted:
                print("- (no matches for hints)")
            catalog_hints = [
                entry
                for entry in catalogs
                if any(matches_catalog_target(entry, hint) for hint in hint_values)
            ]
            if catalog_hints:
                print("Available in catalog:")
                for entry in catalog_hints[:20]:
                    name = pick_entry_value(entry, ("name", "Name")) or "unknown"
                    version = pick_entry_value(entry, ("version", "Version")) or "unknown"
                    print(f"- {name} ({version})")
            exit_error("FCOM Processor release not found", {"cluster": cluster_name}, code=2)

    name = pick_entry_value(target, ("ReleaseName", "releaseName", "release_name", "name")).strip()
    namespace = pick_entry_value(target, ("Namespace", "namespace")).strip()
    cluster = pick_entry_value(target, ("Cluster", "cluster")).strip() or cluster_name
    if not name or not namespace or not cluster:
        exit_error("Missing name/namespace/cluster in installed chart entry", target)
    if namespace_list and namespace not in namespace_list:
        exit_error("Installed chart namespace not found in cluster namespaces", {
            "namespace": namespace,
            "namespaces": namespace_list,
        })

    deploy_id = f"id-{name}-=-{namespace}-=-{cluster}"

    chart_raw = pick_entry_value(target, ("Helmchart", "helmchart", "chart", "chartName"))
    app_version = pick_entry_value(target, ("app_version", "appVersion"))
    chart, version = parse_chart_info(chart_raw, app_version)
    values_url = f"{base_url}/microservice/Deploy"
    values_result = request_json(
        session,
        "GET",
        values_url,
        params={
            "Cluster": cluster,
            "Namespace": namespace,
            "Helmchart": chart,
            "ReleaseName": name,
            "Version": version,
        },
    )
    custom_values = extract_custom_values(values_result)
    if not custom_values:
        exit_error("Missing CustomValues for fcom-processor", values_result)

    delete_url = f"{base_url}/microservice/deploy/{deploy_id}"
    delete_result = request_json(session, "DELETE", delete_url)
    if not delete_result.get("success"):
        exit_error("Failed to uninstall fcom-processor", delete_result)

    payload = {
        "Cluster": pick_entry_value(target, ("Cluster", "cluster")) or cluster,
        "Namespace": pick_entry_value(target, ("Namespace", "namespace")) or namespace,
        "Helmchart": chart or chart_raw,
        "ReleaseName": name,
        "Version": version or pick_entry_value(target, ("Version", "version", "chartVersion", "revision")),
        "CustomValues": custom_values,
    }

    missing = [key for key, value in payload.items() if key != "CustomValues" and not value]
    if missing:
        exit_error(f"Missing required deploy fields: {', '.join(missing)}", payload)

    deploy_url = f"{base_url}/microservice/Deploy"
    deploy_result = request_json(session, "POST", deploy_url, payload=payload)
    if not deploy_result.get("success"):
        exit_error("Failed to redeploy fcom-processor", deploy_result)

    print("Redeploy succeeded")
    print(json.dumps({"deleteResult": delete_result, "deployResult": deploy_result}, indent=2))


if __name__ == "__main__":
    main()
