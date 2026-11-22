#!/usr/bin/env python3
"""Lam moi gia thi truong (price_usd) cho game_species tu APITCG — dac ta 6.29.

Gia tri the trong game = price_usd x priceCoinsPerUsd nen gia phai bam
thi truong: script nay keo lai gia market TCGplayer cho tung game va
xuat SQL UPDATE (chi doi khi gia khac gia dang luu). Chay kem moi dot
dong bo du lieu; goi Free 1.000 request/thang chi du cho mot luot day
du (~310 request) moi thang — muon lam moi hang ngay thi can goi
Starter cua APITCG.

Dung: python3 refresh-prices.py [game-slug ...]   (mac dinh: tat ca)
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("apitcg_all", HERE / "import-apitcg-all.py")
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)  # type: ignore[union-attr]

fetch_all = _mod.fetch_all
pick_printing = _mod.pick_printing
species_id_for = _mod.species_id_for
PREFIX = _mod.PREFIX
SEED_DIR = _mod.SEED_DIR


def refresh_game(slug: str) -> tuple[int, int]:
    prefix = PREFIX[slug]
    rows = fetch_all(slug, "card")
    groups: dict[tuple, list[dict]] = {}
    for row in rows:
        code = (row.get("code") or "").strip()
        if not code:
            continue
        groups.setdefault(((row.get("set") or {}).get("_id", ""), code), []).append(row)
    lines = []
    priced = 0
    for group in groups.values():
        card = pick_printing(group)
        price = ((card.get("markets") or {}).get("tcgplayer") or {}).get("prices", {}).get("market")
        if not isinstance(price, (int, float)) or price <= 0:
            continue
        sp_id, _ = species_id_for(slug, prefix, card)
        lines.append(
            f"UPDATE game_species SET price_usd = {float(price):.2f} "
            f"WHERE id = '{sp_id}' AND price_usd IS DISTINCT FROM {float(price):.2f};")
        priced += 1
    if lines:
        SEED_DIR.mkdir(parents=True, exist_ok=True)
        (SEED_DIR / f"apitcg-prices-{slug}.sql").write_text("\n".join(lines) + "\n")
    return priced, len(groups)


def main() -> int:
    slugs = sys.argv[1:] or list(PREFIX)
    for slug in slugs:
        priced, unique = refresh_game(slug)
        print(f"[{slug}] priced {priced}/{unique}", flush=True)
    print("DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
