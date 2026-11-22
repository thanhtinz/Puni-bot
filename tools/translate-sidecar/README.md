# Puni translation sidecar (free EN→VI rulings translation)

Self-hosted machine translation for card rulings — no API key, no
payment card, no per-character quota. Runs the Argos Translate
en→vi model on CTranslate2 (CPU). Quality is below DeepL; the card
page always shows the English original under the translation so
players can cross-check.

## Install (on the same machine as the dashboard)

```bash
cd tools/translate-sidecar
python3 -m venv venv
./venv/bin/pip install ctranslate2 sentencepiece   # ~175 MB total, no torch
./fetch-model.sh                                    # model → /opt/puni-models/translate-en_vi
./venv/bin/python server.py                         # listens on 127.0.0.1:5000
```

## Run it as a service (systemd sketch)

```ini
[Unit]
Description=Puni translate sidecar
After=network.target

[Service]
WorkingDirectory=/opt/puni-bot/tools/translate-sidecar
ExecStart=/opt/puni-bot/tools/translate-sidecar/venv/bin/python server.py
Restart=on-failure
User=puni

[Install]
WantedBy=multi-user.target
```

## Point the dashboard at it

Set in the dashboard environment:

```bash
LIBRETRANSLATE_URL=http://127.0.0.1:5000
```

If `DEEPL_API_KEY` is also set, DeepL wins (better quality). With
neither set, rulings simply stay in English.
