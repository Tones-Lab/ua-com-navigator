"""Scan JSON files for eval expressions.

Usage:
  /root/navigator/.venv/bin/python /root/navigator/scripts/eval_scan.py --root /root/navigator/coms --limit 20

Notes:
  - Recursively scans for JSON files.
  - Extracts fields with {"eval": "..."} strings.
  - Prints summary + sample evals and $vN usage stats.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from typing import Any, Dict, List, Tuple

EVAL_KEY = "eval"
V_TOKEN_RE = re.compile(r"\$v\d+")


def extract_evals(node: Any, path: str = "$") -> List[Tuple[str, str]]:
    """Return list of (path, eval_string) from a JSON-like object."""
    results: List[Tuple[str, str]] = []
    if isinstance(node, dict):
        for key, value in node.items():
            next_path = f"{path}.{key}"
            if key == EVAL_KEY and isinstance(value, str):
                results.append((path, value))
            else:
                results.extend(extract_evals(value, next_path))
    elif isinstance(node, list):
        for idx, item in enumerate(node):
            results.extend(extract_evals(item, f"{path}[{idx}]"))
    return results


def scan_file(file_path: str) -> List[Tuple[str, str]]:
    try:
        with open(file_path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except Exception:
        return []
    return extract_evals(data)


def scan_roots(roots: List[str]) -> List[Dict[str, str]]:
    found: List[Dict[str, str]] = []
    for root in roots:
        for dirpath, _, filenames in os.walk(root):
            for filename in filenames:
                if not filename.endswith(".json"):
                    continue
                file_path = os.path.join(dirpath, filename)
                evals = scan_file(file_path)
                for path, value in evals:
                    found.append({
                        "file": file_path,
                        "path": path,
                        "eval": value,
                    })
    return found


def summarize(evals: List[Dict[str, str]], limit: int) -> None:
    unique: Dict[str, Dict[str, str]] = {}
    for entry in evals:
        unique.setdefault(entry["eval"], entry)

    eval_values = list(unique.keys())
    v_tokens = [token for ev in eval_values for token in V_TOKEN_RE.findall(ev)]
    has_if = sum(1 for ev in eval_values if "if" in ev.lower())
    has_else = sum(1 for ev in eval_values if "else" in ev.lower())

    print(f"Total evals found: {len(evals)}")
    print(f"Unique evals: {len(eval_values)}")
    print(f"Unique $v tokens: {len(set(v_tokens))}")
    print(f"Evals containing 'if': {has_if}")
    print(f"Evals containing 'else': {has_else}")
    print("\nSamples:\n")

    count = 0
    for ev, sample in unique.items():
        print(f"[{count + 1}] {sample['file']}")
        print(f"    Path: {sample['path']}")
        print(f"    Eval: {ev}")
        print()
        count += 1
        if count >= limit:
            break


def main() -> None:
    parser = argparse.ArgumentParser(description="Scan JSON files for eval expressions.")
    parser.add_argument("--root", action="append", required=True, help="Root directory to scan (repeatable)")
    parser.add_argument("--limit", type=int, default=20, help="Number of sample evals to show")
    args = parser.parse_args()

    evals = scan_roots(args.root)
    summarize(evals, args.limit)


if __name__ == "__main__":
    main()
