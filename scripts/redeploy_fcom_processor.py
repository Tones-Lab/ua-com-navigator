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


def parse_chart(chart: str, app_version: str) -> Tuple[str, str]:
    chart = (chart or "").strip()
    if "-" in chart:
        parts = chart.split("-")
        version = parts[-1]
        name = "-".join(parts[:-1])
        if name and version:
            return name, version
    if app_version:
        app_version = app_version.lstrip("v")
    return chart, app_version or ""


def main() -> None:
    args = parse_args()
    session = get_session(args)
    base_url = args.base_url.rstrip("/")

    clusters_url = f"{base_url}/microservice/Clusters"
    clusters = request_json(session, "GET", clusters_url, params={"start": 0, "limit": 100})
    cluster_name = pick_cluster(clusters)
    if not cluster_name:
        exit_error("No clusters found", clusters)

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

    installed_url = f"{base_url}/microservice/Deploy/readForInstalled"
    installed = request_json(
        session,
        "GET",
        installed_url,
        params={
            "page": args.page,
            "start": args.start,
            "limit": args.limit,
        },
    )

    data = installed.get("data")
    if not isinstance(data, list):
        exit_error("Installed charts response missing data list", installed)

    target = None
    for entry in data:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name", ""))
        namespace_value = str(entry.get("namespace", "")).strip()
        if namespace_override and namespace_value != namespace_override:
            continue
        if name == args.release:
            target = entry
            break

    if not target:
        exit_error(
            f"{args.release} not found in installed charts",
            {"cluster": cluster_name, "installed": installed},
            code=2,
        )

    name = str(target.get("name", "")).strip()
    namespace = str(target.get("namespace", "")).strip()
    cluster = str(target.get("cluster", "")).strip()
    if not name or not namespace or not cluster:
        exit_error("Missing name/namespace/cluster in installed chart entry", target)
    if namespace_list and namespace not in namespace_list:
        exit_error("Installed chart namespace not found in cluster namespaces", {
            "namespace": namespace,
            "namespaces": namespace_list,
        })

    deploy_id = f"id-{name}-=-{namespace}-=-{cluster}"

    chart, version = parse_chart(str(target.get("chart", "")), str(target.get("app_version", "")))
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
        "Cluster": cluster,
        "Namespace": namespace,
        "Helmchart": chart,
        "ReleaseName": name,
        "Version": version,
        "CustomValues": custom_values,
    }

    deploy_url = f"{base_url}/microservice/Deploy"
    deploy_result = request_json(session, "POST", deploy_url, payload=payload)
    if not deploy_result.get("success"):
        exit_error("Failed to redeploy fcom-processor", deploy_result)

    print("Redeploy succeeded")
    print(json.dumps({"deleteResult": delete_result, "deployResult": deploy_result}, indent=2))


if __name__ == "__main__":
    main()
