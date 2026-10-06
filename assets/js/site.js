(function () {
  const root = document.body.dataset.root || "";

  initSearch();
  initPieceFilters();

  // Global search box in the top bar.
  function initSearch() {
    const input = document.getElementById("site-search");
    const box = document.getElementById("site-search-results");
    const index = window.DAC_SEARCH || [];
    if (!input || !box) return;

    let selected = -1;
    let results = [];

    input.addEventListener("input", update);
    input.addEventListener("focus", update);
    input.addEventListener("keydown", (e) => {
      if (box.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        selected = (selected + step + results.length) % results.length;
        render();
      } else if (e.key === "Enter") {
        const hit = results[Math.max(selected, 0)];
        if (hit) window.location.href = root + hit.u;
      } else if (e.key === "Escape") {
        box.hidden = true;
        input.blur();
      }
    });
    document.addEventListener("click", (e) => {
      if (!box.contains(e.target) && e.target !== input) box.hidden = true;
    });
    document.addEventListener("keydown", (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(tag)) {
        e.preventDefault();
        input.focus();
      }
    });

    function update() {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        box.hidden = true;
        return;
      }
      results = index
        .map((entry) => ({ entry, score: score(entry.t.toLowerCase(), q) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score || a.entry.t.localeCompare(b.entry.t))
        .slice(0, 10)
        .map((r) => r.entry);
      selected = -1;
      render();
    }

    function score(text, q) {
      if (text === q) return 100;
      if (text.startsWith(q)) return 80;
      if (text.split(/\s+/).some((w) => w.startsWith(q))) return 60;
      if (text.includes(q)) return 40;
      return 0;
    }

    function render() {
      box.hidden = false;
      if (!results.length) {
        box.innerHTML = '<div class="empty">No matches</div>';
        return;
      }
      box.innerHTML = results
        .map(
          (r, i) =>
            `<a href="${root}${r.u}" class="${i === selected ? "selected" : ""}">` +
            (r.i ? `<img src="${root}${r.i}" alt="">` : "") +
            `<span>${escapeHtml(r.t)}</span><span class="kind">${escapeHtml(r.k)}</span></a>`
        )
        .join("");
    }
  }

  // Filters on the Pieces index page (static markup, filtered client-side).
  function initPieceFilters() {
    const panel = document.getElementById("piece-filters");
    if (!panel) return;
    const search = document.getElementById("piece-search");
    const cards = Array.from(document.querySelectorAll("#piece-list .piece-card"));
    const groups = Array.from(document.querySelectorAll("#piece-list .cost-group"));
    const noResults = document.getElementById("no-results");
    const active = { cost: new Set(), trait: new Set() };

    panel.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (!chip) return;
      const set = active[chip.dataset.filter];
      const value = chip.dataset.value;
      set.has(value) ? set.delete(value) : set.add(value);
      chip.classList.toggle("active", set.has(value));
      apply();
    });
    search.addEventListener("input", apply);
    document.getElementById("clear-filters").addEventListener("click", () => {
      active.cost.clear();
      active.trait.clear();
      search.value = "";
      panel.querySelectorAll(".chip.active").forEach((c) => c.classList.remove("active"));
      apply();
    });

    function apply() {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      cards.forEach((card) => {
        const traits = card.dataset.traits.split(" ");
        const ok =
          (!q || card.dataset.name.includes(q)) &&
          (!active.cost.size || active.cost.has(card.dataset.cost)) &&
          // Every selected trait must be present (narrowing search).
          [...active.trait].every((t) => traits.includes(t));
        card.hidden = !ok;
        if (ok) shown++;
      });
      groups.forEach((g) => {
        g.hidden = !g.querySelector(".piece-card:not([hidden])");
      });
      noResults.hidden = shown > 0;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
})();
