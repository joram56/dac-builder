(function () {
  const STORAGE_KEY = "dac_builder_saved_builds";

  const buildList = document.getElementById("build-list");
  const buildTitle = document.getElementById("build-title");
  const synergyList = document.getElementById("synergy-list");
  const unitBrowser = document.getElementById("unit-browser");
  const filterGroups = document.getElementById("filter-groups");
  const buildNameInput = document.getElementById("build-name");
  const saveBuildBtn = document.getElementById("save-build-btn");
  const newBuildBtn = document.getElementById("new-build-btn");
  const savedBuildsSelect = document.getElementById("saved-builds");
  const loadBuildBtn = document.getElementById("load-build-btn");
  const deleteBuildBtn = document.getElementById("delete-build-btn");
  const clearFiltersBtn = document.getElementById("clear-filters-btn");

  const allUnits = flattenUnits(window.UNITS_BY_COST || {});
  const synergyDefs = window.SYNERGY_DEFS || [];
  const unitByName = new Map(allUnits.map((u) => [u.name, u]));
  const allTraits = collectAllTraits(allUnits);
  const filters = {
    cost: new Set(),
    race: new Set(),
    class: new Set()
  };

  let buildUnits = [];

  init();

  function init() {
    renderFilterGroups();
    refreshSavedBuildsSelect();
    render();

    saveBuildBtn.addEventListener("click", saveCurrentBuild);
    newBuildBtn.addEventListener("click", resetBuild);
    loadBuildBtn.addEventListener("click", loadSelectedBuild);
    deleteBuildBtn.addEventListener("click", deleteSelectedBuild);
    clearFiltersBtn.addEventListener("click", clearFilters);
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

  function addUnitByName(name) {
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

  function removeUnitByName(name) {
    const index = buildUnits.findIndex((unit) => unit.name === name);
    if (index === -1) return;
    buildUnits.splice(index, 1);
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
    renderBuildTitle();
    renderUnitBrowser();
    renderBuildUnits();
    renderSynergies();
  }

  function renderBuildTitle() {
    buildTitle.textContent = `Current Build (${buildUnits.length})`;
  }

  function renderFilterGroups() {
    const groups = [
      {
        key: "cost",
        label: "Cost",
        values: ["1", "2", "3", "4", "5"]
      },
      {
        key: "race",
        label: "Races",
        values: allTraits.race
      },
      {
        key: "class",
        label: "Classes",
        values: allTraits.class
      }
    ];

    filterGroups.innerHTML = groups
      .map(
        (group) => `
          <section class="filter-group">
            <div class="filter-label">${escapeHtml(group.label)}</div>
            <div class="filter-pill-row">
              ${group.values
                .map(
                  (value) => `
                    <button
                      type="button"
                      class="filter-pill"
                      data-filter-group="${escapeHtml(group.key)}"
                      data-filter-value="${escapeHtml(value)}"
                    >
                      ${escapeHtml(formatFilterLabel(group.key, value))}
                    </button>
                  `
                )
                .join("")}
            </div>
          </section>
        `
      )
      .join("");

    filterGroups.querySelectorAll(".filter-pill").forEach((button) => {
      button.addEventListener("click", () => {
        const group = button.dataset.filterGroup;
        const value = button.dataset.filterValue;
        toggleFilter(group, value);
      });
    });
  }

  function renderUnitBrowser() {
    const copyCounts = getBuildUnitCounts();
    const visibleUnits = allUnits.filter(matchesFilters);

    updateFilterPillState();
    unitBrowser.innerHTML = "";

    if (!visibleUnits.length) {
      unitBrowser.textContent = "No units match the selected filters.";
      return;
    }

    const unitsByCost = groupUnitsByCost(visibleUnits);

    Object.keys(unitsByCost)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((cost) => {
        const section = document.createElement("section");
        section.className = "browser-cost-group";

        const heading = document.createElement("div");
        heading.className = "browser-cost-heading";
        heading.textContent = `${cost}g`;
        section.appendChild(heading);

        const list = document.createElement("div");
        list.className = "browser-cost-list";

        unitsByCost[cost].forEach((unit) => {
          const item = document.createElement("article");
          item.className = "browser-unit";

          const copyCount = copyCounts.get(unit.name) || 0;
          const raceText = unit.race.length ? unit.race.join(", ") : "None";
          const classText = unit.class.length ? unit.class.join(", ") : "None";

          item.innerHTML = `
            <div class="browser-unit-main">
              <div class="browser-unit-name">${escapeHtml(unit.name)}</div>
              <div class="browser-unit-meta">${unit.cost}g</div>
              <div class="browser-unit-traits">${escapeHtml(raceText)} | ${escapeHtml(classText)}</div>
            </div>
            <div class="browser-unit-actions">
              <span class="copy-count">${copyCount}</span>
              <button type="button" class="mini-btn" data-action="remove-browser">-</button>
              <button type="button" class="mini-btn" data-action="add-browser">+</button>
            </div>
          `;

          item.querySelector('[data-action="add-browser"]').addEventListener("click", () => {
            addUnitByName(unit.name);
          });

          item.querySelector('[data-action="remove-browser"]').addEventListener("click", () => {
            removeUnitByName(unit.name);
          });

          list.appendChild(item);
        });

        section.appendChild(list);
        unitBrowser.appendChild(section);
      });
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
        <div class="menu-row hidden ${addableRace.length ? "" : "empty-menu"}" data-menu="add-race">
          <select data-action="add-race-select">
            <option value="">Select race to add</option>
            ${addableRace.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("")}
          </select>
        </div>
        <div class="menu-row hidden ${removableRace.length ? "" : "empty-menu"}" data-menu="remove-race">
          <select data-action="remove-race-select">
            <option value="">Select race to remove</option>
            ${removableRace.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("")}
          </select>
        </div>

        <div class="trait-line">
          <strong>Class</strong>
          <div class="trait-controls">
            <button type="button" class="mini-btn" data-action="toggle-add-class">+</button>
            <button type="button" class="mini-btn" data-action="toggle-remove-class">-</button>
          </div>
        </div>
        <div>${renderPills(allClass)}</div>
        <div class="menu-row hidden ${addableClass.length ? "" : "empty-menu"}" data-menu="add-class">
          <select data-action="add-class-select">
            <option value="">Select class to add</option>
            ${addableClass.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
          </select>
        </div>
        <div class="menu-row hidden ${removableClass.length ? "" : "empty-menu"}" data-menu="remove-class">
          <select data-action="remove-class-select">
            <option value="">Select class to remove</option>
            ${removableClass.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
          </select>
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

  function getBuildUnitCounts() {
    const counts = new Map();
    buildUnits.forEach((unit) => {
      counts.set(unit.name, (counts.get(unit.name) || 0) + 1);
    });
    return counts;
  }

  function groupUnitsByCost(units) {
    return units.reduce((groups, unit) => {
      const key = String(unit.cost);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(unit);
      return groups;
    }, {});
  }

  function wireTraitMenus(card, unit) {
    bindMenuToggle(card, "toggle-add-race", "add-race");
    bindMenuToggle(card, "toggle-remove-race", "remove-race");
    bindMenuToggle(card, "toggle-add-class", "add-class");
    bindMenuToggle(card, "toggle-remove-class", "remove-class");

    const addRaceSelect = card.querySelector('[data-action="add-race-select"]');
    if (addRaceSelect) {
      addRaceSelect.addEventListener("change", () => {
        const value = addRaceSelect.value;
        const traits = new Set([...unit.baseRace, ...unit.addedRace]);
        if (value && !traits.has(value)) {
          unit.addedRace.push(value);
          syncBuildState();
        }
      });
    }

    const addClassSelect = card.querySelector('[data-action="add-class-select"]');
    if (addClassSelect) {
      addClassSelect.addEventListener("change", () => {
        const value = addClassSelect.value;
        const traits = new Set([...unit.baseClass, ...unit.addedClass]);
        if (value && !traits.has(value)) {
          unit.addedClass.push(value);
          syncBuildState();
        }
      });
    }

    const removeRaceSelect = card.querySelector('[data-action="remove-race-select"]');
    if (removeRaceSelect) {
      removeRaceSelect.addEventListener("change", () => {
        const value = removeRaceSelect.value;
        unit.addedRace = unit.addedRace.filter((r) => r !== value);
        syncBuildState();
      });
    }

    const removeClassSelect = card.querySelector('[data-action="remove-class-select"]');
    if (removeClassSelect) {
      removeClassSelect.addEventListener("change", () => {
        const value = removeClassSelect.value;
        unit.addedClass = unit.addedClass.filter((c) => c !== value);
        syncBuildState();
      });
    }
  }

  function bindMenuToggle(card, actionName, menuName) {
    const toggle = card.querySelector(`[data-action="${actionName}"]`);
    const menu = card.querySelector(`[data-menu="${menuName}"]`);
    if (!toggle || !menu) return;

    toggle.addEventListener("click", () => {
      if (menu.classList.contains("empty-menu")) return;
      const isHidden = menu.classList.contains("hidden");
      card.querySelectorAll(".menu-row").forEach((row) => row.classList.add("hidden"));
      if (isHidden) {
        menu.classList.remove("hidden");
        const select = menu.querySelector("select");
        if (select) select.focus();
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
    const evaluatedEntries = [];

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

      evaluatedEntries.push({
        def,
        count,
        activePerks,
        sortCount: count,
        title,
        req,
        perks
      });
    });

    const demonHunterEntry = evaluatedEntries.find((entry) => entry.def.name === "Demon Hunter");
    const demonHunterActive = Boolean(demonHunterEntry && demonHunterEntry.activePerks.length);

    evaluatedEntries.forEach((entry) => {
      if (entry.def.name === "Demon") {
        const demonIsActive = entry.count === 1 || demonHunterActive;
        entry.activePerks = demonIsActive ? entry.activePerks : [];
      }
    });

    const otherSynergiesActive = evaluatedEntries.some((entry) => {
      if (entry.def.name === "Faceless") return false;
      return entry.activePerks.length > 0;
    });

    evaluatedEntries.forEach((entry) => {
      if (entry.def.name === "Faceless") {
        entry.activePerks = otherSynergiesActive ? [] : entry.activePerks;
      }

      entry.perks = entry.activePerks.length
        ? `Active: ${entry.activePerks.map(escapeHtml).join(" | ")}`
        : "Active: none";
      entry.html = `<strong>${escapeHtml(entry.title)}</strong><br>${escapeHtml(entry.req)}<br>${entry.perks}`;

      if (entry.activePerks.length) {
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

  function toggleFilter(group, value) {
    const selected = filters[group];
    if (!selected) return;

    if (selected.has(value)) {
      selected.delete(value);
    } else {
      selected.add(value);
    }

    renderUnitBrowser();
  }

  function clearFilters() {
    Object.values(filters).forEach((set) => set.clear());
    renderUnitBrowser();
  }

  function matchesFilters(unit) {
    if (filters.cost.size && !filters.cost.has(String(unit.cost))) {
      return false;
    }

    if (filters.race.size && !unit.race.some((race) => filters.race.has(race))) {
      return false;
    }

    if (filters.class.size && !unit.class.some((unitClass) => filters.class.has(unitClass))) {
      return false;
    }

    return true;
  }

  function updateFilterPillState() {
    filterGroups.querySelectorAll(".filter-pill").forEach((button) => {
      const group = button.dataset.filterGroup;
      const value = button.dataset.filterValue;
      button.classList.toggle("is-active", filters[group] && filters[group].has(value));
    });
  }

  function formatFilterLabel(group, value) {
    return group === "cost" ? `${value}g` : value;
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
