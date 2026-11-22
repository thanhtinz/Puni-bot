#!/usr/bin/env python3
"""Dong bo toan bo game TCG tren APITCG (ca Pokemon) vao Puni — dac ta 6.29.

Cach dung:
  import-apitcg-all.py [--games slug,slug] [--no-images]

Nguyen tac:
  - Keo moi game theo trang limit=1000 qua connector custom.apitcg.
  - Gop ban in theo (set, code): uu tien ban Normal, roi ban co anh.
  - Chi lay la "dau duoc": co mot thuoc tinh suc manh dang so trong
    POWER_KEYS. Bo loc nay bo spell/event/item khong co chi so.
  - Tu hieu chuan he so chia theo tung game: trung vi suc manh tho
    duoc dua ve muc atk ~45 (chia 1/10/100/1000).
  - Do hiem: anh xa theo chuoi rarity (secret > ultra > super >
    mythic > rare > uncommon > common) + bang chu cai rieng cho
    One Piece.
  - Anh: One Piece tai ve local (dashboard/public/op/), cac game con
    lai giu URL CDN TCGplayer trong sprite_url.
  - Tat ca enabled = FALSE (staging), set vao game_sets theo tung set.
  - San pham sealed (hop/goi nguyen) cua moi game ghi rieng ra
    staging/apitcg-sealed-<game>.json de sau nay lam anh goi.
"""
import html
import json
import re
import statistics
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

BASE = "https://api.apitcg.com/api/"
REPO = Path("/home/hatch/workspace/puni-bot-repo")
WORK = Path("/home/hatch/workspace/puni-bot")
IMG_DIR = REPO / "dashboard" / "public" / "op"
SEED_DIR = REPO / "db" / "seeds"
STAGING = WORK / "staging"

PREFIX = {
    "one-piece": "op", "pokemon": "pkm", "magic": "mtg", "yugioh": "ygo", "digimon": "dig",
    "lorcana": "lor", "dragon-ball-super-fusion-world": "dbf",
    "dragon-ball-super-masters": "dbm", "final-fantasy-tcg": "ff",
    "flesh-and-blood": "fab", "gundam": "gun", "star-wars-unlimited": "swu",
    "union-arena": "una", "cardfight-vanguard": "cfv",
    "mitos-y-leyendas": "myl", "my-little-pony-tcg": "mlp",
    "naruto-card-game": "nar", "palworld": "pal", "riftbound": "rift",
    "cyberpunk": "cyb", "hololive": "holo",
}
POWER_KEYS = ["Power", "ATK", "DP", "DigimonPower", "DigimonPowerDP", "Strength", "Attack", "PowerLevel", "HP", "P", "Attack Points", "BattlePointBP", "strength", "Might"]
SECOND_KEYS = ["Toughness", "DEF", "Willpower", "Defense", "HP", "Counterplus", "T", "Hit Points"]

# Magic dung ma do hiem 1 chu cai (C/U/R/M/S) thay vi chuoi day du.
MTG_RARITY = {"C": "Common", "U": "Uncommon", "R": "Rare", "M": "Mythical", "S": "Epic", "T": "Common", "L": "Common", "P": "Rare"}
OP_RARITY = {"C": "Common", "UC": "Uncommon", "R": "Rare", "SR": "Epic",
             "SEC": "Legendary", "L": "Mythical", "SP": "Fabled", "P": "Rare"}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise RuntimeError("redirect refused")


def api_get(path: str) -> dict:
    for attempt in range(3):
        try:
            request = urllib.request.Request(BASE + path)
            add_surrogate_to_request(request, "custom.apitcg", allowed_hosts=["api.apitcg.com"])
            with urllib.request.build_opener(NoRedirect()).open(request, timeout=90) as response:
                return read_json_response(response)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


def fetch_all(slug: str, ptype: str) -> list[dict]:
    out, page = [], 1
    while True:
        data = api_get(f"products?tcg={slug}&type={ptype}&limit=1000&page={page}")
        rows = data.get("data", [])
        out.extend(rows)
        if len(out) >= data.get("total", 0) or not rows:
            return out
        page += 1


def to_int(value) -> int | None:
    if value is None:
        return None
    m = re.search(r"-?\d+", str(value).replace(",", ""))
    return int(m.group()) if m else None


def clean_text(raw) -> str:
    if not raw:
        return ""
    return html.unescape(re.sub(r"<[^>]+>", "", str(raw))).strip()


def sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:90]


def map_rarity(game: str, raw: str) -> str:
    if game == "one-piece":
        return OP_RARITY.get(raw.strip(), "Common")
    if game == "magic":
        return MTG_RARITY.get(raw.strip().upper(), "Common")
    r = raw.lower()
    if "quarter" in r or "starlight" in r or "collector" in r or "enchanted" in r or "hyper" in r:
        return "Fabled"
    if "secret" in r or "mythic" in r:
        return "Mythical"
    if "ultra" in r or "legendary" in r or "special" in r:
        return "Legendary"
    if "super" in r or "holo" in r:
        return "Epic"
    if "uncommon" in r:
        return "Uncommon"
    if "rare" in r:
        return "Rare"
    return "Common"


