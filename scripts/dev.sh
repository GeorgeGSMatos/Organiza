#!/usr/bin/env bash
set -euo pipefail
organiza_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 "$organiza_root/scripts/dev.py" --root "$organiza_root" "$@"
