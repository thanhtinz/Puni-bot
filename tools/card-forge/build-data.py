#!/usr/bin/env python3
"""Build TCG card data + artwork for all Tuxemon species.

Reads species stats/rarity from the bot's seed SQL (single source of
truth, produced by scripts/import-tuxemon.py) and movesets from a
Tuxemon checkout. Emits:
  out/cards-data.json  - Card Forge `Card` objects per species
  out/art/<slug>.png   - 662x414 artwork (element gradient + sprite)
  ../../dashboard/src/data/tcg-cards.json - slim manifest for the web

Usage: python3 build-data.py [tuxemon_checkout] (default /tmp/tuxemon-sparse)
"""
import json, re, sys, pathlib
import yaml
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent.parent
TUX = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/tuxemon-sparse")
SEED = REPO / "db" / "seeds" / "tuxemon-species.sql"
SPRITES = REPO / "dashboard" / "public" / "pets"
OUT = ROOT / "out"
(OUT / "art").mkdir(parents=True, exist_ok=True)

ELEMENT_MAP = {
    "fire": "Fire", "water": "Water", "wood": "Grass", "grass": "Grass",
    "electric": "Lightning", "lightning": "Lightning", "metal": "Metal",
    "dragon": "Dragon", "earth": "Fighting", "rock": "Fighting",
    "ground": "Fighting", "ice": "Water", "shadow": "Darkness",
    "ghost": "Darkness", "poison": "Darkness", "aether": "Psychic",
    "cosmic": "Psychic", "light": "Psychic", "bug": "Grass",
    "flying": "Colorless", "normal": "Colorless",
}
# Art background gradients (top, bottom) per Card Forge element.
PALETTES = {
    "Fire": ((255, 167, 81), (214, 74, 32)), "Water": ((96, 165, 250), (29, 78, 216)),
    "Grass": ((110, 231, 140), (21, 128, 61)), "Lightning": ((253, 224, 71), (217, 119, 6)),
    "Psychic": ((216, 180, 254), (126, 34, 206)), "Fighting": ((252, 186, 140), (154, 52, 18)),
    "Darkness": ((88, 80, 140), (24, 18, 48)), "Metal": ((203, 213, 225), (71, 85, 105)),
    "Fairy": ((249, 168, 212), (190, 24, 93)), "Dragon": ((165, 180, 252), (67, 56, 202)),
    "Colorless": ((229, 220, 200), (146, 130, 100)),
}
WEAKNESS = {
    "Fire": "Water", "Water": "Grass", "Grass": "Fire", "Lightning": "Fighting",
    "Psychic": "Darkness", "Fighting": "Psychic", "Darkness": "Fighting",
    "Metal": "Fire", "Fairy": "Metal", "Dragon": "Dragon", "Colorless": "Fighting",
}
RARITY_MAP = {
    "Common": "Common", "Uncommon": "Uncommon", "Rare": "Rare",
    "Epic": "Holo Rare", "Legendary": "Legendary", "Mythical": "Legendary",
    "Fabled": "Legendary",
}
STAGE_MAP = {"basic": "Basic", "stage1": "Stage 1", "stage2": "Stage 2", "standalone": "Basic"}

# --- species from seed SQL -------------------------------------------------
rows = []
for m in re.finditer(r"\('([a-z0-9_]+)', '((?:[^']|'')*)', '((?:[^']|'')*)', '(\w+)', (\d+), (\d+), (\d+), (\d+), '((?:[^']|'')*)', '([^']*)', (true|false), (true|false)\)", SEED.read_text()):
    rows.append({
        "slug": m.group(1), "name": m.group(2).replace("''", "'"),
        "types_vi": m.group(3), "rarity": m.group(4),
        "hp": int(m.group(5)), "atk": int(m.group(6)),
        "description": m.group(9).replace("''", "'"),
    })
print(f"species parsed: {len(rows)}")

# --- technique powers -------------------------------------------------------
tech_power = {}
for f in (TUX / "mods/tuxemon/db/technique").glob("*.yaml"):
    d = yaml.safe_load(f.read_text())
    if isinstance(d, dict) and "slug" in d:
        tech_power[d["slug"]] = float(d.get("power") or 0)

