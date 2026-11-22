#!/usr/bin/env python3
"""Xu ly lai seed tu ban tho staging (apitcg-cards-<slug>.json) — KHONG
goi API (ngoai tru sealed neu thieu). Dung khi bo nap chinh chay truoc
khi mapping duoc sua (vd Magic khoá P/T): ban tho da luu du attributes,
anh, gia cua ban in duoc chon nen dung lai seed trung thuc 100%.

Dung: python3 reprocess-apitcg.py <slug> [slug...]
"""
import importlib.util
import json
import re
import statistics
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("apitcg_importer", BASE / "import-apitcg-all.py")
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)

STAGING = imp.STAGING
SEED_DIR = imp.SEED_DIR


def first_int(attrs: dict, keys: list[str]):
    for key in keys:
        v = imp.to_int(attrs.get(key))
        if v is not None:
            return v
    return None


def rebuild(slug: str) -> dict:
    dump_path = STAGING / f"apitcg-cards-{slug}.json"
    rows = json.loads(dump_path.read_text())
    playable = []
    set_names: dict[str, str] = {}
    for row in rows:
        attrs = row.get("attributes") or {}
        power = first_int(attrs, imp.POWER_KEYS)
        if power is None or power <= 0:
            continue
        second = first_int(attrs, imp.SECOND_KEYS)
        playable.append((row, power, second))
        if slug == "one-piece":
            sid = (row.get("set_code") or imp.slugify(row.get("set_name") or "")).lower()
            set_names[sid] = f"{row.get('set_code', '')} – {row.get('set_name', '')}".strip(" –")
        else:
            sid = imp.slugify(row.get("set_id") or row.get("set_name") or "")
            set_names[sid] = row.get("set_name") or sid
    if not playable:
        return {"game": slug, "playable": 0, "unique": len(rows)}

    median_power = statistics.median(p for _, p, _ in playable)
    divisor = 1
    while median_power / divisor > 90 and divisor < 1000:
        divisor *= 10

    # Dedupe theo id loai: cung mot la o nhieu set (goc/promo/dac biet)
    # chi giu 1 dai dien chuan (set goc > khong promo > co anh > gia thap).
    best: dict[str, tuple] = {}
    order: list[str] = []
    for row, power, second in playable:
        sid_species = row["id"]
        if slug == "one-piece":
            sset = (row.get("set_code") or "").lower()
            has_img = True  # anh OP tai local theo id
        else:
            sset = imp.slugify(row.get("set_id") or row.get("set_name") or "")
            has_img = bool(row.get("image"))
        price = row.get("price_market")
        score = imp.species_pick_score(sid_species, sset, row.get("name") or "",
                                       has_img, price if isinstance(price, (int, float)) else None)
        if sid_species not in best:
            order.append(sid_species)
            best[sid_species] = (score, (row, power, second))
        elif score < best[sid_species][0]:
            best[sid_species] = (score, (row, power, second))
    playable = [best[s][1] for s in order]

    sql_lines = []
    for sid, sname in sorted(set_names.items()):
        sql_lines.append(
            f"INSERT INTO game_sets (id, name) VALUES ({imp.sql_str(sid)}, {imp.sql_str(sname)}) "
            "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;")
    for row, power, second in playable:
        attrs = row.get("attributes") or {}
        species_id = row["id"]
        if slug == "one-piece":
            set_id = (row.get("set_code") or "").lower()
            sprite = f"/op/{species_id}.jpg"
        else:
            set_id = imp.slugify(row.get("set_id") or row.get("set_name") or "")
            sprite = row.get("image") or ""
        atk = max(1, round(power / divisor))
        hp = max(10, round(second * 10 / divisor)) if second else max(10, atk * 10)
        types = str(attrs.get("Color") or attrs.get("InkType") or attrs.get("Attribute") or attrs.get("Card Type") or "")
        rarity = imp.map_rarity(slug, str(row.get("rarity_raw") or ""))
        description = imp.clean_text(attrs.get("Description") or attrs.get("OracleText"))[:300]
        name = re.sub(r"\s\(\d+\)$", "", row.get("name") or "").strip()
        price = row.get("price_market")
        price_sql = f"{float(price):.2f}" if isinstance(price, (int, float)) and price > 0 else "NULL"
        sql_lines.append(
            "INSERT INTO game_species (id, name, types, rarity, base_hp, base_atk, base_def, base_spd, description, sprite_url, member_exclusive, enabled, set_id, price_usd) VALUES ("
            f"{imp.sql_str(species_id)}, {imp.sql_str(name)}, {imp.sql_str(types)}, {imp.sql_str(rarity)}, "
            f"{hp}, {atk}, {max(0, round((second or 0) / divisor)) if second else 0}, 50, "
            f"{imp.sql_str(description)}, {imp.sql_str(sprite)}, FALSE, FALSE, {imp.sql_str(set_id)}, {price_sql}) "
            "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, types = EXCLUDED.types, rarity = EXCLUDED.rarity, "
            "base_hp = EXCLUDED.base_hp, base_atk = EXCLUDED.base_atk, description = EXCLUDED.description, "
            "sprite_url = EXCLUDED.sprite_url, set_id = EXCLUDED.set_id, price_usd = EXCLUDED.price_usd;")

    SEED_DIR.mkdir(parents=True, exist_ok=True)
    (SEED_DIR / f"apitcg-{slug}.sql").write_text("\n".join(sql_lines) + "\n")

    sealed_path = STAGING / f"apitcg-sealed-{slug}.json"
    sealed_n = None
    if not sealed_path.exists():
        sealed = imp.fetch_all(slug, "sealed")
        sealed_path.write_text(json.dumps([
            {"name": p["name"], "set": (p.get("set") or {}).get("name"),
             "image": (p.get("images") or [{}])[0].get("medium"),
             "price": ((p.get("markets") or {}).get("tcgplayer") or {}).get("prices")}
            for p in sealed], ensure_ascii=False, indent=1))
        sealed_n = len(sealed)
    return {"game": slug, "unique": len(rows), "playable": len(playable),
            "divisor": divisor, "sets": len(set_names), "sealed_fetched": sealed_n}


def main() -> int:
    for slug in sys.argv[1:]:
        print(rebuild(slug), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