def species_id_for(slug: str, prefix: str, card: dict) -> tuple[str, str]:
    s = card.get("set") or {}
    code = (card.get("code") or "").strip()
    if slug == "one-piece":
        return code.lower(), (s.get("code") or "").lower()
    set_id = slugify(s.get("_id", "") or s.get("name", ""))
    return slugify(f"{prefix}-{(s.get('code') or set_id)}-{code}"), set_id


def species_pick_score(species_id: str, set_id: str, name: str, has_img: bool, price) -> tuple:
    """Cham diem chon 1 dai dien cho moi id loai (thap = tot hon).
    Cung mot la bai co the xuat hien o nhieu set (set goc, set promo,
    championship...). Uu tien: dung set goc cua ma la (OP01-077 -> op01),
    khong phai ban promo/dac biet, co anh, co gia, gia thap hon (ban in
    thuong luon re hon ban dac biet)."""
    code_head = species_id.split("-")[0] if "-" in species_id else ""
    origin = 0 if set_id and code_head and set_id == code_head else 1
    lname = (name or "").lower()
    promo = 1 if (set_id.endswith("-pr") or "(championship" in lname or "(promo" in lname
                  or "finalist" in lname) else 0
    return (origin, promo, 0 if has_img else 1, 0 if price else 1,
            float(price) if isinstance(price, (int, float)) else 0.0)


def pick_printing(rows: list[dict]) -> dict:
    def score(row: dict) -> tuple:
        printing = (row.get("markets", {}).get("tcgplayer", {}) or {}).get("printing", "")
        return (0 if printing == "Normal" else 1, 0 if row.get("images") else 1)
    return sorted(rows, key=score)[0]


