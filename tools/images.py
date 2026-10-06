#!/usr/bin/env python3
"""Copy piece portraits, skill icons and item icons into assets/img/.

Images come from Valve VPKs and need converting first with Source2Viewer-CLI
(https://github.com/ValveResourceFormat/ValveResourceFormat):

  D=~/Games/steamapps/common/"dota 2 beta"/game/dota
  for f in panorama/images/heroes/ panorama/images/spellicons/ panorama/images/items/; do
    Source2Viewer-CLI -i "$D/pak01_dir.vpk" -f "$f" -o /tmp/dac/dotaimg -d
  done
  Source2Viewer-CLI -i ~/Games/steamapps/workshop/content/570/1613886175/1613886175.vpk \
    -f panorama/images/ -o /tmp/dac/dacimg -d

Then: python3 tools/images.py [--dota /tmp/dac/dotaimg] [--dac /tmp/dac/dacimg]
"""
import argparse
import json
import os
import re
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import kv  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Pieces whose display name doesn't match a Dota hero name or alias.
HERO_OVERRIDES = {
    "ct": "npc_dota_hero_centaur",
    "sf": "npc_dota_hero_nevermore",
    "tp": "npc_dota_hero_treant",
    "spe": "npc_dota_hero_spectre",
}


def norm(s):
    return re.sub(r"[^a-z]", "", s.lower())


def hero_aliases(localization):
    tokens = kv.load(localization)["lang"]["Tokens"]
    alias = {}
    for k, v in tokens.items():
        m = re.fullmatch(r"(npc_dota_hero_[a-z_]+?)__name_alias", k)
        if m:
            hero = m.group(1)
            alias.setdefault(norm(hero[len("npc_dota_hero_"):]), hero)
            for a in v.split(";"):
                alias.setdefault(norm(a), hero)
    return alias


def copy(src, dst, max_size=None):
    """Convert src PNG to WebP at dst (extension replaced), optionally shrinking it."""
    if not os.path.exists(src):
        return False
    dst = os.path.splitext(dst)[0] + ".webp"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    img = Image.open(src).convert("RGBA")
    if max_size:
        img.thumbnail((max_size, max_size), Image.LANCZOS)
    img.save(dst, "WEBP", quality=82, method=6)
    return True


def texture_candidates(texture, fallback_id, roots):
    """Possible PNG paths for an ability/item texture name."""
    names = [t for t in (texture, fallback_id) if t]
    out = []
    for name in names:
        base = name.replace("item_custom/", "").replace("custom/", "")
        stripped = base[5:] if base.startswith("item_") else base
        for root in roots:
            out += [
                f"{root}/items/{stripped}_png.png",
                f"{root}/items/{base}_png.png",
                f"{root}/items/custom/{base}_png.png",
                f"{root}/items/custom/{stripped}_png.png",
                f"{root}/items/custom/{base}.png",
                f"{root}/spellicons/custom/{base}.png",
                f"{root}/spellicons/{base}_png.png",
                f"{root}/spellicons/custom/{base}_png.png",
            ]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dota", default="/tmp/dac/dotaimg")
    ap.add_argument("--dac", default="/tmp/dac/dacimg")
    ap.add_argument("--localization", default="/tmp/dac/dota/resource/localization/dota_english.txt")
    ap.add_argument("--data", default=os.path.join(ROOT, "data", "game.json"))
    a = ap.parse_args()

    data = json.load(open(a.data, encoding="utf-8"))
    alias = hero_aliases(a.localization)
    dota = os.path.join(a.dota, "panorama/images")
    dac_roots = [os.path.join(a.dac, "panorama/images"), os.path.join(a.dac, "panorama/images/custom_game"),
                 os.path.expanduser("~/dac_lua/resource/flash3/images")]
    out = os.path.join(ROOT, "assets", "img")
    missing = []

    for p in data["pieces"]:
        hero = HERO_OVERRIDES.get(p["id"]) or alias.get(norm(p["name"])) or alias.get(norm(p["id"]))
        if not hero:
            missing.append(f"piece {p['id']}")
            continue
        if not copy(f"{dota}/heroes/{hero}_png.png", f"{out}/pieces/{p['id']}.png"):
            missing.append(f"portrait {p['id']} ({hero})")
        copy(f"{dota}/heroes/selection/{hero}_png.png", f"{out}/pieces/tall/{p['id']}.png")
        skill = p.get("skill")
        if skill:
            roots = [dota] + dac_roots
            for src in texture_candidates(skill.get("texture"), skill["id"], roots):
                if copy(src, f"{out}/skills/{skill['id']}.png", 64):
                    break
            else:
                missing.append(f"skill {skill['id']} (texture {skill.get('texture')!r})")

    for it in data["items"] + data["relics"]:
        roots = dac_roots + [dota]
        for src in texture_candidates(it.get("texture"), it["id"], roots):
            if copy(src, f"{out}/items/{it['id']}.png", 64):
                break
        else:
            missing.append(f"item {it['id']} (texture {it.get('texture')!r})")

    for syn in data["synergies"]:
        roots = [dota] + dac_roots
        for src in texture_candidates(syn.get("texture"), None, roots):
            if copy(src, f"{out}/synergies/{syn['id']}.png", 64):
                break
        else:
            missing.append(f"synergy {syn['id']} (texture {syn.get('texture')!r})")

    print(f"images written to {out}")
    if missing:
        print(f"{len(missing)} missing:")
        for m in missing:
            print("  ", m)


if __name__ == "__main__":
    main()
