#!/usr/bin/env bash
# Para e apaga SOMENTE o diretório do harness (/tmp/techerp-isolated).
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/isolated-db/env.sh
if [ -f "$ISO_DATA/PG_VERSION" ]; then
  runuser -u "$ISO_OS_USER" -- env PATH="$PATH" pg_ctl -D "$ISO_DATA" -m fast stop >/dev/null 2>&1 || true
fi
case "$ISO_ROOT" in /tmp/techerp-isolated*) rm -rf "$ISO_ROOT";; *) echo "recusado: $ISO_ROOT" >&2; exit 1;; esac
echo "isolated db removido"
