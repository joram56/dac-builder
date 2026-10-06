# Dota Auto Chess Builder & Wiki

Static site with a team builder and a wiki for Dota Auto Chess, generated from the game's own files. Live at https://dac-builder.com.

- **Builder** (`index.html`): add pieces, set stars and courier level, add extra traits (Ringmaster's classes, Wheel of Wonder), and see which synergies activate. Uses the game's real rules: only different pieces count, plus the Wizard, Demon / Demon Hunter and Faceless rules. Builds can be saved in the browser or shared as a link.
- **Wiki**: a page for every piece and synergy, the item, relic and talent lists, and a guide to the game's mechanics.

## Project structure

| Path | What it is |
|---|---|
| `tools/extract.py` | Reads the unpacked game files and writes `data/game.json` |
| `tools/images.py` | Converts portraits and icons from the game VPKs into `assets/img/` (WebP) |
| `tools/build_site.py` | Generates every HTML page, `assets/js/data.js` and `assets/js/search-index.js` |
| `data/game.json` | Extracted game data. Generated, don't edit |
| `data/synergies.json` | Hand-curated synergy descriptions, checked against the game code |
| `content/` | Hand-written page bodies (builder markup, guide pages) |
| `assets/css/site.css`, `assets/js/site.js`, `assets/js/builder.js` | Hand-written styles and scripts |
| `index.html`, `pieces/`, `synergies/`, `items/`, `guide/`, `sitemap.xml` | Generated output, committed so GitHub Pages can serve it |

## Run locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Updating after a game patch

Needs Python 3.12+ and Pillow. Image conversion also needs [Source2Viewer-CLI](https://github.com/ValveResourceFormat/ValveResourceFormat/releases).

```bash
python3 ~/dac_lua/extract_vpk.py      # unpack the latest game files to ~/dac_lua
python3 tools/extract.py              # -> data/game.json
python3 tools/images.py               # only if pieces/items/icons changed (see the script header)
python3 tools/build_site.py           # -> HTML pages
git diff data/game.json               # review what changed in the patch
```

Then re-check `data/synergies.json` against any synergy changes. Thresholds always come from the game files; the descriptions are curated by hand.

## Deploy

Push to the branch GitHub Pages serves. No build step runs on the server.
