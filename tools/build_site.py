#!/usr/bin/env python3
"""Generate the static site (builder + wiki) from data/game.json and content/.

Usage: python3 tools/build_site.py

Inputs:
  data/game.json         extracted by tools/extract.py (do not edit by hand)
  data/synergies.json    curated synergy descriptions (hand-maintained)
  content/*.html         hand-written page bodies; {{name}} tokens are filled in below

Outputs (committed, served as-is by GitHub Pages):
  index.html, pieces/, synergies/, items/, guide/, assets/js/data.js, assets/js/search-index.js
"""
import datetime
import html
import json
import os
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_NAME = "DAC Builder"
COST_LABEL = {1: "1 gold", 2: "2 gold", 3: "3 gold", 4: "4 gold", 5: "5 gold", 9: "9 gold"}
SOURCE_LABEL = {
    "standard": None,
    "dark": "Undead spare",
    "pandaren": "Pandaren spirit",
    "rare": "Rare shop piece",
    "gold": "Gold Core",
    "ssr": "SSR",
}
SOURCE_NOTE = {
    "dark": "Not in the normal shop. This is one of the “spare” Undead pieces: you mainly get it when a piece holding an Ascetic's Cap is reborn as a random Undead, or through Pandaren fishing.",
    "pandaren": "Not in the shop. One of the Pandaren spirits: the only way to get it is Pandaren fishing, when a Pandaren on your board brings it in at the start of a round.",
    "rare": "Not in the normal pool. It has a 0.2% chance to appear in any shop slot, at any courier level.",
    "gold": "Only obtainable from a Gold Core draw.",
    "ssr": "A super-rare variant. From courier level 7, each shop slot has a 1 in 100 million chance to offer one of the four SSR pieces. It costs 9 gold and arrives as a finished piece: it can't be upgraded and counts as ★★★ (level 9). For synergies it counts as a different piece from the normal version. See Special pieces in the guide.",
}
STAT_ROWS = [
    ("hp", "Health"),
    ("mana", "Mana"),
    ("armor", "Armor"),
    ("magicResist", "Magic resistance"),
    ("damage", "Attack damage"),
    ("attackRate", "Attack interval (s)"),
    ("attackRange", "Attack range"),
    ("moveSpeed", "Move speed"),
]
NAV = [
    ("builder", "Builder", "index.html"),
    ("pieces", "Pieces", "pieces/index.html"),
    ("synergies", "Synergies", "synergies/index.html"),
    ("items", "Items", "items/index.html"),
    ("guide", "Guide", "guide/index.html"),
]


def esc(s):
    return html.escape(str(s), quote=True)


def paragraphs(text):
    """Plain text with \n breaks -> <p> blocks."""
    out = []
    for block in re.split(r"\n\s*\n", text.strip()):
        if block.strip():
            out.append("<p>" + "<br>".join(esc(line) for line in block.split("\n")) + "</p>")
    return "\n".join(out)


def stars(n):
    return "★" * n


