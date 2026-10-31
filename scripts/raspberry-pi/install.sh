#!/usr/bin/env bash
# Compatibility alias. Use setup.sh for installation and updates.
set -Eeuo pipefail
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
exec bash "$source_dir/setup.sh" "$@"
