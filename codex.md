# Codex Notes

This file is for a future LLM/code agent working on this project.

## Project Type

- Plain static site
- No backend
- Intended for GitHub Pages hosting
- State persistence uses browser `localStorage`

## Main Files

- `index.html`: page structure and panel layout
- `styles.css`: all layout and visual styling
- `app.js`: application state, rendering, filtering, save/load logic, synergy evaluation
- `units.js`: canonical unit dataset
- `synergies.js`: canonical synergy definitions and perk text

## Data Model

### Units

Units are defined in `units.js` as `window.UNITS_BY_COST`.

Structure:

```js
{
  "1": [
    { name: "Mirana", race: ["Elf"], class: ["Hunter"] }
  ]
}
```

Important points:

- Units are grouped by cost.
- `race` and `class` are arrays because units can have multiple traits.
- Some units may have empty `race` or `class` arrays.
- Keep `units.js` as the single source of truth for base unit traits.

### Synergies

Synergies are defined in `synergies.js` as `window.SYNERGY_DEFS`.

Structure:

```js
{
  name: "Hunter",
  type: "class",
  levels: [
    { required: 3, perk: "..." }
  ]
}
```

Important points:

- `type` is either `race` or `class`.
- The renderer only shows synergies that exist in `synergies.js`.
- If a race/class exists on a unit but is missing from `synergies.js`, it will not appear in the synergy panel.

## Current UI Structure

Top-level layout:

- Header
- Build save/load controls
- Two-column main area

Left column:

- `Current Build`
- `Unit Browser`

Right column:

- `Synergies`

This layout is intentional. The unit browser should stay directly below the current build, and the synergy panel is allowed to grow independently on the right.

## Current Build Behavior

- A build is a list of unit instances, not a count map.
- Adding a unit creates a separate instance with its own added race/class traits.
- Unit star levels are recomputed from duplicate counts:
  - `3` copies => `2*`
  - `9` copies => `3*`

Trait editing:

- Each build unit shows base races/classes plus any added ones.
- Added traits can be inserted or removed per unit.
- Base traits are not removable.

## Unit Browser Behavior

- Replaced the older searchable dropdown.
- Shows all units grouped by cost.
- Supports one-click add/remove by unit name.
- Shows current copy count in the build.
- Filtering supports:
  - Cost
  - Race
  - Class

Filter semantics:

- OR within the same group
- AND across groups

Example:

- `1g` + `2g` means either cost
- `Hunter` + `Mage` means either class
- `1g` + `Hunter` means units matching both selected groups

## Synergy Evaluation Notes

Main logic lives in `buildSynergySummaries()` in `app.js`.

Behavior already implemented:

- Synergies are split into active and inactive sections.
- Inactive synergies only show if at least one relevant unit exists in the build.
- Synergy perks are cumulative by reached level.
- Wizard reduces second-level requirements by `1`.

Special-case rules already implemented:

- `Faceless` is active only if no other synergies are active.
- `Demon` is active only if:
  - there is exactly one Demon in the build, or
  - `Demon Hunter` is active

If you add more special cases, keep them centralized in the synergy evaluation logic rather than scattering conditions across render code.

## Persistence

- Saved builds are stored in `localStorage`
- Storage key: `dac_builder_saved_builds`

Saved data contains unit instances with:

- `name`
- `cost`
- `baseRace`
- `baseClass`
- `addedRace`
- `addedClass`
- `stars`

On load, unit `id`s are regenerated with `crypto.randomUUID()`.

## Known Constraints

- No test suite currently exists.
- No build step or framework exists.
- The app is DOM-driven and re-renders by replacing sections of markup.
- Because this is a static site, avoid introducing server assumptions.

## Developer Guidance

- Prefer updating `units.js` and `synergies.js` instead of hardcoding data in `app.js`.
- If a synergy should display, it must be added to `synergies.js`.
- Be careful when changing layout: desktop usage is the primary target.
- Keep the current build compact enough that many units can be visible at once.
- Avoid reintroducing the old unit dropdown flow unless explicitly requested.

## High-Risk Areas

- `buildSynergySummaries()` in `app.js`
  - Wizard adjustments and special-case trait logic live here.
- Build unit mutation flow
  - Trait edits, duplicate counting, and star recomputation depend on `syncBuildState()`.
- `units.js`
  - Small trait changes can alter filters, synergies, and build behavior broadly.

## Safe Extension Points

- Add more unit data in `units.js`
- Add more synergy definitions in `synergies.js`
- Improve perk display formatting in the synergy panel
- Add more special-case synergy rules in `app.js`
- Add export/import for builds if needed, still staying static-only
