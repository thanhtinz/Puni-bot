#!/usr/bin/env python3
"""Puni translation sidecar — free, self-hosted EN->VI translation.

Runs the Argos Translate en_vi model directly on CTranslate2 +
SentencePiece (the same inference stack Argos itself uses, minus
the torch/stanza weight we never need) behind the small
LibreTranslate-compatible HTTP shape the dashboard expects:

    POST /translate  {"q": ["...", "..."], "source": "en", "target": "vi"}
    -> 200           {"translatedText": ["...", "..."]}

No API key, no payment card, no quota — the model runs locally.
Only en->vi is served; anything else gets a 400. Bind to localhost:
this is an internal service for the dashboard on the same machine,
never a public endpoint.

Model: set ARGOS_MODEL_DIR to an extracted translate-en_vi package
(folder holding model/ + sentencepiece.model). Default:
/opt/puni-models/translate-en_vi — fetch-model.sh in this folder
downloads and extracts it there.
"""

from __future__ import annotations

import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import ctranslate2
import sentencepiece as spm

HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "5000"))
MODEL_DIR = os.environ.get("ARGOS_MODEL_DIR", "/opt/puni-models/translate-en_vi")

translator = ctranslate2.Translator(os.path.join(MODEL_DIR, "model"), device="cpu")
sp = spm.SentencePieceProcessor(model_file=os.path.join(MODEL_DIR, "sentencepiece.model"))

# Sentence splitting (Argos models are sentence-trained; stanza does
# this in the full stack — a conservative regex is enough for ruling
# texts, which run 1-4 sentences).
_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"“(])")


def split_sentences(text: str) -> list[str]:
    parts: list[str] = []
    for para in text.split("\n"):
        para = para.strip()
        if not para:
            continue
        parts.extend(s.strip() for s in _SPLIT.split(para) if s.strip())
    return parts or [text]


def detokenize(tokens: list[str]) -> str:
    text = sp.decode(tokens)
    if "▁" in text:  # some sentencepiece builds leave the word markers in
        text = text.replace("▁", " ")
    return text.strip()


def translate_many(texts: list[str]) -> list[str]:
    # Translate every sentence of every text in ONE ctranslate2 batch
    # so the engine parallelizes across sentences, then regroup.
    jobs: list[tuple[int, list[str]]] = []
    for idx, text in enumerate(texts):
        for sentence in split_sentences(text):
            jobs.append((idx, sp.encode(sentence, out_type=str)))
    results = translator.translate_batch([tokens for _, tokens in jobs], beam_size=4)
    per_text: dict[int, list[str]] = {}
    for (idx, _), result in zip(jobs, results):
        per_text.setdefault(idx, []).append(detokenize(result.hypotheses[0]))
    return [" ".join(per_text.get(i, [])) for i in range(len(texts))]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # keep stdout clean
        pass

    def do_POST(self):  # noqa: N802 (stdlib naming)
        if self.path != "/translate":
            return self._send(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return self._send(400, {"error": "bad json"})
        if body.get("source") != "en" or body.get("target") != "vi":
            return self._send(400, {"error": "only en->vi is served"})
        q = body.get("q")
        if isinstance(q, str):
            q = [q]
        if not isinstance(q, list) or not all(isinstance(t, str) for t in q):
            return self._send(400, {"error": "q must be a string or string[]"})
        try:
            out = translate_many(q)
        except Exception as exc:  # dashboard fails open on a 500
            return self._send(500, {"error": f"translate failed: {exc}"})
        return self._send(200, {"translatedText": out})

    def _send(self, status: int, payload: dict):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    print(f"puni translate sidecar on http://{HOST}:{PORT} (model {MODEL_DIR})", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
