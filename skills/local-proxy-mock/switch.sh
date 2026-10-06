#!/bin/sh
# Usage: ./switch.sh <scenario> [rule-match]
# Sets active_scenario on the rule whose "match" equals rule-match, or on the only rule.
set -e
cd "$(dirname "$0")"
python3 - "$@" <<'PY'
import json, sys

if len(sys.argv) < 2:
    sys.exit("Usage: ./switch.sh <scenario> [rule-match]")
name = sys.argv[1]
match = sys.argv[2] if len(sys.argv) > 2 else None

with open("scenarios.json") as f:
    cfg = json.load(f)
rules = [r for r in cfg["rules"] if match is None or r["match"] == match]
if not rules:
    sys.exit(f"No rule matches {match!r}")
if len(rules) > 1:
    sys.exit("Several rules exist. Pass the rule match: " + ", ".join(r["match"] for r in rules))

rule = rules[0]
if name not in rule["scenarios"]:
    sys.exit(f"Unknown scenario {name!r}. Known: {', '.join(rule['scenarios'])}")
rule["active_scenario"] = name
with open("scenarios.json", "w") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)
print(f"{rule['match']}: {name}")
PY