def art_for(slug: str, element: str) -> str:
    out = OUT / "art" / f"{slug}.png"
    if out.exists():
        return str(out)
    top, bottom = PALETTES[element]
    W, H = 662, 414
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / H
        c = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = c
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W // 2 - 210, 30, W // 2 + 210, 380], fill=(52, 52, 52))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    from PIL import ImageChops
    img = ImageChops.add(img, glow)
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse([W // 2 - 170, H - 92, W // 2 + 170, H - 30], fill=(0, 0, 0, 70))
    sprite_path = SPRITES / f"{slug}.png"
    if sprite_path.exists():
        sp = Image.open(sprite_path).convert("RGBA")
        scale = 330 / sp.height
        sp = sp.resize((round(sp.width * scale), 330), Image.NEAREST)
        img.paste(sp, ((W - sp.width) // 2, H - 58 - sp.height), sp)
    img.save(out)
    return str(out)

cards, manifest = [], []
for i, s in enumerate(rows, start=1):
    mon = yaml.safe_load((TUX / f"mods/tuxemon/db/monster/{s['slug']}.yaml").read_text())
    raw_types = mon.get("types") or ["normal"]
    element = ELEMENT_MAP.get(str(raw_types[0]).lower(), "Colorless")
    stage_raw = (mon.get("history") or [{}])[0].get("stage", "basic")
    moves = sorted(
        (m for m in (mon.get("moveset") or []) if m.get("technique")),
        key=lambda m: tech_power.get(m["technique"], 0), reverse=True,
    )
    picked, seen = [], set()
    for m in moves:
        slug_t = m["technique"]
        if slug_t in seen or (slug_t == "struggle" and len(moves) > 1):
            continue
        seen.add(slug_t)
        picked.append(slug_t)
        if len(picked) == 2:
            break
    attacks = []
    for tslug in picked:
        dmg = max(10, min(180, round(tech_power.get(tslug, 1.0) * 30 / 10) * 10))
        pips = 1 if dmg < 50 else (2 if dmg < 100 else 3)
        cost = [element] + ["Colorless"] * (pips - 1)
        attacks.append({
            "cost": cost,
            "name": tslug.replace("_", " ").title(),
            "damage": str(dmg),
            "text": "",
        })
    if not attacks:
        attacks = [{"cost": [element], "name": "Tackle", "damage": "20", "text": ""}]
    rarity = RARITY_MAP[s["rarity"]]
    holo = s["rarity"] in ("Epic", "Legendary", "Mythical", "Fabled")
    flavor = (s["description"] or "")[:120]
    card = {
        "name": s["name"], "type": element,
        "hp": max(30, round(s["hp"] / 10) * 10),
        "stage": STAGE_MAP.get(stage_raw, "Basic"), "rarity": rarity,
        "subtitle": f"Hệ {s['types_vi']}",
        "art": None, "artZoom": 1, "artX": 0, "artY": 0,
        "attacks": attacks, "abilityName": "", "abilityText": "",
        "flavor": flavor,
        "weakType": WEAKNESS.get(element, "None"), "weakVal": "×2",
        "resType": "None", "resVal": "", "retreat": 2 if s["hp"] > 120 else 1,
        "frameStyle": "Prismatic" if rarity == "Legendary" else ("Nebula" if element in ("Psychic", "Darkness") else "Radiant"),
        "holo": holo, "number": f"{i:03d}/411", "artist": "Tuxemon (CC-BY-SA)",
        "set": "PUNI × TUXEMON",
    }
    hist = mon.get("history") or [{}]
    evo_into = (hist[0].get("evolves_into") or [])
    s["evolves_to"] = evo_into[0] if evo_into else ""
    art_for(s["slug"], element)
    cards.append({"slug": s["slug"], "card": card})
    manifest.append({
        "slug": s["slug"], "name": s["name"], "rarity": s["rarity"],
        "element": element, "hp": card["hp"],
        "types": s["types_vi"], "number": card["number"],
        "evolvesTo": s.get("evolves_to", ""),
    })

evo_lines = ["-- Evolution links for game_species (generated by tools/card-forge/build-data.py)."]
for s in rows:
    if s.get("evolves_to"):
        evo_lines.append(f"UPDATE game_species SET evolves_to = '{s['evolves_to']}' WHERE id = '{s['slug']}';")
(REPO / "db" / "seeds" / "tcg-evolution.sql").write_text("\n".join(evo_lines) + "\n")
(OUT / "cards-data.json").write_text(json.dumps(cards, ensure_ascii=False))
(REPO / "dashboard/src/data/tcg-cards.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
print(f"cards: {len(cards)}  art: {len(list((OUT / 'art').glob('*.png')))}")
