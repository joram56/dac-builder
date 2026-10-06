#!/usr/bin/env python3
"""Extract wiki/builder data from the unpacked Dota Auto Chess game files.

Usage:
  python3 tools/extract.py [--game ~/dac_lua] [--out data/game.json]

The game files are produced by ~/dac_lua/extract_vpk.py. Re-run this after every
game update and review the diff of data/game.json.
"""
import argparse
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import kv  # noqa: E402
import lua_tables  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Attribute rows that describe the skill rather than numbers players care about.
SKIP_VALUE_KEYS = {"AbilityCooldown", "AbilityManaCost"}


def clean_text(text):
    """Turn tooltip markup into plain text with \n line breaks."""
    if not text:
        return ""
    t = text.replace('\\"', '"').replace("\\n", "\n").replace("%%", "%")
    t = re.sub(r"<br\s*/?>", "\n", t, flags=re.I)
    t = re.sub(r"<h1>(.*?)</h1>", r"\n\1\n", t, flags=re.I | re.S)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t)
    t = t.replace("。", ".").replace("，", ", ").replace("：", ": ")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


# Display-name typos in the game's English file (mostly missing apostrophes).
NAME_FIXES = [
    (r"\bPrinces\b", "Prince's"), (r"\bAghanims\b", "Aghanim's"), (r"\bHeavens\b", "Heaven's"),
    (r"\bLinkens\b", "Linken's"), (r"\bShivas\b", "Shiva's"), (r"\bVladimirs\b", "Vladimir's"),
    (r"\bAvianas\b", "Aviana's"), (r"\bGiants Ring\b", "Giant's Ring"), (r"\bAscetics\b", "Ascetic's"),
    (r"\bBerserkers\b", "Berserker's"), (r"\bFiends\b", "Fiend's"), (r"\bGods strength\b", "God's Strength"),
    (r"\bNatures\b", "Nature's"), (r"\bcounts asOgre\b", "counts as Ogre"),
]


def fix_name(text):
    for pattern, repl in NAME_FIXES:
        text = re.sub(pattern, repl, text)
    return text


def font_color(text):
    m = re.search(r'color=\\?"(#[0-9a-fA-F]{6})', text or "")
    return m.group(1).lower() if m else None


def split_values(raw):
    if isinstance(raw, dict):
        raw = raw.get("value", "")
    return [v for v in str(raw).split() if v]


def ability_values(ability):
    """Merge AbilityValues and legacy AbilitySpecial into {name: [per-level values]}."""
    out = {}
    for name, raw in (ability.get("AbilityValues") or {}).items():
        vals = split_values(raw)
        if vals:
            out[name] = vals
    for block in (ability.get("AbilitySpecial") or {}).values():
        if isinstance(block, dict):
            for name, raw in block.items():
                if name in ("var_type", "LinkedSpecialBonus", "CalculateSpellDamageTooltip"):
                    continue
                vals = split_values(raw)
                if vals:
                    out[name] = vals
    return out


def fill_placeholders(text, values):
    def repl(m):
        key = m.group(1)
        vals = values.get(key)
        if not vals:
            return m.group(0)
        uniq = list(dict.fromkeys(vals))
        return "/".join(uniq)

    return re.sub(r"%([A-Za-z_][\w]*)%", repl, text)


