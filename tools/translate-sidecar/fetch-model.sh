#!/usr/bin/env bash
# Download + extract the Argos en->vi model package (v1.9, ~68 MB)
# into /opt/puni-models/translate-en_vi (override with $1).
set -euo pipefail
DEST="${1:-/opt/puni-models/translate-en_vi}"
TMP="$(mktemp -d)"
curl -sL -o "$TMP/en_vi.argosmodel" https://argos-net.com/v1/translate-en_vi-1_9.argosmodel
python3 - "$TMP" <<'PY'
import sys, zipfile
zipfile.ZipFile(f"{sys.argv[1]}/en_vi.argosmodel").extractall(sys.argv[1])
PY
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
mv "$TMP/translate-en_vi-1_9" "$DEST"
rm -rf "$TMP"
echo "model ready at $DEST"