def sync_game(slug: str, download_images: bool) -> dict:
    prefix = PREFIX[slug]
    rows = fetch_all(slug, "card")
    groups: dict[tuple, list[dict]] = {}
    for row in rows:
        code = (row.get("code") or "").strip()
        if not code:
            continue
        set_id_raw = (row.get("set") or {}).get("_id", "")
        groups.setdefault((set_id_raw, code), []).append(row)

    playable = []  # (card, power_raw, second_raw)
    set_names: dict[str, str] = {}
    raw_cards = []
    for (set_id_raw, code), group in groups.items():
        card = pick_printing(group)
        attrs = card.get("attributes", {})
        sp_id, _sid = species_id_for(slug, prefix, card)
        raw_cards.append({
            "id": sp_id, "code": code, "name": card.get("name"),
            "set_id": (card.get("set") or {}).get("_id"),
            "set_name": (card.get("set") or {}).get("name"),
            "set_code": (card.get("set") or {}).get("code"),
            "rarity_raw": attrs.get("Rarity"), "attributes": attrs,
            "image": (card.get("images") or [{}])[0].get("medium"),
            "price_market": ((card.get("markets") or {}).get("tcgplayer") or {}).get("prices", {}).get("market"),
            "printings": len(group),
        })
        power = None
        for key in POWER_KEYS:
            power = to_int(attrs.get(key))
            if power is not None:
                break
        if power is None or power <= 0:
            continue
        second = None
        for key in SECOND_KEYS:
            second = to_int(attrs.get(key))
            if second is not None:
                break
        playable.append((card, power, second))
        s = card.get("set") or {}
        if slug == "one-piece":
            sid = (s.get("code") or slugify(s.get("name", ""))).lower()
            set_names[sid] = f"{s.get('code', '')} – {s.get('name', '')}".strip(" –")
        else:
            sid = slugify(set_id_raw or s.get("name", ""))
            set_names[sid] = s.get("name", "") or sid

    STAGING.mkdir(parents=True, exist_ok=True)
    (STAGING / f"apitcg-cards-{slug}.json").write_text(
        json.dumps(raw_cards, ensure_ascii=False))
    if not playable:
        return {"game": slug, "products": len(rows), "playable": 0, "unique": len(raw_cards)}

    median_power = statistics.median(p for _, p, _ in playable)
    divisor = 1
    while median_power / divisor > 90 and divisor < 1000:
        divisor *= 10

    sql_lines = []
    for sid, sname in sorted(set_names.items()):
        sql_lines.append(
            f"INSERT INTO game_sets (id, name) VALUES ({sql_str(sid)}, {sql_str(sname)}) "
            "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;")
    # Tai anh song song (chi One Piece): CDN chiu duoc nhieu luong,
    # tai tuan tu tung anh thi ca catalog mat nhieu gio.
    if slug == "one-piece" and download_images:
        from concurrent.futures import ThreadPoolExecutor
        def _dl(card):
            sp_id = card["code"].strip().lower()
            local = IMG_DIR / f"{sp_id}.jpg"
            if local.exists():
                return 0
            url = (card.get("images") or [{}])[0].get("medium", "")
            if not url:
                return 0
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "PuniTCG/1.0"})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    local.write_bytes(resp.read())
                return 1
            except Exception:
                return -1
        with ThreadPoolExecutor(max_workers=16) as ex:
            results = list(ex.map(_dl, [c for c, _, _ in playable]))
        img_ok = sum(1 for r in results if r == 1)
        img_fail = sum(1 for r in results if r == -1)
    else:
        img_ok = img_fail = 0
    best_lines: dict[str, tuple] = {}
    line_order: list[str] = []
    for card, power, second in playable:
        attrs = card.get("attributes", {})
        s = card.get("set") or {}
        code = card["code"].strip()
        if slug == "one-piece":
            species_id = code.lower()
            set_id = (s.get("code") or "").lower()
        else:
            set_id = slugify(s.get("_id", "") or s.get("name", ""))
            species_id = slugify(f"{prefix}-{(s.get('code') or set_id)}-{code}")
        atk = max(1, round(power / divisor))
        hp = max(10, round(second * 10 / divisor)) if second else max(10, atk * 10)
        types = str(attrs.get("Color") or attrs.get("InkType") or attrs.get("Attribute") or attrs.get("Card Type") or "")
        rarity = map_rarity(slug, str(attrs.get("Rarity", "")))
        description = clean_text(attrs.get("Description") or attrs.get("OracleText"))[:300]
        name = re.sub(r"\s\(\d+\)$", "", card["name"]).strip()
        img_url = (card.get("images") or [{}])[0].get("medium", "")
        sprite = img_url
        if slug == "one-piece" and download_images:
            sprite = f"/op/{species_id}.jpg"
        price = ((card.get("markets") or {}).get("tcgplayer") or {}).get("prices", {}).get("market")
        price_sql = f"{float(price):.2f}" if isinstance(price, (int, float)) and price > 0 else "NULL"
        line = (
            "INSERT INTO game_species (id, name, types, rarity, base_hp, base_atk, base_def, base_spd, description, sprite_url, member_exclusive, enabled, set_id, price_usd) VALUES ("
            f"{sql_str(species_id)}, {sql_str(name)}, {sql_str(types)}, {sql_str(rarity)}, "
            f"{hp}, {atk}, {max(0, round((second or 0) / divisor)) if second else 0}, 50, "
            f"{sql_str(description)}, {sql_str(sprite)}, FALSE, FALSE, {sql_str(set_id)}, {price_sql}) "
            "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, types = EXCLUDED.types, rarity = EXCLUDED.rarity, "
            "base_hp = EXCLUDED.base_hp, base_atk = EXCLUDED.base_atk, description = EXCLUDED.description, "
            "sprite_url = EXCLUDED.sprite_url, set_id = EXCLUDED.set_id, price_usd = EXCLUDED.price_usd;")
        score = species_pick_score(species_id, set_id, name, bool(img_url),
                                   price if isinstance(price, (int, float)) else None)
        if species_id not in best_lines:
            line_order.append(species_id)
            best_lines[species_id] = (score, line)
        elif score < best_lines[species_id][0]:
            best_lines[species_id] = (score, line)
    sql_lines.extend(best_lines[sid][1] for sid in line_order)

    SEED_DIR.mkdir(parents=True, exist_ok=True)
    (SEED_DIR / f"apitcg-{slug}.sql").write_text("\n".join(sql_lines) + "\n")

    sealed = fetch_all(slug, "sealed")
    STAGING.mkdir(parents=True, exist_ok=True)
    (STAGING / f"apitcg-sealed-{slug}.json").write_text(json.dumps([
        {"name": p["name"], "set": (p.get("set") or {}).get("name"),
         "image": (p.get("images") or [{}])[0].get("medium"),
         "price": ((p.get("markets") or {}).get("tcgplayer") or {}).get("prices")}
        for p in sealed], ensure_ascii=False, indent=1))
    return {"game": slug, "products": len(rows), "unique": len(raw_cards),
            "playable": len(playable), "divisor": divisor, "sealed": len(sealed),
            "img_ok": img_ok, "img_fail": img_fail}


def main() -> int:
    args = sys.argv[1:]
    download_images = "--no-images" not in args
    games = list(PREFIX)
    for a in args:
        if a.startswith("--games="):
            games = a.split("=", 1)[1].split(",")
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    for slug in games:
        try:
            result = sync_game(slug, download_images)
        except Exception as e:  # noqa: BLE001
            print(f"[{slug}] LOI: {e}", flush=True)
            continue
        print(f"[{slug}] {result}", flush=True)
    print("DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
