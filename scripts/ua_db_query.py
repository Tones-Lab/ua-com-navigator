#!/usr/bin/env python3
"""
Purpose:
- Run UA database queries via the query tools REST endpoint.

Usage:
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_db_query.py --db Assure1 --query "select * from DiscoverySNMPAccess limit 5"
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_db_query.py --db Event --query "select * from Event limit 5"
- /root/navigator/.venv/bin/python /root/navigator/scripts/ua_db_query.py --db Assure1 --limit 50 --query "select * from DiscoverySNMPAccess"

Notes/Environment:
- Uses UA credentials/settings from scripts/ua_api_helper.py.
- Sends query via /database/queryTools/executeQuery with form-encoded payload.
"""
from __future__ import annotations

import argparse
import json
import ssl
import urllib.parse
import urllib.request
from typing import Any, Dict

from ua_api_helper import BASE_URL, UA_INSECURE_TLS, _build_headers

DEFAULT_ENDPOINT = "/database/queryTools/executeQuery"


def _post_form(path: str, params: Dict[str, str]) -> Dict[str, Any]:
    url = f"{BASE_URL}{path}"
    data = urllib.parse.urlencode(params).encode("utf-8")
    headers = _build_headers()
    headers["Content-Type"] = "application/x-www-form-urlencoded"
    context = ssl._create_unverified_context() if UA_INSECURE_TLS else None
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, context=context, timeout=30) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run UA DB query via REST query tools.")
    parser.add_argument("--db", default="Assure1", help="Database name (QueryDBName)")
    parser.add_argument("--db-id", default="", help="Database ID (QueryDatabaseID)")
    parser.add_argument("--shard", default="", help="Shard ID (QueryShardID)")
    parser.add_argument("--limit", default="100", help="QueryLimit value")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT, help="Query endpoint path")
    parser.add_argument("--query", required=True, help="SQL query to execute")
    args = parser.parse_args()

    params = {
        "QueryDBName": args.db,
        "QueryDatabaseID": args.db_id,
        "QueryShardID": args.shard,
        "QueryLimit": str(args.limit),
        "Query": args.query,
        "page": "1",
        "start": "0",
        "limit": str(args.limit),
    }

    payload = _post_form(args.endpoint, params)
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
