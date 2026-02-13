"""
Purpose:
  Inspect a legacy rules folder and summarize base.includes, base.load, and rule function mappings.

Usage:
  /root/navigator/.venv/bin/python scripts/legacy_rules_inspect.py /path/to/legacy/root

Notes:
  - Outputs a JSON summary to stdout.
  - Does not modify files.
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple


@dataclass
class IncludeEntry:
    name: str
    path: str


@dataclass
class DispatchRule:
    condition: str
    functions: List[str]


@dataclass
class RuleFileMeta:
    path: str
    declared_name: Optional[str]
    rulesfile_label: Optional[str]


@dataclass
class IncludeResolution:
    name: str
    original_path: str
    resolved_path: Optional[str]
    exists: bool
    match_kind: str


def read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as handle:
        return handle.read()


def parse_base_includes(path: str) -> List[IncludeEntry]:
    if not os.path.exists(path):
        return []
    entries: List[IncludeEntry] = []
    for line in read_text(path).splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "," not in line:
            continue
        name, value = [chunk.strip() for chunk in line.split(",", 1)]
        if name and value:
            entries.append(IncludeEntry(name=name, path=value))
    return entries


def parse_base_load(path: str) -> List[str]:
    if not os.path.exists(path):
        return []
    calls: List[str] = []
    pattern = re.compile(r"^\s*([A-Za-z0-9_]+)\s*\(\s*\)\s*;\s*$")
    for line in read_text(path).splitlines():
        match = pattern.match(line)
        if match:
            calls.append(match.group(1))
    return calls


def list_rules_files(root: str) -> List[str]:
    results: List[str] = []
    for current_root, _dirs, files in os.walk(root):
        for file_name in files:
            if file_name.lower().endswith(".rules"):
                results.append(os.path.join(current_root, file_name))
    return results


def normalize_path(path: str) -> str:
    return os.path.normpath(path).replace("\\", "/")


def resolve_include_path(root: str, include_path: str) -> Tuple[Optional[str], bool, str]:
    if not include_path:
        return None, False, "empty"
    candidate = include_path
    if os.path.isabs(candidate):
        if os.path.exists(candidate):
            return candidate, True, "absolute"
    else:
        candidate = os.path.join(root, include_path)
        if os.path.exists(candidate):
            return candidate, True, "relative"
    return None, False, "unresolved"


def parse_rules_meta(path: str) -> RuleFileMeta:
    content = read_text(path)
    name_match = re.search(r"^#\s*Name:\s*(.+)$", content, flags=re.MULTILINE)
    rulesfile_match = re.search(r"\$rulesfile\s*=\s*\"([^\"]+)\"", content)
    declared_name = name_match.group(1).strip() if name_match else None
    rulesfile_label = rulesfile_match.group(1).strip() if rulesfile_match else None
    return RuleFileMeta(path=path, declared_name=declared_name, rulesfile_label=rulesfile_label)


def parse_dispatch_rules(path: str) -> List[DispatchRule]:
    if not os.path.exists(path):
        return []
    content = read_text(path)
    lines = content.splitlines()
    dispatches: List[DispatchRule] = []
    current_condition: Optional[str] = None
    current_functions: List[str] = []

    condition_pattern = re.compile(r"^\s*(if|elsif)\s*\((.+)\)\s*\{\s*$")
    function_pattern = re.compile(r"\b([A-Za-z0-9_]+)\s*\(\s*\)\s*;\s*$")

    for line in lines:
        condition_match = condition_pattern.match(line)
        if condition_match:
            if current_condition:
                dispatches.append(DispatchRule(condition=current_condition, functions=current_functions))
            current_condition = condition_match.group(2).strip()
            current_functions = []
            continue
        func_match = function_pattern.search(line)
        if func_match and current_condition:
            current_functions.append(func_match.group(1))

    if current_condition:
        dispatches.append(DispatchRule(condition=current_condition, functions=current_functions))

    return dispatches


def inspect_root(root: str, single_file: Optional[str] = None) -> Dict[str, object]:
    base_includes_path = os.path.join(root, "base.includes")
    base_load_path = os.path.join(root, "base.load")
    base_rules_path = os.path.join(root, "base.rules")

    include_entries = parse_base_includes(base_includes_path)
    include_map = {entry.name: entry.path for entry in include_entries}
    load_calls = parse_base_load(base_load_path)
    dispatch_rules = parse_dispatch_rules(base_rules_path)

    rules_files = [single_file] if single_file else list_rules_files(root)
    rules_meta = [parse_rules_meta(path) for path in rules_files]

    include_matches: Dict[str, List[str]] = {}
    include_resolutions: List[IncludeResolution] = []
    for entry in include_entries:
        name = entry.name
        name_lower = name.lower()
        matches: List[str] = []
        for meta in rules_meta:
            file_lower = os.path.basename(meta.path).lower()
            declared_lower = (meta.declared_name or '').lower()
            if name_lower in file_lower or (declared_lower and name_lower == declared_lower):
                matches.append(meta.path)
        if matches:
            include_matches[name] = matches
        resolved_path, exists, match_kind = resolve_include_path(root, entry.path)
        include_resolutions.append(
            IncludeResolution(
                name=entry.name,
                original_path=entry.path,
                resolved_path=normalize_path(resolved_path) if resolved_path else None,
                exists=exists,
                match_kind=match_kind,
            )
        )

    include_missing = [name for name in include_map if name not in include_matches]
    dispatched_functions = sorted(
        {fn for dispatch in dispatch_rules for fn in dispatch.functions if fn}
    )
    dispatch_missing = [fn for fn in dispatched_functions if fn not in include_matches]

    traversal_order: List[Dict[str, object]] = []
    for idx, dispatch in enumerate(dispatch_rules, start=1):
        entry = {
            "index": idx,
            "condition": dispatch.condition,
            "functions": dispatch.functions,
        }
        traversal_order.append(entry)

    traversal_graph: List[Dict[str, object]] = []
    if dispatch_rules:
        for idx, dispatch in enumerate(dispatch_rules, start=1):
            sources = [f"dispatch:{idx}"]
            for fn in dispatch.functions:
                targets = include_matches.get(fn, [])
                traversal_graph.append(
                    {
                        "from": sources[0],
                        "function": fn,
                        "to_files": targets,
                    }
                )
    elif include_entries:
        for entry in include_entries:
            traversal_graph.append(
                {
                    "from": "includes",
                    "function": entry.name,
                    "to_files": include_matches.get(entry.name, []),
                }
            )
    elif rules_files:
        for path in rules_files:
            traversal_graph.append(
                {
                    "from": "standalone",
                    "function": None,
                    "to_files": [path],
                }
            )

    return {
        "root": root,
        "base": {
            "includes": base_includes_path if os.path.exists(base_includes_path) else None,
            "load": base_load_path if os.path.exists(base_load_path) else None,
            "rules": base_rules_path if os.path.exists(base_rules_path) else None,
        },
        "includes": [asdict(entry) for entry in include_entries],
        "include_resolutions": [asdict(entry) for entry in include_resolutions],
        "base_load_calls": load_calls,
        "dispatch_rules": [asdict(entry) for entry in dispatch_rules],
        "traversal_order": traversal_order,
        "traversal_graph": traversal_graph,
        "rule_files": rules_files,
        "rule_metadata": [asdict(meta) for meta in rules_meta],
        "include_matches": include_matches,
        "missing": {
            "includes_without_definitions": include_missing,
            "dispatch_without_definitions": dispatch_missing,
        },
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: legacy_rules_inspect.py /path/to/legacy/root_or_file", file=sys.stderr)
        return 2
    target = os.path.abspath(sys.argv[1])
    single_file: Optional[str] = None
    if os.path.isfile(target):
        single_file = target
        root = os.path.dirname(target)
    else:
        root = target
    if not os.path.isdir(root):
        print(f"Directory not found: {root}", file=sys.stderr)
        return 1
    report = inspect_root(root, single_file=single_file)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
