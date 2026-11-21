#!/usr/bin/env bash
# Download the self-hosted webfonts (Baloo 2 + Be Vietnam Pro, woff2
# subsets incl. Vietnamese) into public/fonts and regenerate
# public/fonts/fonts.css. The woff2 files are binary, so they are not
# committed through the connector — run this once after cloning and
# whenever the font set changes.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/fonts
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" -o /tmp/puni-fonts.css
python3 - << 'PY'
import re, subprocess, pathlib
css = pathlib.Path("/tmp/puni-fonts.css").read_text()
outdir = pathlib.Path("public/fonts")
blocks = re.findall(r"/\* (\S+) \*/\s*@font-face \{(.*?)\}", css, re.S)
faces = []
for subset, body in blocks:
    fam = re.search(r"font-family: '([^']+)'", body).group(1)
    weight = re.search(r"font-weight: (\d+)", body).group(1)
    url = re.search(r"url\((https://[^)]+)\)", body).group(1)
    urange = re.search(r"unicode-range: ([^;]+);", body)
    fname = f"{fam.lower().replace(' ', '-')}-{weight}-{subset}.woff2"
    subprocess.run(["curl", "-s", url, "-o", str(outdir / fname)], check=True)
    faces.append((fam, weight, fname, urange.group(1) if urange else None))
out = []
for fam, weight, fname, urange in faces:
    out.append(
        "@font-face {\n"
        f"  font-family: '{fam}';\n  font-style: normal;\n  font-weight: {weight};\n"
        f"  font-display: swap;\n  src: url('/fonts/{fname}') format('woff2');\n"
        + (f"  unicode-range: {urange};\n" if urange else "")
        + "}"
    )
(outdir / "fonts.css").write_text("\n".join(out) + "\n")
print(f"fonts: {len(faces)} faces written")
PY
echo "Done. Fonts are in public/fonts/"
