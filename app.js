(function () {
  const STORAGE_KEY = "dac_builder_saved_builds";

  const unitSelect = document.getElementById("unit-select");
  const addUnitBtn = document.getElementById("add-unit-btn");
  const buildList = document.getElementById("build-list");
  const synergyList = document.getElementById("synergy-list");
  const buildNameInput = document.getElementById("build-name");
  const saveBuildBtn = document.getElementById("save-build-btn");
  const newBuildBtn = document.getElementById("new-build-btn");
  const savedBuildsSelect = document.getElementById("saved-builds");
  const loadBuildBtn = document.getElementById("load-build-btn");
  const deleteBuildBtn = document.getElementById("delete-build-btn");

  const allUnits = flattenUnits(window.UNITS_BY_COST || {});
  const synergyDefs = window.SYNERGY_DEFS || [];
  const unitByName = new Map(allUnits.map((u) => [u.name, u]));
  const allTraits = collectAllTraits(allUnits);

  let buildUnits = [];

  init();

  function init() {
    populateUnitSelect();
    refreshSavedBuildsSelect();
    render();

    addUnitBtn.addEventListener("click", addUnitFromSelect);
    saveBuildBtn.addEventListener("click", saveCurrentBuild);
    newBuildBtn.addEventListener("click", resetBuild);
    loadBuildBtn.addEventListener("click", loadSelectedBuild);
    deleteBuildBtn.addEventListener("click", deleteSelectedBuild);
  }

  function flattenUnits(unitsByCost) {
    return Object.keys(unitsByCost)
      .sort((a, b) => Number(a) - Number(b))
      .flatMap((cost) =>
        unitsByCost[cost].map((unit) => ({
          ...unit,
          cost: Number(cost),
          race: [...unit.race],
          class: [...unit.class]
        }))
      );
  }

  function collectAllTraits(units) {
    const raceSet = new Set();
    const classSet = new Set();

    units.forEach((unit) => {
      unit.race.forEach((r) => raceSet.add(r));
      unit.class.forEach((c) => classSet.add(c));
    });

    return {
      race: Array.from(raceSet).sort(),
      class: Array.from(classSet).sort()
    };
  }

  function populateUnitSelect() {
    unitSelect.innerHTML = "";
    allUnits.forEach((unit) => {
      const option = document.createElement("option");
      option.value = unit.name;
      option.textContent = `${unit.name} (${unit.cost}g)`;
      unitSelect.appendChild(option);
    });
  }

  function addUnitFromSelect() {
    const name = unitSelect.value;
    const base = unitByName.get(name);
    if (!base) return;

    buildUnits.push({
      id: crypto.randomUUID(),
      name: base.name,
      cost: base.cost,
      baseRace: [...base.race],
      baseClass: [...base.class],
      addedRace: [],
      addedClass: [],
      stars: 1
    });

    syncBuildState();
  }

  function recomputeStars() {
    const groups = new Map();
    buildUnits.forEach((u) => {
      groups.set(u.name, (groups.get(u.name) || 0) + 1);
    });

    buildUnits.forEach((u) => {
      const copies = groups.get(u.name) || 0;
      u.stars = copies >= 9 ? 3 : copies >= 3 ? 2 : 1;
    });
  }

  function render() {
    renderBuildUnits();
    renderSynergies();
  }

  function renderBuildUnits() {
    buildList.innerHTML = "";

    if (buildUnits.length === 0) {
      buildList.textContent = "No units in build yet.";
      return;
    }

    buildUnits.forEach((unit) => {
      const card = document.createElement("article");
      card.className = "unit-card";

      const allRace = [...unit.baseRace, ...unit.addedRace];
      const allClass = [...unit.baseClass, ...unit.addedClass];
      const addableRace = allTraits.race.filter((r) => !allRace.includes(r));
      const addableClass = allTraits.class.filter((c) => !allClass.includes(c));
      const removableRace = [...unit.addedRace];
      const removableClass = [...unit.addedClass];

      card.innerHTML = `
        <div class="unit-head">
          <div>
            <div class="unit-name">${escapeHtml(unit.name)} ${"*".repeat(unit.stars)}</div>
            <div class="unit-meta">${unit.cost}g</div>
          </div>
          <div class="unit-actions">
            <button type="button" class="mini-btn" data-action="remove">x</button>
          </div>
        </div>
        <div class="trait-line">
          <strong>Race</strong>
          <div class="trait-controls">
            <button type="button" class="mini-btn" data-action="toggle-add-race">+</button>
            <button type="button" class="mini-btn" data-action="toggle-remove-race">-</button>
          </div>
        </div>
        <div>${renderPills(allRace)}</div>
        <div class="menu-row ${addableRace.length ? "" : "hidden"}" data-menu="add-race">
          ${addableRace.map((r) => `<button type="button" class="menu-item" data-action="add-race" data-value="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join("")}
        </div>
        <div class="menu-row ${removableRace.length ? "" : "hidden"}" data-menu="remove-race">
          ${removableRace.map((r) => `<button type="button" class="menu-item danger" data-action="remove-race" data-value="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join("")}
        </div>

        <div class="trait-line">
          <strong>Class</strong>
          <div class="trait-controls">
            <button type="button" class="mini-btn" data-action="toggle-add-class">+</button>
            <button type="button" class="mini-btn" data-action="toggle-remove-class">-</button>
          </div>
        </div>
        <div>${renderPills(allClass)}</div>
        <div class="menu-row ${addableClass.length ? "" : "hidden"}" data-menu="add-class">
          ${addableClass.map((c) => `<button type="button" class="menu-item" data-action="add-class" data-value="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}
        </div>
        <div class="menu-row ${removableClass.length ? "" : "hidden"}" data-menu="remove-class">
          ${removableClass.map((c) => `<button type="button" class="menu-item danger" data-action="remove-class" data-value="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}
        </div>
      `;

      card.querySelector('[data-action="remove"]').addEventListener("click", () => {
        buildUnits = buildUnits.filter((u) => u.id !== unit.id);
        syncBuildState();
      });

      wireTraitMenus(card, unit);

      buildList.appendChild(card);
    });
  }

  function wireTraitMenus(card, unit) {
    bindMenuToggle(card, "toggle-add-race", "add-race");
    bindMenuToggle(card, "toggle-remove-race", "remove-race");
    bindMenuToggle(card, "toggle-add-class", "add-class");
    bindMenuToggle(card, "toggle-remove-class", "remove-class");

    card.querySelectorAll('[data-action="add-race"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.value;
        const traits = new Set([...unit.baseRace, ...unit.addedRace]);
        if (value && !traits.has(value)) {
          unit.addedRace.push(value);
          syncBuildState();
        }
      });
    });

    card.querySelectorAll('[data-action="add-class"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.value;
        const traits = new Set([...unit.baseClass, ...unit.addedClass]);
        if (value && !traits.has(value)) {
          unit.addedClass.push(value);
          syncBuildState();
        }
      });
    });

    card.querySelectorAll('[data-action="remove-race"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.value;
        unit.addedRace = unit.addedRace.filter((r) => r !== value);
        syncBuildState();
      });
    });

    card.querySelectorAll('[data-action="remove-class"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.value;
        unit.addedClass = unit.addedClass.filter((c) => c !== value);
        syncBuildState();
      });
    });
  }

  function bindMenuToggle(card, actionName, menuName) {
    const toggle = card.querySelector(`[data-action="${actionName}"]`);
    const menu = card.querySelector(`[data-menu="${menuName}"]`);
    if (!toggle || !menu) return;

    toggle.addEventListener("click", () => {
      const isHidden = menu.classList.contains("hidden");
      card.querySelectorAll(".menu-row").forEach((row) => row.classList.add("hidden"));
      if (isHidden) {
        menu.classList.remove("hidden");
      }
    });
  }

  function renderPills(items) {
    if (!items.length) return "<span class=\"pill\">None</span>";
    return items.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("");
  }

  function renderSynergies() {
    synergyList.innerHTML = "";

    const raceCounts = new Map();
    const classCounts = new Map();

    buildUnits.forEach((unit) => {
      const races = [...unit.baseRace, ...unit.addedRace];
      const classes = [...unit.baseClass, ...unit.addedClass];

      races.forEach((r) => raceCounts.set(r, (raceCounts.get(r) || 0) + 1));
      classes.forEach((c) => classCounts.set(c, (classCounts.get(c) || 0) + 1));
    });

    const { activeItems, inactiveItems } = buildSynergySummaries(raceCounts, classCounts);

    if (!activeItems.length && !inactiveItems.length) {
      synergyList.textContent = "No synergies configured.";
      return;
    }

    const activeHeader = document.createElement("div");
    activeHeader.className = "synergy-section-title";
    activeHeader.textContent = "Active Synergies";
    synergyList.appendChild(activeHeader);

    if (!activeItems.length) {
      const item = document.createElement("div");
      item.className = "synergy-item";
      item.textContent = "None active yet.";
      synergyList.appendChild(item);
    } else {
      activeItems.forEach((line) => {
        const item = document.createElement("div");
        item.className = "synergy-item";
        item.innerHTML = line;
        synergyList.appendChild(item);
      });
    }

    const divider = document.createElement("div");
    divider.className = "synergy-divider";
    synergyList.appendChild(divider);

    const inactiveHeader = document.createElement("div");
    inactiveHeader.className = "synergy-section-title";
    inactiveHeader.textContent = "Inactive Synergies";
    synergyList.appendChild(inactiveHeader);

    if (!inactiveItems.length) {
      const item = document.createElement("div");
      item.className = "synergy-item";
      item.textContent = "All configured synergies are active.";
      synergyList.appendChild(item);
    } else {
      inactiveItems.forEach((line) => {
        const item = document.createElement("div");
        item.className = "synergy-item";
        item.innerHTML = line;
        synergyList.appendChild(item);
      });
    }
  }

  function buildSynergySummaries(raceCounts, classCounts) {
    const wizardCount = classCounts.get("Wizard") || 0;
    const wizardActive = wizardCount >= 2;
    const activeEntries = [];
    const inactiveEntries = [];

    synergyDefs.forEach((def) => {
      const source = def.type === "race" ? raceCounts : classCounts;
      const count = source.get(def.name) || 0;
      if (count <= 0) return;

      const activePerks = [];
      const requirementText = [];

      def.levels.forEach((level, levelIdx) => {
        const adjustedRequired =
          wizardActive && levelIdx === 1 ? Math.max(1, level.required - 1) : level.required;
        const isReached = count >= adjustedRequired;
        requirementText.push(`${adjustedRequired}${wizardActive && levelIdx === 1 ? " (wiz)" : ""}`);
        if (isReached) {
          activePerks.push(`Lv${levelIdx + 1}: ${level.perk}`);
        }
      });

      const title = `${capitalize(def.type)}: ${def.name} (${count})`;
      const req = `Req: ${requirementText.join(" / ")}`;
      const perks = activePerks.length
        ? `Active: ${activePerks.map(escapeHtml).join(" | ")}`
        : "Active: none";

      const entry = {
        sortCount: count,
        title,
        html: `<strong>${escapeHtml(title)}</strong><br>${escapeHtml(req)}<br>${perks}`
      };

      if (activePerks.length) {
        activeEntries.push(entry);
      } else {
        inactiveEntries.push(entry);
      }
    });

    const sortFn = (a, b) => b.sortCount - a.sortCount || a.title.localeCompare(b.title);

    return {
      activeItems: activeEntries.sort(sortFn).map((entry) => entry.html),
      inactiveItems: inactiveEntries.sort(sortFn).map((entry) => entry.html)
    };
  }

  function saveCurrentBuild() {
    const name = buildNameInput.value.trim();
    if (!name) {
      alert("Enter a build name before saving.");
      return;
    }

    const saved = getSavedBuilds();
    saved[name] = {
      savedAt: new Date().toISOString(),
      units: buildUnits
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    refreshSavedBuildsSelect();
  }

  function loadSelectedBuild() {
    const name = savedBuildsSelect.value;
    if (!name) return;

    const saved = getSavedBuilds();
    if (!saved[name]) return;

    buildNameInput.value = name;
    buildUnits = (saved[name].units || []).map((u) => ({
      id: crypto.randomUUID(),
      name: u.name,
      cost: u.cost,
      baseRace: [...(u.baseRace || [])],
      baseClass: [...(u.baseClass || [])],
      addedRace: [...(u.addedRace || [])],
      addedClass: [...(u.addedClass || [])],
      stars: Number(u.stars) || 1
    }));

    syncBuildState();
  }

  function deleteSelectedBuild() {
    const name = savedBuildsSelect.value;
    if (!name) return;

    const saved = getSavedBuilds();
    delete saved[name];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    refreshSavedBuildsSelect();
  }

  function resetBuild() {
    buildUnits = [];
    buildNameInput.value = "";
    syncBuildState();
  }

  function syncBuildState() {
    recomputeStars();
    render();
  }

  function getSavedBuilds() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (err) {
      return {};
    }
  }

  function refreshSavedBuildsSelect() {
    const saved = getSavedBuilds();
    const names = Object.keys(saved).sort();

    savedBuildsSelect.innerHTML = '<option value="">Select saved build</option>';
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      savedBuildsSelect.appendChild(option);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function capitalize(value) {
    if (!value) return value;
    return value[0].toUpperCase() + value.slice(1);
  }
})();
