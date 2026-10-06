# Notes for code agents

## Project type

- Static site on GitHub Pages (custom domain in `CNAME`). No backend, no JS build step, no npm.
- Pages are **generated** by `tools/build_site.py` and committed. Edit the generator, `content/`, `data/synergies.json` or the hand-written assets, then re-run the generator. Never hand-edit generated HTML, `assets/js/data.js` or `assets/js/search-index.js`.
- Python 3.12+ (the generator uses backslashes inside f-string expressions). Pillow is only needed by `tools/images.py`.

## Data pipeline

1. `~/dac_lua/` holds the unpacked game. See `~/dac_lua/README_WIKI.md` for where everything lives in the game files.
2. `tools/extract.py` writes `data/game.json`:
   - Pieces come from `_G.chess_list_by_mana` (normal shop), `_black` (Undead spare pieces, source `dark`), `_special` (Pandaren spirits, Io; source `special`) and `_G.chess_list_ssr` (source `ssr`).
   - SSR pieces are a single level-9 unit: cost 9, one stats entry, `base` = the normal piece's id. Their unit name has no star suffix, so the game counts them as a different piece from the normal version for synergies.
   - Each piece's races and classes are its `is_*` abilities in `npc_units_custom.txt`, with stats per star (`chess_x`, `chess_x1`, `chess_x11`).
   - Skills come from `_G.chess_ability_list_base` plus `npc_abilities_custom.txt` values and tooltip labels.
   - Synergy thresholds come from `_G.combo_ability_type`. That table is the source of truth; tooltips are often outdated.
   - Items come from `_G.ITEM_LIST_BY_LEVEL`, relics from `_G.DROP_RELIC_LIST`, talents from `_G.TALENT_TREE`.
   - Display-name typos are fixed in `NAME_FIXES`.
3. `data/synergies.json` holds the curated per-level text, plus optional `details` sections (title, intro, groups of bullet points) shown on the synergy page. The `mismatch` field is a player-facing note shown wherever the in-game tooltip says something different. Its level `required` values must match the thresholds in `game.json`; `build_site.py` falls back to the tooltip text if a level is missing.

## Builder (`assets/js/builder.js`)

- State is `{ level, board: [{ id, star, extra: [synergyId] }] }`. Duplicates are allowed: they matter for Kobold, but count once for synergies.
- `evaluate()` mirrors `AddComboAbility()` in `addon_game_mode.lua`:
  - Count different piece ids per synergy.
  - With 2 Wizards, each level needing 4 or more gets +1 to the count once you have 3. This doesn't apply to Demon or Wizard.
  - Demon is active only with exactly 1 Demon type, or 2+ of your own Demon Hunters.
  - The "only active synergy" check ignores Wizard. With 3 Wizards, that sole synergy unlocks every level.
  - Faceless is active only if it is the sole synergy and you have fewer than 2 Wizards.
- Share links use `#l=<level>&b=id*star~extra,...`. Wiki "Open in builder" links use `index.html#b=<id>`.
- Saves live in localStorage `dac_builder_builds_v2`. Old saves from `dac_builder_saved_builds` are migrated once.

## Known facts worth remembering (verified in the game code)

- Item recipes are disabled; Equipment Recast replaces them.
- Dark Heart and Magic Card are leftover code and not obtainable.
- Spare Undead pieces come from the Ascetic's Cap item and Pandaren fishing.
- A piece's level is cost + 2 × (stars − 1), capped at 9. It drives player damage (`floor(1 + level/3)`), sell price, and the Ogre and Priest rules.
- Values the server can override per lobby are labelled "default" on the site: pool size, bad-luck threshold, Ascendency chance.