class Site:
    def __init__(self):
        self.data = json.load(open(os.path.join(ROOT, "data", "game.json"), encoding="utf-8"))
        curated_path = os.path.join(ROOT, "data", "synergies.json")
        self.curated = {}
        if os.path.exists(curated_path):
            for s in json.load(open(curated_path, encoding="utf-8")):
                self.curated[s["id"]] = s
        self.pieces = self.data["pieces"]
        self.piece_by_id = {p["id"]: p for p in self.pieces}
        self.synergies = [self.merge_synergy(s) for s in self.data["synergies"]]
        self.syn_by_id = {s["id"]: s for s in self.synergies}
        self.built = datetime.date.today().isoformat()
        self.written = []

    # ------------------------------------------------------------------ helpers
    def merge_synergy(self, s):
        c = self.curated.get(s["id"], {})
        levels = []
        by_req = {lv["required"]: lv for lv in c.get("levels", [])}
        tip_levels = parse_tooltip_levels(s["tooltip"])
        for req in s["thresholds"]:
            cur = by_req.get(req, {})
            levels.append({
                "required": req,
                "text": cur.get("text") or tip_levels.get(req, ""),
                "tooltip": cur.get("tooltip", ""),
                "mismatch": cur.get("mismatch", ""),
            })
        return {
            **s,
            "name": c.get("name") or s["name"],
            "perk": c.get("perk") or s["perk"],
            "innate": c.get("innate", ""),
            "note": c.get("note", ""),
            "summary": c.get("summary", ""),
            "details": c.get("details", []),
            "levels": levels,
        }

    def write(self, rel, content):
        path = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        self.written.append(rel)

    def page(self, rel, title, body, active, description="", scripts=(), body_class=""):
        depth = rel.count("/")
        root = "../" * depth
        nav = "".join(
            f'<a href="{root}{href}"{" class=\"active\"" if key == active else ""}>{label}</a>'
            for key, label, href in NAV
        )
        full_title = f"{title} · {SITE_NAME}" if title != SITE_NAME else f"{SITE_NAME} · Dota Auto Chess team builder and wiki"
        desc = description or "Dota Auto Chess team builder and wiki: pieces, synergies, items and game mechanics."
        script_tags = "".join(f'<script src="{root}{s}"></script>' for s in ("assets/js/search-index.js", "assets/js/site.js", *scripts))
        return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(full_title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="icon" href="{root}assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{root}assets/css/site.css">
</head>
<body class="{body_class}" data-root="{root}">
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="{root}index.html"><img src="{root}assets/img/favicon.svg" alt="" width="26" height="26"><span>DAC Builder</span></a>
    <nav class="mainnav">{nav}</nav>
    <div class="search">
      <input id="site-search" type="search" placeholder="Search pieces, synergies, items…" autocomplete="off" aria-label="Search the wiki">
      <div id="site-search-results" class="search-results" hidden></div>
    </div>
  </div>
</header>
<main class="container">
{body}
</main>
<footer class="footer">
  <div class="container">
    <p>Data extracted from the Dota Auto Chess game files (Steam Workshop build). Last generated {self.built}.
    Fan-made site, not affiliated with Drodo Studio or Valve. Dota 2 art &copy; Valve Corporation.</p>
  </div>
</footer>
{script_tags}
</body>
</html>
"""

    def piece_card(self, p, root, extra_class=""):
        traits = " ".join(p["races"] + p["classes"])
        return (
            f'<a class="piece-card cost-{p["cost"]} {extra_class}" href="{root}pieces/{p["id"]}.html" '
            f'data-name="{esc(p["name"].lower())}" data-cost="{p["cost"]}" data-traits="{esc(traits)}" data-source="{p["source"]}">'
            f'<img src="{root}assets/img/pieces/{p["id"]}.webp" alt="" loading="lazy" width="128" height="72">'
            f'<span class="piece-card-name">{esc(p["name"])}</span>'
            f'<span class="piece-card-meta"><span class="cost-badge cost-{p["cost"]}">{p["cost"]}</span>'
            f'{self.trait_icons(p, root)}</span>'
            f"</a>"
        )

    def trait_icons(self, p, root):
        out = []
        for t in p["races"] + p["classes"]:
            s = self.syn_by_id[t]
            out.append(f'<img class="trait-icon" src="{root}assets/img/synergies/{t}.webp" alt="{esc(s["name"])}" title="{esc(s["name"])}" width="18" height="18">')
        return "".join(out)

    def trait_chip(self, sid, root):
        s = self.syn_by_id[sid]
        return (f'<a class="trait-chip {s["type"]}" href="{root}synergies/{sid}.html">'
                f'<img src="{root}assets/img/synergies/{sid}.webp" alt="" width="20" height="20">{esc(s["name"])}</a>')

    def pieces_with(self, sid):
        return [p for p in self.pieces if sid in p["races"] or sid in p["classes"]]

    # -------------------------------------------------------------------- pages
    def build_builder(self):
        body = read_content("builder.html")
        self.write("index.html", self.page(
            "index.html", SITE_NAME, body, "builder",
            "Plan Dota Auto Chess line-ups: add pieces, see which synergies activate, save and share builds.",
            scripts=("assets/js/data.js", "assets/js/builder.js"), body_class="page-builder"))

    def build_pieces_index(self):
        root = "../"
        groups = []
        for cost in range(1, 6):
            cards = "".join(self.piece_card(p, root) for p in self.pieces if p["cost"] == cost and p["source"] == "standard")
            groups.append(f'<section class="cost-group" data-cost-group="{cost}"><h2 class="cost-heading cost-{cost}">{cost}-cost pieces</h2><div class="piece-grid">{cards}</div></section>')
        special_groups = [
            ("dark", "Undead spare pieces",
             "Never in the shop. You get these mainly when a piece holding an <a href=\"../items/index.html#item_feijiangxiaomao\">Ascetic's Cap</a> is reborn as a random Undead of the same cost and star after a battle."),
            ("pandaren", "Pandaren spirits",
             "Never in the shop. The only way to get them is <a href=\"../guide/special.html#pandaren\">Pandaren fishing</a>: a Pandaren on your board can bring one in at the start of a round."),
            ("ssr", "SSR pieces",
             "Super-rare 9-gold versions of four pieces, with unique skills. From courier level 7, each shop slot has a 1 in 100 million chance to offer one. <a href=\"../guide/special.html#ssr\">More about SSR pieces</a>."),
            ("rare", "Rare shop pieces",
             "Not part of the shared pool, but each shop slot has a 0.2% chance to offer it at any level."),
        ]
        special_html = "".join(
            f'<section class="cost-group" data-cost-group="{src}"><h2 class="cost-heading">{title}</h2>'
            f'<p class="muted">{text}</p><div class="piece-grid">'
            + "".join(self.piece_card(p, root) for p in self.pieces if p["source"] == src)
            + "</div></section>"
            for src, title, text in special_groups)
        filters = self.filter_bar()
        body = f"""
<div class="page-head">
  <h1>Pieces</h1>
  <p class="lede">All {len(self.pieces)} chess pieces in Dota Auto Chess. Pieces cost 1 to 5 gold; three copies of a piece combine into a ★★ piece, and three ★★ copies into ★★★.</p>
</div>
{filters}
<div id="piece-list">
{''.join(groups)}
{special_html}
<p id="no-results" class="muted" hidden>No pieces match these filters.</p>
</div>
"""
        self.write("pieces/index.html", self.page("pieces/index.html", "Pieces", body, "pieces",
                                                  "Every Dota Auto Chess piece with cost, races, classes and skills."))

    def filter_bar(self):
        races = [s for s in self.synergies if s["type"] == "race"]
        classes = [s for s in self.synergies if s["type"] == "class"]

        def chips(items):
            return "".join(
                f'<button type="button" class="chip" data-filter="trait" data-value="{s["id"]}">'
                f'<img src="../assets/img/synergies/{s["id"]}.webp" alt="" width="16" height="16">{esc(s["name"])}</button>'
                for s in sorted(items, key=lambda s: s["name"]))

        costs = "".join(f'<button type="button" class="chip cost-chip cost-{c}" data-filter="cost" data-value="{c}">{c}</button>' for c in range(1, 6))
        return f"""
<div class="filter-panel" id="piece-filters">
  <div class="filter-row"><input type="search" id="piece-search" placeholder="Filter by name…" aria-label="Filter pieces by name">
    <span class="filter-label">Cost</span>{costs}
    <button type="button" class="link-btn" id="clear-filters">Clear</button></div>
  <div class="filter-row"><span class="filter-label">Race</span>{chips(races)}</div>
  <div class="filter-row"><span class="filter-label">Class</span>{chips(classes)}</div>
</div>"""

    def build_piece_pages(self):
        root = "../"
        for p in self.pieces:
            sk = p["skill"]
            chips = "".join(self.trait_chip(t, root) for t in p["races"] + p["classes"])
            source = SOURCE_LABEL.get(p["source"])
            source_badge = f'<span class="badge">{esc(source)}</span>' if source else ""
            source_note = f'<p class="callout">{esc(SOURCE_NOTE[p["source"]])}</p>' if p["source"] in SOURCE_NOTE else ""
            if p.get("base"):
                b = self.piece_by_id[p["base"]]
                source_note += f'<p class="callout">Normal version: <a href="{b["id"]}.html">{esc(b["name"])}</a> ({b["cost"]} gold).</p>'
            if p["id"] == "rm":
                source_note += '<p class="callout">Ringmaster has no fixed race or class. At the start of every game it is given 3 random classes, which you can see in-game.</p>'
            skill_html = self.skill_block(sk, root, ssr=p["source"] == "ssr") if sk else ""
            stats_html = self.stats_table(p)
            syn_html = []
            for t in p["races"] + p["classes"]:
                s = self.syn_by_id[t]
                others = [o for o in self.pieces_with(t) if o["id"] != p["id"]]
                levels = "".join(f'<li><span class="req">({lv["required"]})</span> {esc(lv["text"])}</li>' for lv in s["levels"])
                mini = "".join(
                    f'<a class="mini-piece cost-{o["cost"]}" href="{o["id"]}.html" title="{esc(o["name"])}"><img src="{root}assets/img/pieces/{o["id"]}.webp" alt="{esc(o["name"])}" loading="lazy" width="64" height="36"></a>'
                    for o in others)
                syn_html.append(f"""
<section class="panel syn-summary">
  <h3><img src="{root}assets/img/synergies/{t}.webp" alt="" width="28" height="28"><a href="{root}synergies/{t}.html">{esc(s["name"])}</a> <span class="muted">· {esc(s["perk"])}</span></h3>
  {f'<p class="innate">{esc(s["innate"])}</p>' if s["innate"] else ''}
  <ul class="level-list">{levels}</ul>
  <div class="mini-piece-row">{mini}</div>
</section>""")
            body = f"""
<nav class="crumbs"><a href="index.html">Pieces</a> / {esc(p["name"])}</nav>
<div class="piece-hero cost-{p["cost"]}">
  <img class="piece-portrait" src="{root}assets/img/pieces/tall/{p["id"]}.webp" alt="{esc(p["name"])}" width="142" height="188">
  <div>
    <h1>{esc(p["name"])}</h1>
    <p class="piece-tags"><span class="cost-badge cost-{p["cost"]} big">{p["cost"]}</span> {COST_LABEL[p["cost"]]} · {"Melee" if p["melee"] else "Ranged"} {source_badge}</p>
    <div class="chip-row">{chips}</div>
    <p><a class="btn" href="{root}index.html#b={p['id']}">Open in builder</a></p>
  </div>
</div>
{source_note}
<div class="two-col">
  <div>
    {skill_html}
    <section class="panel"><h2>Stats</h2>{stats_html}</section>
  </div>
  <div>{''.join(syn_html)}</div>
</div>
"""
            desc = f"{p['name']} in Dota Auto Chess: {p['cost']}-cost " + ", ".join(self.syn_by_id[t]["name"] for t in p["races"] + p["classes"]) + f". Skill: {sk['name'] if sk else ''}."
            self.write(f"pieces/{p['id']}.html", self.page(f"pieces/{p['id']}.html", p["name"], body, "pieces", desc))

    def skill_block(self, sk, root, ssr=False):
        rows = []
        for r in sk["values"]:
            vals = r["values"]
            if len(vals) == 1:
                cells = f'<td colspan="3">{esc(vals[0])}</td>'
            else:
                vals = (vals + [vals[-1]] * 3)[:3]
                cells = "".join(f"<td>{esc(v)}</td>" for v in vals)
            rows.append(f"<tr><th>{esc(r['label'])}</th>{cells}</tr>")
        for label, key in (("Cooldown (s)", "cooldown"), ("Mana cost", "mana")):
            vals = sk.get(key) or []
            if vals and any(v != "0" for v in vals):
                if len(vals) == 1:
                    rows.append(f'<tr><th>{label}</th><td colspan="3">{esc(vals[0])}</td></tr>')
                else:
                    vals = (vals + [vals[-1]] * 3)[:3]
                    rows.append(f"<tr><th>{label}</th>" + "".join(f"<td>{esc(v)}</td>" for v in vals) + "</tr>")
        table = ""
        if rows:
            head = "<th></th><th>SSR</th>" if ssr else "<th></th><th>★</th><th>★★</th><th>★★★</th>"
            body = "".join(rows)
            if ssr:
                body = body.replace(' colspan="3"', "")
            table = f'<table class="data-table"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>'
        notes = "".join(f"<li>{esc(n)}</li>" for n in sk["notes"])
        kind = "Passive" if sk["kind"] == "passive" else "Active"
        header = esc(sk["header"]) if sk["header"] else kind
        return f"""
<section class="panel skill">
  <div class="skill-head">
    <img src="{root}assets/img/skills/{sk["id"]}.webp" alt="" width="56" height="56">
    <div><h2>{esc(sk["name"])}</h2><p class="muted">{header}</p></div>
  </div>
  {paragraphs(sk["description"])}
  {table}
  {f'<ul class="notes">{notes}</ul>' if notes else ''}
  {f'<p class="lore">{esc(sk["lore"])}</p>' if sk["lore"] else ''}
</section>"""

    def stats_table(self, p):
        rows = []
        for key, label in STAT_ROWS:
            cells = []
            for st in p["stats"]:
                if not st:
                    cells.append("<td>–</td>")
                elif key == "damage":
                    cells.append(f"<td>{st['damageMin']}–{st['damageMax']}</td>")
                elif key == "magicResist":
                    cells.append(f"<td>{st[key]}%</td>")
                else:
                    cells.append(f"<td>{st[key]}</td>")
            rows.append(f"<tr><th>{label}</th>{''.join(cells)}</tr>")
        head = "<th></th><th>SSR</th>" if len(p["stats"]) == 1 else "<th></th><th>★</th><th>★★</th><th>★★★</th>"
        return f'<table class="data-table"><thead><tr>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table>'

    def synergy_levels_html(self, s, show_tooltip=True):
        items = []
        for lv in s["levels"]:
            mismatch = ""
            if show_tooltip and lv["mismatch"]:
                mismatch = f'<p class="mismatch"><strong>Note:</strong> {esc(lv["mismatch"])}</p>'
            items.append(f'<li><span class="req-pill">{lv["required"]}</span><div><p>{esc(lv["text"])}</p>{mismatch}</div></li>')
        return f'<ol class="levels">{"".join(items)}</ol>'

    def details_html(self, s):
        out = []
        for d in s.get("details", []):
            groups = "".join(
                f'<h3>{esc(g["heading"])}</h3><ul>{"".join(f"<li>{esc(i)}</li>" for i in g["items"])}</ul>'
                for g in d.get("groups", []))
            intro = f'<p>{esc(d["intro"])}</p>' if d.get("intro") else ""
            out.append(f'<section class="panel details"><h2>{esc(d["title"])}</h2>{intro}{groups}</section>')
        return "".join(out)

    def build_synergies_index(self):
        root = "../"

        def card(s):
            pieces = self.pieces_with(s["id"])
            pips = " / ".join(str(lv["required"]) for lv in s["levels"])
            mini = "".join(
                f'<img class="mini-portrait cost-{p["cost"]}" src="{root}assets/img/pieces/{p["id"]}.webp" alt="{esc(p["name"])}" title="{esc(p["name"])}" loading="lazy" width="48" height="27">'
                for p in pieces)
            return f"""<a class="syn-card" href="{s["id"]}.html">
  <div class="syn-card-head"><img src="{root}assets/img/synergies/{s["id"]}.webp" alt="" width="40" height="40">
    <div><strong>{esc(s["name"])}</strong><span class="muted">{esc(s["perk"])}</span></div>
    <span class="syn-req">{pips}</span></div>
  <p>{esc(s["summary"] or (s["levels"][0]["text"] if s["levels"] else ""))}</p>
  <div class="mini-portrait-row">{mini}</div>
</a>"""

        races = "".join(card(s) for s in sorted(self.synergies, key=lambda s: s["name"]) if s["type"] == "race")
        classes = "".join(card(s) for s in sorted(self.synergies, key=lambda s: s["name"]) if s["type"] == "class")
        body = f"""
<div class="page-head">
  <h1>Synergies</h1>
  <p class="lede">Almost every piece has a race (species) and a class. Field enough <em>different</em> pieces that share a race or class and you unlock that synergy's bonuses. Bonuses stack: reaching the second level keeps the first.</p>
</div>
<section class="panel rules">
  <h2>How synergies are counted</h2>
  <ul>
    <li>Only pieces <strong>on the board</strong> count. Pieces on the bench don't.</li>
    <li>Each <strong>different</strong> piece counts once. Two copies of Axe count as one Orc and one Warrior, whatever their stars.</li>
    <li>Synergies are worked out again at the start of every battle.</li>
    <li>2 <a href="wizard.html">Wizards</a> lower the requirement of high synergy levels (4 or more) by one, once you already have 3 pieces of that synergy.</li>
    <li><a href="demon.html">Demon</a> only works with a single type of Demon on the board, unless you have 2 Demon Hunters.</li>
    <li><a href="nraqi.html">Faceless</a> only works when it is your only active synergy.</li>
  </ul>
</section>
<h2 class="section-title">Races</h2>
<div class="syn-grid">{races}</div>
<h2 class="section-title">Classes</h2>
<div class="syn-grid">{classes}</div>
"""
        self.write("synergies/index.html", self.page("synergies/index.html", "Synergies", body, "synergies",
                                                     "All Dota Auto Chess races and classes, what each level does and which pieces have them."))

    def build_synergy_pages(self):
        root = "../"
        for s in self.synergies:
            pieces = self.pieces_with(s["id"])
            by_cost = []
            for cost in range(1, 6):
                group = [p for p in pieces if p["cost"] == cost]
                if group:
                    by_cost.append("".join(self.piece_card(p, root) for p in group))
            # Common partner synergies among this synergy's pieces.
            partners = {}
            for p in pieces:
                for t in p["races"] + p["classes"]:
                    if t != s["id"]:
                        partners[t] = partners.get(t, 0) + 1
            partner_html = "".join(
                f'{self.trait_chip(t, root).replace("</a>", f" <span class=\"count\">{n}</span></a>")}'
                for t, n in sorted(partners.items(), key=lambda kv: (-kv[1], self.syn_by_id[kv[0]]["name"]))[:10])
            tooltip_html = ""
            if any(lv["mismatch"] for lv in s["levels"]):
                tooltip_html = f'<details class="panel"><summary>Official in-game tooltip</summary>{paragraphs(s["tooltip"])}</details>'
            body = f"""
<nav class="crumbs"><a href="index.html">Synergies</a> / {esc(s["name"])}</nav>
<div class="syn-hero">
  <img src="{root}assets/img/synergies/{s["id"]}.webp" alt="" width="72" height="72">
  <div>
    <p class="eyebrow">{"Race" if s["type"] == "race" else "Class"}</p>
    <h1>{esc(s["name"])}</h1>
    <p class="muted">{esc(s["perk"])} · levels at {" / ".join(str(t) for t in s["thresholds"])} different pieces</p>
  </div>
</div>
<div class="two-col">
  <div>
    <section class="panel">
      {f'<p class="innate"><strong>Every {esc(s["name"])} piece:</strong> {esc(s["innate"])}</p>' if s["innate"] else ''}
      {f'<p class="callout">{esc(s["note"])}</p>' if s["note"] else ''}
      {self.synergy_levels_html(s)}
    </section>
    {self.details_html(s)}
    {tooltip_html}
    {f'<p class="lore">{esc(s["lore"])}</p>' if s["lore"] else ''}
  </div>
  <div>
    <section class="panel"><h2>Often paired with</h2><p class="muted small">Races and classes that {esc(s["name"])} pieces also have, with how many share each.</p><div class="chip-row">{partner_html}</div></section>
  </div>
</div>
<h2 class="section-title">{esc(s["name"])} pieces ({len(pieces)})</h2>
<div class="piece-grid">{''.join(by_cost)}</div>
"""
            desc = f"{s['name']} {s['type']} synergy in Dota Auto Chess: {s['perk']}. " + " ".join(f"({lv['required']}) {lv['text']}" for lv in s["levels"])
            self.write(f"synergies/{s['id']}.html", self.page(f"synergies/{s['id']}.html", f"{s['name']} ({s['type']})", body, "synergies", desc[:300]))

    def item_card(self, it, root):
        color = it["color"] or "#cccccc"
        notes = "".join(f"<li>{esc(n)}</li>" for n in it["notes"])
        return f"""<article class="item-card" id="{it["id"]}">
  <img src="{root}assets/img/items/{it["id"]}.webp" alt="" width="64" height="47" loading="lazy">
  <div>
    <h3 style="color:{esc(color)}">{esc(it["name"])}</h3>
    {paragraphs(it["description"])}
    {f'<ul class="notes">{notes}</ul>' if notes else ''}
  </div>
</article>"""

    def build_items(self):
        root = "../"
        tiers = []
        for tier in range(1, 6):
            items = [i for i in self.data["items"] if i["tier"] == tier]
            tiers.append(f'<section><h2 class="section-title">Tier {tier} <span class="muted">({len(items)})</span></h2><div class="item-grid">{"".join(self.item_card(i, root) for i in items)}</div></section>')
        intro = read_content("items_intro.html", default="")
        body = f"""
<div class="page-head">
  <h1>Items</h1>
  <p class="lede">Items come from creep rounds and loot boxes, and sit in your courier's inventory until you give them to a piece. Higher tiers are stronger and drop from tougher creeps.</p>
  <p><a href="relics.html">Relics &amp; talents →</a></p>
</div>
{intro}
{''.join(tiers)}
"""
        self.write("items/index.html", self.page("items/index.html", "Items", body, "items",
                                                 "All Dota Auto Chess items by tier with their effects."))

        relics = "".join(self.item_card(r, root) for r in self.data["relics"])
        talents = "".join(
            f'<article class="item-card"><div><h3>{esc(t["name"])} <span class="muted small">({esc(t["slot"])})</span></h3><p>{esc(t["description"])}</p></div></article>'
            for t in self.data["talents"])
        relic_intro = read_content("relics_intro.html", default="")
        body = f"""
<div class="page-head">
  <h1>Relics &amp; talents</h1>
</div>
{relic_intro}
<h2 class="section-title">Relics</h2>
<div class="item-grid">{relics}</div>
<h2 class="section-title">Talents</h2>
<div class="item-grid">{talents}</div>
"""
        self.write("items/relics.html", self.page("items/relics.html", "Relics & talents", body, "items",
                                                  "Dota Auto Chess relics from relic boxes and the talent choices."))

    def build_guide(self):
        guide_dir = os.path.join(ROOT, "content", "guide")
        if not os.path.isdir(guide_dir):
            return
        pages = json.load(open(os.path.join(guide_dir, "pages.json"), encoding="utf-8"))
        tokens = self.guide_tokens()
        for i, pg in enumerate(pages):
            rel = f"guide/{pg['file']}"
            src = open(os.path.join(guide_dir, pg["file"]), encoding="utf-8").read()
            src = re.sub(r"\{\{(\w+)\}\}", lambda m: tokens[m.group(1)](), src)
            side = "".join(
                f'<a href="{p["file"]}"{" class=\"active\"" if p["file"] == pg["file"] else ""}>{esc(p["title"])}</a>'
                for p in pages)
            prev_next = ""
            if i > 0:
                prev_next += f'<a class="prev" href="{pages[i-1]["file"]}">← {esc(pages[i-1]["title"])}</a>'
            if i < len(pages) - 1:
                prev_next += f'<a class="next" href="{pages[i+1]["file"]}">{esc(pages[i+1]["title"])} →</a>'
            body = f"""
<div class="guide-layout">
  <aside class="guide-nav"><p class="eyebrow">Guide</p>{side}</aside>
  <article class="guide-body prose">
    {src}
    <nav class="prev-next">{prev_next}</nav>
  </article>
</div>"""
            self.write(rel, self.page(rel, pg["title"], body, "guide", pg.get("description", "")))

    def guide_tokens(self):
        m = self.data["mechanics"]

        def shop_odds():
            rows = []
            prev = None
            for level, pct in sorted(m["shopOdds"].items(), key=lambda kv: int(kv[0])):
                if pct == prev:
                    continue
                prev = pct
                cells = "".join(f'<td class="{"zero" if v == 0 else ""}">{v}%</td>' for v in pct)
                rows.append(f"<tr><th>{level}</th>{cells}</tr>")
            head = "".join(f'<th class="cost-text-{c}">{c} gold</th>' for c in range(1, 6))
            return f'<table class="data-table odds"><thead><tr><th>Level</th>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table>'

        def xp_table():
            rows = []
            xp = {int(k): v for k, v in m["xpTable"].items()}
            for lvl in sorted(xp):
                if lvl == 1:
                    continue
                need = xp[lvl] - xp[lvl - 1]
                rows.append(f"<tr><th>{lvl - 1} → {lvl}</th><td>{need}</td><td>{xp[lvl]}</td></tr>")
            return f'<table class="data-table"><thead><tr><th>Level up</th><th>XP needed</th><th>Total XP</th></tr></thead><tbody>{"".join(rows)}</tbody></table>'

        def pool_table():
            size = m["poolSize"]
            counts = {int(k): v for k, v in m["chessInitCount"].items()}
            rows = []
            for cost in range(1, 6):
                n = sum(1 for p in self.pieces if p["cost"] == cost and p["source"] == "standard")
                rows.append(f'<tr><th class="cost-text-{cost}">{cost} gold</th><td>{n}</td><td>{counts[cost] * size}</td></tr>')
            return f'<table class="data-table"><thead><tr><th>Cost</th><th>Different pieces</th><th>Copies of each (default)</th></tr></thead><tbody>{"".join(rows)}</tbody></table>'

        def lootbox_table():
            names = {"item_lootbox_lv1": "Loot box (level 1)", "item_lootbox_lv2": "Loot box (level 2)",
                     "item_lootbox_lv3": "Loot box (level 3)", "item_lootbox_lv4": "Loot box (level 4)",
                     "item_relicbox": "Relic box"}
            rows = "".join(f"<tr><th>Round {r}</th><td>{names.get(b, b)}</td></tr>"
                           for r, b in sorted(m["lootboxSchedule"].items(), key=lambda kv: int(kv[0])))
            return f'<table class="data-table"><thead><tr><th>Round</th><th>Reward</th></tr></thead><tbody>{rows}</tbody></table>'

        def pieces_from(source):
            out = [self.piece_card(p, "../") for p in self.pieces if p["source"] == source]
            return f'<div class="piece-grid">{"".join(out)}</div>'

        def legendary_pieces():
            out = [self.piece_card(p, "../") for p in self.pieces if p["cost"] == 5 and p["source"] == "standard"]
            return f'<div class="piece-grid">{"".join(out)}</div>'

        def by_cost_and_star(fn, caption):
            # A piece's level is its cost +2 per extra star, capped at 9 (GetLevel in the game code).
            rows = []
            for cost in range(1, 6):
                cells = "".join(f"<td>{fn(min(9, cost + 2 * (star - 1)))}</td>" for star in (1, 2, 3))
                rows.append(f'<tr><th class="cost-text-{cost}">{cost}-cost</th>{cells}</tr>')
            return (f'<table class="data-table"><thead><tr><th>{caption}</th><th>★</th><th>★★</th><th>★★★</th></tr></thead>'
                    f'<tbody>{"".join(rows)}</tbody></table>')

        return {
            "damage_table": lambda: by_cost_and_star(lambda lvl: 1 + lvl // 3, "Damage"),
            "sell_table": lambda: by_cost_and_star(lambda lvl: lvl, "Sells for"),
            "shop_odds_table": shop_odds,
            "xp_table": xp_table,
            "pool_table": pool_table,
            "lootbox_table": lootbox_table,
            "undead_pieces": lambda: pieces_from("dark"),
            "pandaren_pieces": lambda: pieces_from("pandaren"),
            "ssr_pieces": lambda: pieces_from("ssr"),
            "legendary_pieces": legendary_pieces,
            "piece_count": lambda: str(len([p for p in self.pieces if p["source"] == "standard"])),
        }

    # --------------------------------------------------------------------- data
    def build_data_js(self):
        pieces = [{
            "id": p["id"], "name": p["name"], "cost": p["cost"], "source": p["source"],
            "races": p["races"], "classes": p["classes"], "melee": p["melee"],
            "skill": p["skill"]["name"] if p["skill"] else "",
        } for p in self.pieces]
        synergies = [{
            "id": s["id"], "name": s["name"], "type": s["type"], "perk": s["perk"],
            "innate": s["innate"], "note": s["note"],
            "levels": [{"required": lv["required"], "text": lv["text"]} for lv in s["levels"]],
        } for s in self.synergies]
        payload = json.dumps({"pieces": pieces, "synergies": synergies}, ensure_ascii=False, separators=(",", ":"))
        self.write("assets/js/data.js", f"// Generated by tools/build_site.py. Do not edit.\nwindow.DAC_DATA = {payload};\n")

        index = []
        for p in self.pieces:
            index.append({"t": p["name"], "k": "Piece", "u": f"pieces/{p['id']}.html", "i": f"assets/img/pieces/{p['id']}.webp"})
        for s in self.synergies:
            index.append({"t": s["name"], "k": s["type"].title(), "u": f"synergies/{s['id']}.html", "i": f"assets/img/synergies/{s['id']}.webp"})
        for it in self.data["items"]:
            index.append({"t": it["name"], "k": f"Item T{it['tier']}", "u": f"items/index.html#{it['id']}", "i": f"assets/img/items/{it['id']}.webp"})
        for it in self.data["relics"]:
            index.append({"t": it["name"], "k": "Relic", "u": f"items/relics.html#{it['id']}", "i": f"assets/img/items/{it['id']}.webp"})
        guide_dir = os.path.join(ROOT, "content", "guide")
        if os.path.isdir(guide_dir):
            for pg in json.load(open(os.path.join(guide_dir, "pages.json"), encoding="utf-8")):
                index.append({"t": pg["title"], "k": "Guide", "u": f"guide/{pg['file']}", "i": ""})
        payload = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
        self.write("assets/js/search-index.js", f"// Generated by tools/build_site.py. Do not edit.\nwindow.DAC_SEARCH = {payload};\n")

    def build_sitemap(self):
        urls = [r for r in self.written if r.endswith(".html")]
        body = "".join(f"<url><loc>https://dac-builder.com/{u.replace('index.html', '')}</loc></url>" for u in sorted(urls))
        self.write("sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>\n')

    def build(self):
        for d in ("pieces", "synergies", "items", "guide"):
            shutil.rmtree(os.path.join(ROOT, d), ignore_errors=True)
        self.build_data_js()
        self.build_builder()
        self.build_pieces_index()
        self.build_piece_pages()
        self.build_synergies_index()
        self.build_synergy_pages()
        self.build_items()
        self.build_guide()
        self.build_sitemap()
        print(f"wrote {len(self.written)} files")


def parse_tooltip_levels(tooltip):
    out = {}
    for m in re.finditer(r"\((\d+)\)\s*([^\n]+)", tooltip):
        req = int(m.group(1))
        text = re.sub(r"^[A-Za-z' ]+?:\s*", "", m.group(2).strip())
        out.setdefault(req, text)
    return out


def read_content(name, default=None):
    path = os.path.join(ROOT, "content", name)
    if not os.path.exists(path):
        if default is not None:
            return default
        raise FileNotFoundError(path)
    return open(path, encoding="utf-8").read()


if __name__ == "__main__":
    Site().build()
