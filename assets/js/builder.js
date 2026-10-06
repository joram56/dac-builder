(function () {
  const STORAGE_KEY = "dac_builder_builds_v2";
  const LEGACY_STORAGE_KEY = "dac_builder_saved_builds";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;

  const data = window.DAC_DATA;
  const pieces = data.pieces;
  const synergies = data.synergies;
  const pieceById = new Map(pieces.map((p) => [p.id, p]));
  const pieceByName = new Map(pieces.map((p) => [p.name.toLowerCase(), p]));
  const synById = new Map(synergies.map((s) => [s.id, s]));
  const classIds = synergies.filter((s) => s.type === "class").map((s) => s.id);

  const el = (id) => document.getElementById(id);
  const boardEl = el("board");
  const pickerEl = el("picker");
  const synergyEl = el("synergy-list");
  const levelSelect = el("level");

  const state = {
    level: 10,
    // Each entry: { uid, id, star, extra: [synergyId] }
    board: [],
  };
  const ui = {
    search: "",
    costs: new Set(),
    traits: new Set(),
    showSpecial: false,
    expanded: new Set(),
    traitMenu: null, // uid of the board card whose "add trait" select is open
  };
  let nextUid = 1;

  init();

  function init() {
    for (let lvl = MIN_LEVEL; lvl <= MAX_LEVEL; lvl++) {
      levelSelect.add(new Option(String(lvl), String(lvl)));
    }
    levelSelect.addEventListener("change", () => {
      state.level = Number(levelSelect.value);
      changed();
    });

    renderFilterChips();
    el("picker-search").addEventListener("input", (e) => {
      ui.search = e.target.value.trim().toLowerCase();
      renderPicker();
    });
    el("show-special").addEventListener("change", (e) => {
      ui.showSpecial = e.target.checked;
      renderPicker();
    });
    el("picker-clear").addEventListener("click", clearPickerFilters);
    el("clear-btn").addEventListener("click", () => {
      state.board = [];
      changed();
    });
    el("share-btn").addEventListener("click", copyShareLink);
    el("save-btn").addEventListener("click", saveBuild);
    el("load-btn").addEventListener("click", loadSelectedBuild);
    el("delete-btn").addEventListener("click", deleteSelectedBuild);
    el("saved-builds").addEventListener("change", () => {
      if (el("saved-builds").value) el("build-name").value = el("saved-builds").value;
    });

    migrateLegacySaves();
    refreshSavedList();
    if (!loadFromHash()) render();
    window.addEventListener("hashchange", () => loadFromHash());
  }

  // ------------------------------------------------------------ synergy engine
  // Mirrors AddComboAbility() in the game's addon_game_mode.lua.
  function evaluate(board) {
    const members = new Map(); // synergy id -> Set of different piece ids
    board.forEach((entry) => {
      traitsOf(entry).forEach((t) => {
        if (!members.has(t)) members.set(t, new Set());
        members.get(t).add(entry.id);
      });
    });
    const count = (id) => (members.has(id) ? members.get(id).size : 0);
    const wizards = count("wizard");

    const results = synergies
      .filter((s) => count(s.id) > 0)
      .map((s) => {
        const c = count(s.id);
        const levels = s.levels.map((lv) => {
          // 2 Wizards: levels that need 4+ pieces need one fewer, once you have 3+.
          const wizBoost = s.id !== "demon" && s.id !== "wizard" && wizards >= 2 && c >= 3 && lv.required >= 4;
          const effective = wizBoost ? c + 1 : c;
          const reached = effective >= lv.required;
          return { ...lv, reached, byWizard: reached && c < lv.required ? "boost" : null };
        });
        return { syn: s, count: c, levels, status: null, statusGood: false };
      });

    const byId = new Map(results.map((r) => [r.syn.id, r]));

    const demon = byId.get("demon");
    if (demon) {
      const hunters = count("demonhunter");
      const ok = demon.count === 1 || hunters >= 2;
      if (!ok) {
        demon.levels.forEach((l) => (l.reached = false));
        demon.status = "Disabled: Fel Power only works with a single type of Demon on the board (or 2 Demon Hunters).";
      } else if (demon.count > 1) {
        demon.status = "2 Demon Hunters make all your Demons count as the same type.";
        demon.statusGood = true;
      } else if (hunters < 2) {
        demon.status = "Each Demon Hunter on the enemy board counts as another Demon type and disables this in that fight.";
      }
    }

    const activeNonWizard = results.filter((r) => r.syn.id !== "wizard" && r.levels.some((l) => l.reached));
    const only = activeNonWizard.length === 1 ? activeNonWizard[0] : null;

    if (wizards >= 3 && only) {
      only.levels.forEach((l) => {
        if (!l.reached) {
          l.reached = true;
          l.byWizard = "unlock";
        }
      });
      only.status = "3 Wizards: this is your only active synergy, so all of its levels are unlocked.";
      only.statusGood = true;
    }

    const faceless = byId.get("nraqi");
    if (faceless && faceless.levels.some((l) => l.reached)) {
      if (!only || only.syn.id !== "nraqi" || wizards >= 2) {
        faceless.levels.forEach((l) => (l.reached = false));
        faceless.status =
          wizards >= 2
            ? "Disabled: Faceless doesn't work with 2 or more Wizards."
            : "Disabled: Faceless only works when it is your only active synergy.";
      }
    }

    results.forEach((r) => {
      r.active = r.levels.some((l) => l.reached);
      r.activeCount = r.levels.filter((l) => l.reached).length;
      r.next = r.levels.find((l) => !l.reached) || null;
    });
    return { results, count };
  }

  function traitsOf(entry) {
    const p = pieceById.get(entry.id);
    return [...new Set([...p.races, ...p.classes, ...entry.extra])];
  }

  // ------------------------------------------------------------------ actions
  function addPiece(id) {
    state.board.push({ uid: nextUid++, id, star: 1, extra: [] });
    changed();
  }

  function removeEntry(uid) {
    state.board = state.board.filter((e) => e.uid !== uid);
    changed();
  }

  function changed() {
    render();
    writeHash();
  }

  function clearPickerFilters() {
    ui.search = "";
    ui.costs.clear();
    ui.traits.clear();
    el("picker-search").value = "";
    document.querySelectorAll(".picker-panel .chip.active").forEach((c) => c.classList.remove("active"));
    renderPicker();
  }

  function filterByTrait(id) {
    ui.traits = new Set([id]);
    document.querySelectorAll("#race-filters .chip, #class-filters .chip").forEach((c) => {
      c.classList.toggle("active", c.dataset.value === id);
    });
    if (pieces.some((p) => p.source !== "standard" && (p.races.includes(id) || p.classes.includes(id)))) {
      // keep the special toggle as the user set it
    }
    renderPicker();
    document.querySelector(".picker-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ------------------------------------------------------------------- render
  function render() {
    levelSelect.value = String(state.level);
    const evaluation = evaluate(state.board);
    renderStats();
    renderBoard();
    renderSynergies(evaluation);
    renderPicker(evaluation);
  }

  function renderStats() {
    const countEl = el("board-count");
    const n = state.board.length;
    countEl.textContent = `${n} / ${state.level} pieces`;
    countEl.classList.toggle("over", n > state.level);
    countEl.title =
      n > state.level
        ? `A level ${state.level} courier can only field ${state.level} pieces.`
        : "Pieces on board / pieces allowed at this courier level";
    const gold = state.board.reduce((sum, e) => {
      const p = pieceById.get(e.id);
      return sum + (p.source === "ssr" ? p.cost : p.cost * Math.pow(3, e.star - 1));
    }, 0);
    el("board-cost").textContent = `${gold} gold`;
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    if (!state.board.length) {
      boardEl.innerHTML =
        '<div class="board-empty"><div><strong>Your board is empty.</strong><br>Add pieces from the list below, or open a piece in the wiki and choose “Open in builder”.</div></div>';
      return;
    }
    const seen = new Set();
    state.board.forEach((entry) => {
      const p = pieceById.get(entry.id);
      const dupe = seen.has(entry.id);
      seen.add(entry.id);
      const card = document.createElement("article");
      card.className = `board-card cost-${p.cost}${dupe ? " dupe" : ""}`;
      const base = [...p.races, ...p.classes];
      const traitHtml =
        base.map((t) => traitPill(t, false)).join("") +
        entry.extra.filter((t) => !base.includes(t)).map((t) => traitPill(t, true)).join("");
      const isRingmaster = p.id === "rm";
      card.innerHTML = `
        <img class="portrait" src="assets/img/pieces/${p.id}.webp" alt="" width="128" height="72">
        <button type="button" class="remove" title="Remove from board" aria-label="Remove ${escapeHtml(p.name)}">×</button>
        <div class="body">
          <div class="name-row">
            <span class="name"><a href="pieces/${p.id}.html" title="Open ${escapeHtml(p.name)} in the wiki">${escapeHtml(p.name)}</a></span>
            ${
              p.source === "ssr"
                ? '<span class="ssr-tag" title="SSR pieces can\'t be upgraded">SSR</span>'
                : `<span class="star-btns">${[1, 2, 3]
                    .map((s) => `<button type="button" data-star="${s}" class="${s <= entry.star ? "on" : ""}" title="${s}-star">★</button>`)
                    .join("")}</span>`
            }
          </div>
          <div class="traits">${traitHtml}<button type="button" class="add-trait" title="Add an extra race or class (e.g. from Wheel of Wonder)">+ trait</button></div>
          ${ui.traitMenu === entry.uid ? traitSelect(entry) : ""}
          ${isRingmaster && entry.extra.length < 3 ? '<div class="hint">Ringmaster gets 3 random classes each game. Add this game\'s classes with “+ trait”.</div>' : ""}
          ${dupe ? '<div class="hint">Duplicate: only counts once for synergies.</div>' : ""}
        </div>`;
      card.querySelector(".remove").addEventListener("click", () => removeEntry(entry.uid));
      card.querySelectorAll("[data-star]").forEach((b) =>
        b.addEventListener("click", () => {
          entry.star = Number(b.dataset.star);
          changed();
        })
      );
      card.querySelector(".add-trait").addEventListener("click", () => {
        ui.traitMenu = ui.traitMenu === entry.uid ? null : entry.uid;
        renderBoard();
        const sel = boardEl.querySelector("select.trait-select");
        if (sel) sel.focus();
      });
      card.querySelectorAll("[data-remove-extra]").forEach((b) =>
        b.addEventListener("click", () => {
          entry.extra = entry.extra.filter((t) => t !== b.dataset.removeExtra);
          changed();
        })
      );
      const sel = card.querySelector("select.trait-select");
      if (sel) {
        sel.addEventListener("change", () => {
          if (sel.value) entry.extra.push(sel.value);
          ui.traitMenu = null;
          changed();
        });
      }
      boardEl.appendChild(card);
    });
  }

  function traitPill(t, extra) {
    const s = synById.get(t);
    return `<span class="trait${extra ? " extra" : ""}" title="${escapeHtml(s.name)}${extra ? " (extra)" : ""}">
      <img src="assets/img/synergies/${t}.webp" alt="">${escapeHtml(s.name)}${
      extra ? `<button type="button" data-remove-extra="${t}" aria-label="Remove ${escapeHtml(s.name)}">×</button>` : ""
    }</span>`;
  }

  function traitSelect(entry) {
    const p = pieceById.get(entry.id);
    const have = new Set([...p.races, ...p.classes, ...entry.extra]);
    const opts = (type) =>
      synergies
        .filter((s) => s.type === type && !have.has(s.id) && (p.id !== "rm" || type === "class"))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
        .join("");
    const races = p.id === "rm" ? "" : `<optgroup label="Races">${opts("race")}</optgroup>`;
    return `<select class="trait-select" aria-label="Add trait"><option value="">Add race or class…</option>${races}<optgroup label="Classes">${opts("class")}</optgroup></select>`;
  }

  function renderSynergies(evaluation) {
    const { results } = evaluation;
    if (!results.length) {
      synergyEl.innerHTML = '<p class="syn-empty">Add pieces to see which synergies they unlock. Each different piece counts once toward each of its races and classes.</p>';
      return;
    }
    const sortFn = (a, b) =>
      b.activeCount - a.activeCount || b.count - a.count || a.syn.name.localeCompare(b.syn.name);
    const active = results.filter((r) => r.active).sort(sortFn);
    const inactive = results.filter((r) => !r.active).sort(sortFn);
    synergyEl.innerHTML = "";
    if (active.length) synergyEl.appendChild(sectionLabel(`Active (${active.length})`));
    active.forEach((r) => synergyEl.appendChild(synergyRow(r)));
    if (inactive.length) synergyEl.appendChild(sectionLabel("Not yet active"));
    inactive.forEach((r) => synergyEl.appendChild(synergyRow(r)));
  }

  function sectionLabel(text) {
    const d = document.createElement("div");
    d.className = "syn-section-label";
    d.textContent = text;
    return d;
  }

  function synergyRow(r) {
    const s = r.syn;
    const row = document.createElement("div");
    const disabled = !r.active && r.status && !r.statusGood;
    row.className = `syn-row ${r.active ? "active" : "inactive"}${disabled ? " disabled" : ""}`;
    const open = ui.expanded.has(s.id);
    const pips = r.levels
      .map((l) => `<span class="pip ${l.reached ? (l.byWizard ? "wiz" : "on") : ""}" title="${l.byWizard ? "Reached thanks to Wizards" : `Needs ${l.required}`}">${l.required}</span>`)
      .join("");
    const nextText = r.next && !disabled ? `${r.count}/${r.next.required}` : `${r.count}`;
    row.innerHTML = `
      <button type="button" class="syn-row-head" aria-expanded="${open}">
        <img src="assets/img/synergies/${s.id}.webp" alt="">
        <span class="syn-row-title"><strong>${escapeHtml(s.name)}</strong><span class="count">${nextText}</span>
          <span class="pips">${pips}</span></span>
      </button>
      ${
        open
          ? `<div class="syn-row-body">
        ${s.innate ? `<p class="muted">${escapeHtml(s.innate)}</p>` : ""}
        ${r.status ? `<p class="status${r.statusGood ? " good" : ""}">${escapeHtml(r.status)}</p>` : ""}
        <ol>${r.levels
          .map(
            (l) =>
              `<li class="${l.reached ? "on" : ""}"><span class="req">${l.required}</span><span>${escapeHtml(l.text)}${
                l.byWizard === "boost" ? " <em>(Wizard bonus)</em>" : l.byWizard === "unlock" ? " <em>(unlocked by Wizards)</em>" : ""
              }</span></li>`
          )
          .join("")}</ol>
        <div class="row-actions"><button type="button" class="link-btn" data-act="filter">Show ${escapeHtml(s.name)} pieces</button>
          <a class="link-btn" href="synergies/${s.id}.html">Wiki page</a></div>
      </div>`
          : r.active
          ? `<div class="syn-row-body"><ol>${r.levels
              .filter((l) => l.reached)
              .map((l) => `<li class="on"><span class="req">${l.required}</span><span>${escapeHtml(l.text)}</span></li>`)
              .join("")}</ol></div>`
          : r.status && !r.statusGood
          ? `<div class="syn-row-body"><p class="status">${escapeHtml(r.status)}</p></div>`
          : ""
      }`;
    row.querySelector(".syn-row-head").addEventListener("click", () => {
      open ? ui.expanded.delete(s.id) : ui.expanded.add(s.id);
      renderSynergies(evaluate(state.board));
    });
    const filterBtn = row.querySelector('[data-act="filter"]');
    if (filterBtn) filterBtn.addEventListener("click", () => filterByTrait(s.id));
    return row;
  }

  function renderFilterChips() {
    const costWrap = el("cost-filters");
    costWrap.innerHTML = [1, 2, 3, 4, 5]
      .map((c) => `<button type="button" class="chip cost-chip cost-${c}" data-value="${c}" title="${c}-cost pieces">${c}</button>`)
      .join("");
    costWrap.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      toggle(ui.costs, Number(chip.dataset.value), chip);
    });
    ["race", "class"].forEach((type) => {
      const wrap = el(`${type}-filters`);
      wrap.innerHTML = synergies
        .filter((s) => s.type === type)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(
          (s) =>
            `<button type="button" class="chip" data-value="${s.id}"><img src="assets/img/synergies/${s.id}.webp" alt="" width="16" height="16">${escapeHtml(s.name)}</button>`
        )
        .join("");
      wrap.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        toggle(ui.traits, chip.dataset.value, chip);
      });
    });

    function toggle(set, value, chip) {
      set.has(value) ? set.delete(value) : set.add(value);
      chip.classList.toggle("active", set.has(value));
      renderPicker();
    }
  }

  function renderPicker(evaluation) {
    evaluation = evaluation || evaluate(state.board);
    const onBoard = new Map();
    state.board.forEach((e) => onBoard.set(e.id, (onBoard.get(e.id) || 0) + 1));
    const traitFilter = [...ui.traits];
    const visible = pieces.filter((p) => {
      if (!ui.showSpecial && p.source !== "standard") return false;
      if (ui.search && !p.name.toLowerCase().includes(ui.search)) return false;
      if (ui.costs.size && !ui.costs.has(p.cost)) return false;
      const traits = [...p.races, ...p.classes];
      // OR within the selected traits: show pieces with any of them.
      if (traitFilter.length && !traitFilter.some((t) => traits.includes(t))) return false;
      return true;
    });

    pickerEl.innerHTML = "";
    if (!visible.length) {
      pickerEl.innerHTML = '<p class="muted">No pieces match these filters.</p>';
      return;
    }
    for (const cost of [1, 2, 3, 4, 5, 9]) {
      const group = visible.filter((p) => p.cost === cost);
      if (!group.length) continue;
      const section = document.createElement("section");
      section.className = "picker-group";
      section.innerHTML = `<h3 class="cost-text-${cost}">${cost === 9 ? "SSR · 9 gold" : `${cost} gold`}</h3><div class="picker-grid"></div>`;
      const grid = section.querySelector(".picker-grid");
      group.forEach((p) => {
        const owned = onBoard.get(p.id) || 0;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `pick cost-${p.cost}`;
        btn.title = `${p.name}: ${[...p.races, ...p.classes].map((t) => synById.get(t).name).join(", ")}${p.skill ? ` · ${p.skill}` : ""}`;
        const traitImgs = [...p.races, ...p.classes]
          .map((t) => {
            const up = !owned && wouldLevelUp(evaluation, t);
            return `<img src="assets/img/synergies/${t}.webp" alt="${escapeHtml(synById.get(t).name)}" class="${up ? "levels-up" : ""}">`;
          })
          .join("");
        btn.innerHTML = `
          <img class="portrait" src="assets/img/pieces/${p.id}.webp" alt="" loading="lazy" width="128" height="72">
          ${owned ? `<span class="owned">${owned}</span>` : ""}
          ${p.source !== "standard" ? `<span class="special-tag">${sourceLabel(p.source)}</span>` : ""}
          <span class="pick-name">${escapeHtml(p.name)}</span>
          <span class="pick-traits">${traitImgs}</span>`;
        btn.addEventListener("click", () => addPiece(p.id));
        grid.appendChild(btn);
      });
      pickerEl.appendChild(section);
    }
  }

  // True if one more different piece with this trait reaches a new level (ignoring Wizard/Demon rules).
  function wouldLevelUp(evaluation, traitId) {
    const s = synById.get(traitId);
    const next = evaluation.count(traitId) + 1;
    return s.levels.some((l) => l.required === next);
  }

  function sourceLabel(source) {
    return { dark: "Undead spare", special: "Special", gold: "Golden Heart", ssr: "SSR" }[source] || "";
  }

  // ------------------------------------------------------- share links (hash)
  // Format: #l=8&b=axe,cm*2,rm~mage~hunter   (*n = stars, ~x = extra trait)
  function encodeBoard() {
    return state.board
      .map((e) => e.id + (e.star > 1 ? `*${e.star}` : "") + e.extra.map((t) => `~${t}`).join(""))
      .join(",");
  }

  function writeHash() {
    const b = encodeBoard();
    const hash = b ? `#l=${state.level}&b=${b}` : "";
    if (window.location.hash !== hash) {
      history.replaceState(null, "", hash || window.location.pathname + window.location.search);
    }
  }

  function loadFromHash() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (!params.has("b")) return false;
    const level = Number(params.get("l"));
    if (level >= MIN_LEVEL && level <= MAX_LEVEL) state.level = level;
    state.board = [];
    params
      .get("b")
      .split(",")
      .filter(Boolean)
      .forEach((token) => {
        const [head, ...extra] = token.split("~");
        const [id, star] = head.split("*");
        if (!pieceById.has(id)) return;
        state.board.push({
          uid: nextUid++,
          id,
          star: Math.min(3, Math.max(1, Number(star) || 1)),
          extra: extra.filter((t) => synById.has(t)),
        });
      });
    render();
    writeHash();
    return true;
  }

  function copyShareLink() {
    writeHash();
    const url = window.location.href;
    const done = () => toast("Share link copied to clipboard.");
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, () => prompt("Copy this link:", url));
    } else {
      prompt("Copy this link:", url);
    }
  }

  // ------------------------------------------------------------- saved builds
  function getSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (err) {
      return {};
    }
  }

  function setSaved(saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }

  function saveBuild() {
    const name = el("build-name").value.trim();
    if (!name) {
      toast("Enter a build name first.");
      el("build-name").focus();
      return;
    }
    const saved = getSaved();
    saved[name] = {
      savedAt: new Date().toISOString(),
      level: state.level,
      board: state.board.map(({ id, star, extra }) => ({ id, star, extra })),
    };
    setSaved(saved);
    refreshSavedList(name);
    toast(`Saved “${name}”.`);
  }

  function loadSelectedBuild() {
    const name = el("saved-builds").value;
    const build = getSaved()[name];
    if (!build) return;
    state.level = build.level || state.level;
    state.board = build.board
      .filter((e) => pieceById.has(e.id))
      .map((e) => ({ uid: nextUid++, id: e.id, star: e.star || 1, extra: (e.extra || []).filter((t) => synById.has(t)) }));
    el("build-name").value = name;
    changed();
  }

  function deleteSelectedBuild() {
    const name = el("saved-builds").value;
    if (!name) return;
    if (!confirm(`Delete the saved build “${name}”?`)) return;
    const saved = getSaved();
    delete saved[name];
    setSaved(saved);
    refreshSavedList();
  }

  function refreshSavedList(selected) {
    const select = el("saved-builds");
    const names = Object.keys(getSaved()).sort((a, b) => a.localeCompare(b));
    select.innerHTML = '<option value="">Saved builds…</option>';
    names.forEach((n) => select.add(new Option(n, n)));
    if (selected) select.value = selected;
  }

  // Saves from the old builder stored one entry per copy with names and traits.
  function migrateLegacySaves() {
    let legacy;
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    } catch (err) {
      return;
    }
    if (!legacy || typeof legacy !== "object") return;
    const saved = getSaved();
    Object.entries(legacy).forEach(([name, build]) => {
      if (saved[name] || !build || !Array.isArray(build.units)) return;
      const groups = new Map();
      build.units.forEach((u) => {
        const p = pieceByName.get(String(u.name || "").toLowerCase());
        if (!p) return;
        const g = groups.get(p.id) || { copies: 0, extra: new Set() };
        g.copies++;
        [...(u.addedRace || []), ...(u.addedClass || [])].forEach((t) => {
          const s = synergies.find((x) => x.name.toLowerCase() === String(t).toLowerCase());
          if (s) g.extra.add(s.id);
        });
        groups.set(p.id, g);
      });
      saved[name] = {
        savedAt: build.savedAt || new Date().toISOString(),
        level: MAX_LEVEL,
        board: [...groups].map(([id, g]) => ({ id, star: g.copies >= 9 ? 3 : g.copies >= 3 ? 2 : 1, extra: [...g.extra] })),
      };
    });
    setSaved(saved);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  // ------------------------------------------------------------------ helpers
  let toastTimer = null;
  function toast(message) {
    let t = document.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2200);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
