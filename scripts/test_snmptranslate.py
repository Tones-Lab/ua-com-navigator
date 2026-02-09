#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
from typing import Any


def run_snmptranslate(binary: str, mib_dir: str, module: str | None, mibs: str | None, target: str) -> dict[str, Any]:
    args = [binary, "-On", "-M", mib_dir]
    if module:
        args.extend(["-m", module])
    args.append(target)

    env = os.environ.copy()
    env["MIBDIRS"] = mib_dir
    if mibs is not None:
        env["MIBS"] = mibs

    result = subprocess.run(
        args,
        env=env,
        text=True,
        capture_output=True,
        timeout=8,
    )
    return {
        "target": target,
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Test snmptranslate resolution for a MIB object.")
    parser.add_argument("--name", required=True, help="Object name (or module::name).")
    parser.add_argument("--module", help="MIB module name, e.g. A10-AX-NOTIFICATIONS.")
    parser.add_argument("--mib-dir", default=os.getenv("UA_MIB_DIR") or os.getenv("MIBDIRS") or "/opt/assure1/distrib/mibs")
    parser.add_argument("--mibs", default=os.getenv("MIBS"), help="Optional MIBS search list.")
    parser.add_argument("--binary", default=os.getenv("UA_SNMP_TRANSLATE_CMD", "snmptranslate"))
    args = parser.parse_args()

    name = args.name.strip()
    module = args.module.strip() if args.module else None
    candidates = []
    if "::" in name:
        candidates.append(name)
    else:
        if module:
            candidates.append(f"{module}::{name}")
        candidates.append(name)

    results = [run_snmptranslate(args.binary, args.mib_dir, module, args.mibs, target) for target in candidates]

    payload = {
        "binary": args.binary,
        "mib_dir": args.mib_dir,
        "module": module,
        "mibs": args.mibs,
        "name": name,
        "results": results,
    }
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
