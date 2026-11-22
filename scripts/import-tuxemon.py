#!/usr/bin/env python3
"""
Import Tuxemon monsters into Puni's game_species table (spec 6.17).

Source data: the Tuxemon project (https://github.com/Tuxemon/Tuxemon),
code GPLv3, monster art/data CC-BY-SA. The generated species seed and
the cropped sprites MUST keep the Tuxemon credit (see the credits
note in the Admin → Pet page and the public site).

Usage:
    python3 scripts/import-tuxemon.py <tuxemon-checkout> \
        --sql db/seeds/tuxemon-species.sql \
        --img-dir dashboard/public/pets

What it does:
  * Reads mods/tuxemon/db/monster/*.yaml (411 monsters) and
    mods/tuxemon/db/shape/shapes.yaml (base stats per shape).
  * Maps stats: hp x10; atk = max(melee, ranged) x10; def = armour
    x10; spd = speed x10; evolution stage adds +10 (stage1) / +20
    (stage2) to every stat.
  * Rarity: catch_rate <= 5 -> Legendary; stage2 -> Epic; stage1 ->
    Rare; standalone (no evolution) -> Uncommon (Rare when its catch
    rate is low); basic -> Common. (Mythical/Fabled stay owner-picked
    in the Admin.)
  * Sprites: crops the front sprite out of each battle sheet
    (mods/tuxemon/gfx/sprites/battle/<slug>-sheet.png, top-left
    quadrant, alpha bounding box) into <slug>.png; species rows point
    at /pets/<slug>.png. Monsters without a sheet get an empty URL.
  * Writes an idempotent SQL seed (INSERT ... ON CONFLICT DO UPDATE).
"""
import argparse
import os
import sys

import yaml
from PIL import Image

TYPE_VI = {
    "normal": "Thường",
    "fire": "Lửa",
    "water": "Nước",
    "earth": "Đất",
    "wood": "Cây",
    "metal": "Kim loại",
    "aether": "Aether",
    "ice": "Băng",
    "electric": "Điện",
    "lightning": "Sét",
    "poison": "Độc",
    "shadow": "Bóng tối",
    "light": "Ánh sáng",
    "cosmic": "Vũ trụ",
    "ghost": "Ma",
    "dragon": "Rồng",
    "flying": "Bay",
    "bug": "Côn trùng",
    "rock": "Đá",
    "ground": "Đất",
}

