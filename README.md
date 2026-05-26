# Dota Auto Chess Builder

Static build planner for Dota Auto Chess.

## What It Does

- Build teams by adding units from a browser grouped by cost
- Filter units by cost, race, and class
- Track active and inactive synergies
- Add or remove extra races/classes on units
- Auto-upgrade units to `2*` at 3 copies and `3*` at 9 copies
- Save builds in browser `localStorage`

## Project Structure

- `index.html` - page structure
- `styles.css` - layout and styling
- `app.js` - app logic
- `units.js` - unit data
- `synergies.js` - synergy definitions and perks

## Run Locally

From the project directory:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Deploy

This project is a plain static site and can be hosted directly on GitHub Pages.

## Notes

- There is no backend.
- Saved builds are stored per browser using `localStorage`.
