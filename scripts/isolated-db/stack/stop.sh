#!/usr/bin/env bash
cd "$(dirname "$0")/../../.."; . scripts/isolated-db/stack/env.sh
pkill -f "$GOTRUE_BIN serve" 2>/dev/null; pkill -f "$POSTGREST_BIN" 2>/dev/null
runuser -u "$ISO_OS_USER" -- env PATH="$PATH" pg_ctl -D "$ISO_DATA" -m fast stop >/dev/null 2>&1
[ "${ISO_KEEP_DATA:-0}" = 1 ] || rm -rf "$ISO_ROOT"; true