TERRAIN_VI = {
    "mountains": "núi",
    "urban": "đô thị",
    "forest": "rừng",
    "grassland": "đồng cỏ",
    "desert": "sa mạc",
    "ocean": "đại dương",
    "river": "sông",
    "cave": "hang động",
    "snow": "tuyết",
    "swamp": "đầm lầy",
    "volcano": "núi lửa",
    "beach": "bãi biển",
    "jungle": "rừng rậm",
    "ruins": "tàn tích",
    "sky": "bầu trời",
}


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def crop_front_sprite(sheet_path: str, out_path: str) -> bool:
    try:
        sheet = Image.open(sheet_path).convert("RGBA")
    except Exception:
        return False
    # Front sprite lives in the top-left quadrant (faces sit below).
    region = sheet.crop((0, 0, 64, 57))
    bbox = region.getbbox()
    if not bbox:
        return False
    sprite = region.crop(bbox)
    sprite.save(out_path)
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("tuxemon_dir")
    ap.add_argument("--sql", default="db/seeds/tuxemon-species.sql")
    ap.add_argument("--img-dir", default="dashboard/public/pets")
    args = ap.parse_args()

    monster_dir = os.path.join(args.tuxemon_dir, "mods/tuxemon/db/monster")
    shapes_file = os.path.join(args.tuxemon_dir, "mods/tuxemon/db/shape/shapes.yaml")
    battle_dir = os.path.join(args.tuxemon_dir, "mods/tuxemon/gfx/sprites/battle")

    with open(shapes_file, encoding="utf-8") as fh:
        shapes = {s["slug"]: s["attributes"] for s in yaml.safe_load(fh)}

    os.makedirs(args.img_dir, exist_ok=True)
    os.makedirs(os.path.dirname(args.sql), exist_ok=True)

    rows = []
    counts = {}
    with_sprite = 0
    files = sorted(f for f in os.listdir(monster_dir) if f.endswith(".yaml"))
    monsters = []
    for fname in files:
        with open(os.path.join(monster_dir, fname), encoding="utf-8") as fh:
            monsters.append(yaml.safe_load(fh))
    monsters.sort(key=lambda m: m.get("txmn_id", 9999))

    for m in monsters:
        slug = m["slug"]
        shape = shapes.get(m.get("shape", ""), None)
        if shape is None:
            continue
        stage = m.get("stage", "basic")
        stage_bonus = {"basic": 0, "standalone": 5, "stage1": 10, "stage2": 20}.get(stage, 0)
        hp = shape["hp"] * 10 + stage_bonus
        atk = max(shape["melee"], shape["ranged"]) * 10 + stage_bonus
        dfn = shape["armour"] * 10 + stage_bonus
        spd = shape["speed"] * 10 + stage_bonus
        catch = float(m.get("catch_rate", 100) or 100)
        if catch <= 5:
            rarity = "Legendary"
        elif stage == "stage2":
            rarity = "Epic"
        elif stage == "stage1":
            rarity = "Rare"
        elif stage == "standalone":
            rarity = "Uncommon" if catch >= 100 else "Rare"
        else:
            rarity = "Common"
        counts[rarity] = counts.get(rarity, 0) + 1

        types = ", ".join(TYPE_VI.get(t, t.title()) for t in (m.get("types") or []))
        terrains = ", ".join(
            TERRAIN_VI.get(t, t) for t in (m.get("terrains") or [])[:3]
        )
        desc_parts = [f"Dạng {m.get('shape', '')}"]
        if terrains:
            desc_parts.append(f"sống ở {terrains}")
        desc_parts.append("dữ liệu loài từ Tuxemon (CC-BY-SA)")
        description = " · ".join(desc_parts)

        sheet = os.path.join(battle_dir, f"{slug}-sheet.png")
        sprite_url = ""
        if os.path.exists(sheet) and crop_front_sprite(
            sheet, os.path.join(args.img_dir, f"{slug}.png")
        ):
            sprite_url = f"/pets/{slug}.png"
            with_sprite += 1

        name = slug.replace("_", " ").title().replace(" ", "")
        if "_" in slug:
            name = " ".join(part.title() for part in slug.split("_"))
        rows.append(
            "  (" + ", ".join([
                sql_str(slug),
                sql_str(name),
                sql_str(types),
                sql_str(rarity),
                str(hp), str(atk), str(dfn), str(spd),
                sql_str(description),
                sql_str(sprite_url),
                "false",
                "true",
            ]) + ")"
        )

    with open(args.sql, "w", encoding="utf-8") as fh:
        fh.write("-- Tuxemon species seed — generated by scripts/import-tuxemon.py\n")
        fh.write("-- Source: Tuxemon project, monster data/art CC-BY-SA. Keep the credit.\n")
        fh.write(
            "INSERT INTO game_species (id, name, types, rarity, base_hp, base_atk, base_def, base_spd, description, sprite_url, member_exclusive, enabled)\nVALUES\n"
        )
        fh.write(",\n".join(rows))
        fh.write(
            "\nON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, types=EXCLUDED.types, "
            "rarity=EXCLUDED.rarity, base_hp=EXCLUDED.base_hp, base_atk=EXCLUDED.base_atk, "
            "base_def=EXCLUDED.base_def, base_spd=EXCLUDED.base_spd, "
            "description=EXCLUDED.description, sprite_url=EXCLUDED.sprite_url, updated_at=now();\n"
        )
    print(f"species: {len(rows)}  with sprite: {with_sprite}")
    print("rarity counts:", counts)
    return 0


if __name__ == "__main__":
    sys.exit(main())