class Game:
    def __init__(self, game_dir):
        self.dir = game_dir
        self.lua = open(os.path.join(game_dir, "scripts/vscripts/addon_game_mode.lua"), encoding="utf-8").read()
        self.en = kv.load(os.path.join(game_dir, "resource/addon_english.txt"))["lang"]["Tokens"]
        self.units = kv.load(os.path.join(game_dir, "scripts/npc/npc_units_custom.txt"))["DOTAUnits"]
        self.abilities = kv.load(os.path.join(game_dir, "scripts/npc/npc_abilities_custom.txt"))["DOTAAbilities"]
        self.items = kv.load(os.path.join(game_dir, "scripts/npc/npc_items_custom.txt"))["DOTAAbilities"]

    def table(self, name):
        return lua_tables.find_table(self.lua, name)

    def tip(self, key, default=None):
        return self.en.get(key, default)

    # ---------------------------------------------------------------- synergies
    def synergies(self):
        class_type = self.table("class_type")
        combo = self.table("combo_ability_type")
        result = []
        for code, ability in sorted(class_type.items()):
            sid = ability[3:]  # strip "is_"
            levels = []
            for suffix in ("", "1", "11"):
                entry = combo.get(ability + suffix)
                if entry:
                    levels.append(entry["condition"])
            desc_raw = self.tip(f"DOTA_Tooltip_ability_{ability}_Description", "")
            perk = re.search(r"<h1>(.*?)</h1>", desc_raw, re.I | re.S)
            perk_name = clean_text(perk.group(1)) if perk else ""
            perk_name = re.sub(r"^(species|class)\s+(trait|perk)\s*:\s*", "", perk_name, flags=re.I)
            result.append({
                "id": sid,
                "type": "race" if code < 200 else "class",
                "name": self.tip(f"DOTA_Tooltip_ability_{ability}", sid.title()),
                "perk": perk_name.strip().title() if perk_name.isupper() else perk_name.strip(),
                "thresholds": levels,
                "tooltip": clean_text(desc_raw),
                "lore": clean_text(self.tip(f"DOTA_Tooltip_ability_{ability}_Lore", "")),
                "texture": self.abilities.get(ability, {}).get("AbilityTextureName", ""),
            })
        return result

    # ------------------------------------------------------------------- pieces
    def skill(self, name):
        if not name:
            return None
        ab = self.abilities.get(name, {})
        values = ability_values(ab)
        prefix = f"DOTA_Tooltip_ability_{name}"
        desc_raw = self.tip(prefix + "_Description", "")
        rows = []
        for key, label in self.en.items():
            if not key.startswith(prefix + "_"):
                continue
            vkey = key[len(prefix) + 1:]
            if vkey in ("Description", "Lore") or vkey.startswith("Note") or vkey in SKIP_VALUE_KEYS:
                continue
            vals = values.get(vkey)
            if not vals:
                continue
            rows.append({"label": clean_text(label).rstrip(": ").strip(), "values": vals})
        if not rows:
            # No tooltip labels: fall back to readable value names.
            for vkey, vals in values.items():
                if vkey in SKIP_VALUE_KEYS or re.search(r"scepter|shard|facet|special_bonus|tooltip", vkey, re.I):
                    continue
                if all(v.lstrip("+-") in ("0", "0.0") for v in vals):
                    continue
                label = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", vkey.replace("Ability", "")).replace("_", " ").strip()
                rows.append({"label": label[:1].upper() + label[1:], "values": vals})
        notes = [clean_text(self.en[k]) for k in sorted(self.en) if k.startswith(prefix + "_Note")]
        kind = "active"
        m = re.search(r"<h1>(.*?)</h1>", desc_raw, re.I | re.S)
        header = clean_text(m.group(1)) if m else ""
        if "passive" in header.lower():
            kind = "passive"
        body = clean_text(re.sub(r"<h1>.*?</h1>", "", desc_raw, count=1, flags=re.I | re.S))
        return {
            "id": name,
            "name": fix_name(clean_text(self.tip(prefix, name))),
            "kind": kind,
            "header": header,
            "description": fill_placeholders(body, values),
            "lore": clean_text(self.tip(prefix + "_Lore", "")),
            "notes": [fill_placeholders(n, values) for n in notes],
            "values": rows,
            "cooldown": split_values(ab.get("AbilityCooldown", "")),
            "mana": split_values(ab.get("AbilityManaCost", "")),
            "texture": ab.get("AbilityTextureName", ""),
        }

    def unit_stats(self, uid):
        u = self.units.get(uid)
        if not u:
            return None

        def num(k):
            try:
                v = float(u.get(k, 0))
                return int(v) if v.is_integer() else v
            except ValueError:
                return None

        return {
            "hp": num("StatusHealth"),
            "mana": num("StatusMana"),
            "armor": num("ArmorPhysical"),
            "magicResist": num("MagicalResistance"),
            "damageMin": num("AttackDamageMin"),
            "damageMax": num("AttackDamageMax"),
            "attackRate": num("AttackRate"),
            "attackRange": num("AttackRange"),
            "moveSpeed": num("MovementSpeed"),
        }

    def pieces(self, synergy_ids):
        by_cost = self.table("chess_list_by_mana")
        black = self.table("chess_list_by_mana_black")
        special = self.table("chess_list_by_mana_special")
        gold = self.table("chess_list_by_mana_gold")
        skills = self.table("chess_ability_list_base")
        pool = {}
        for cost, ids in by_cost.items():
            for pid in ids:
                pool[pid] = (cost, "standard")
        for cost, ids in black.items():
            for pid in ids:
                pool.setdefault(pid, (cost, "dark"))
        for cost, ids in special.items():
            for pid in ids:
                pool.setdefault(pid, (cost, "special"))
        for pid in gold:
            pool.setdefault(pid, (5, "gold"))

        pieces = []
        for pid, (cost, source) in pool.items():
            unit = self.units.get(pid)
            if not unit:
                print(f"warning: {pid} missing from npc_units_custom.txt", file=sys.stderr)
                continue
            traits = [unit.get(f"Ability{i}", "") for i in range(1, 9)]
            races, classes = [], []
            for t in traits:
                if t.startswith("is_") and t[3:] in synergy_ids:
                    (races if synergy_ids[t[3:]] == "race" else classes).append(t[3:])
            name = clean_text(self.tip(pid, pid))
            name = re.sub(r"[★☆♥]+$", "", name).strip()
            model = unit.get("Model", "")
            pieces.append({
                "id": pid[6:],
                "name": name,
                "cost": cost,
                "source": source,
                "races": races,
                "classes": classes,
                "melee": "MELEE" in unit.get("AttackCapabilities", ""),
                "model": model,
                "stats": [self.unit_stats(pid), self.unit_stats(pid + "1"), self.unit_stats(pid + "11")],
                "skill": self.skill(skills.get(pid)),
            })
        pieces.sort(key=lambda p: (p["cost"], p["name"]))
        return pieces

    # -------------------------------------------------------------------- items
    def item_entry(self, iid, tier=None, kind="item"):
        it = self.items.get(iid, {})
        prefix = f"DOTA_Tooltip_ability_{iid}"
        raw_name = self.tip(prefix, iid)
        values = ability_values(it)
        notes = [clean_text(self.en[k]) for k in sorted(self.en)
                 if k.startswith(prefix + "_Note") or k.startswith(prefix + "_Description_Note")]
        return {
            "id": iid,
            "name": fix_name(clean_text(raw_name)),
            "color": font_color(raw_name),
            "kind": kind,
            "tier": tier,
            "description": fix_name(fill_placeholders(clean_text(self.tip(prefix + "_Description", "")), values)),
            "lore": clean_text(self.tip(prefix + "_Lore", "")),
            "notes": [fix_name(fill_placeholders(n, values)) for n in notes],
            "texture": it.get("AbilityTextureName", ""),
        }

    def item_list(self):
        out = []
        for tier, ids in self.table("ITEM_LIST_BY_LEVEL").items():
            for iid in ids:
                out.append(self.item_entry(iid, tier))
        return out

    def relics(self):
        return [self.item_entry(iid, kind="relic") for iid in self.table("DROP_RELIC_LIST")]

    def talents(self):
        out = []
        for slot, tid in sorted(self.table("TALENT_TREE").items()):
            short = tid.split("_")[1] if tid.count("_") >= 2 else slot
            out.append({
                "id": tid,
                "slot": slot,
                "name": clean_text(self.tip(f"talent_{short}_title", tid)),
                "description": clean_text(self.tip(f"talent_{short}_description", "")),
            })
        return out

    # ---------------------------------------------------------------- mechanics
    def shop_odds(self):
        """Per courier level, the % chance a shop slot rolls each cost 1-5."""
        out = {}
        for level, thresholds in self.table("chess_gailv").items():
            pct = {c: 0 for c in range(1, 6)}
            # roll r in 1..100; cost = max V with r > K (default 1)
            for r in range(1, 101):
                cost = 1
                for k, v in thresholds.items():
                    if r > k and v > cost:
                        cost = v
                pct[cost] += 1
            out[level] = [pct[c] for c in range(1, 6)]
        return out

    def mechanics(self):
        return {
            "shopOdds": self.shop_odds(),
            "xpTable": self.table("HeroExpTable"),
            "poolSize": pool_size(self.lua),
            "chessInitCount": self.table("CHESS_INIT_COUNT"),
            "lootboxSchedule": self.table("wave_2_lootbox"),
            "creepDropOdds": self.table("drop_item_gailv"),
        }


def pool_size(lua):
    m = re.search(r"_G\.CHESS_POOL_SIZE\s*=\s*(\d+)", lua)
    return int(m.group(1)) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", default=os.path.expanduser("~/dac_lua"))
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "game.json"))
    a = ap.parse_args()

    g = Game(a.game)
    synergies = g.synergies()
    syn_types = {s["id"]: s["type"] for s in synergies}
    data = {
        "synergies": synergies,
        "pieces": g.pieces(syn_types),
        "items": g.item_list(),
        "relics": g.relics(),
        "talents": g.talents(),
        "mechanics": g.mechanics(),
    }
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"wrote {a.out}: {len(data['pieces'])} pieces, {len(synergies)} synergies, "
          f"{len(data['items'])} items, {len(data['relics'])} relics")


if __name__ == "__main__":
    main()
