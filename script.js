// ---- Config: module + field API names ----
// NOTE: In this org, the tab labeled "Project" actually has API name "Unit",
// and the tab labeled "Unit" actually has API name "Products".
const PROJECT_MODULE = "Unit";       // Project records live here
const UNIT_MODULE = "Products";      // Unit records live here

// Fallback photo/logo if a project has no photo or the fetch fails
const DEFAULT_PHOTO = "project1.jpg";
const DEFAULT_LOGO = "logo.png";

// Name of the Deluge function (Setup > Functions) that proxies the
// authenticated record-photo download and returns it base64-encoded.
const PHOTO_FUNCTION_NAME = "getprojectphoto";

const cardGrid = document.getElementById("cardGrid");
const totalUnitsEl = document.getElementById("totalUnits");
const projectFilterEl = document.getElementById("projectFilter");
const statusFilterEl = document.getElementById("statusFilter");
const filterPanelEl = document.getElementById("filterPanel");
const unitModalOverlayEl = document.getElementById("unitModalOverlay");
const unitModalTitleEl = document.getElementById("unitModalTitle");
const unitModalBodyEl = document.getElementById("unitModalBody");
const unitModalCloseBtnEl = document.getElementById("unitModalCloseBtn");

// Raw CRM status values we roll up into per-project stat pills
const STATUS_KEYS = ["Unsold", "Sold", "Owner Share", "Blocked", "Mortgage"];

let allProjects = [];   // raw Project records
let allUnits = [];      // raw Unit (Products) records
let projectCards = [];  // [{ project, stats: {...}, total }]
let activeFilters = { project: "", status: "" };

async function fetchAllRecords(entity) {
  let allRecords = [];
  let page = 1;
  let moreRecords = true;

  while (moreRecords) {
    const response = await ZOHO.CRM.API.getAllRecords({
      Entity: entity,
      sort_order: "asc",
      per_page: 200,
      page: page
    });

    if (response && response.data) {
      allRecords = allRecords.concat(response.data);
    }

    moreRecords =
      response &&
      response.info &&
      response.info.more_records === true;
    page += 1;
  }

  return allRecords;
}

// Calls the Deluge function to fetch a project's native record photo,
// server-side, and returns a usable data: URL — or null if it has none.
async function fetchProjectPhoto(recordId) {
  try {
    const result = await ZOHO.CRM.FUNCTIONS.execute(PHOTO_FUNCTION_NAME, {
      arguments: JSON.stringify({ id: recordId })
    });

    const output = result && result.details && result.details.output;
    const parsed = output ? JSON.parse(output) : null;
    const base64 = parsed ? parsed.base64 : null;

    return base64 ? `data:image/jpeg;base64,${base64}` : null;
  } catch (err) {
    console.error("Failed to fetch photo for record " + recordId, err);
    return null;
  }
}

async function loadData() {
  cardGrid.innerHTML = `<p style="color:#667085;">Loading projects…</p>`;

  try {
    const [projects, units] = await Promise.all([
      fetchAllRecords(PROJECT_MODULE),
      fetchAllRecords(UNIT_MODULE)
    ]);

    allProjects = projects;
    allUnits = units;

    projectCards = await buildProjectCards(allProjects, allUnits);
    populateProjectFilter(projectCards);
    applyFilters();
  } catch (err) {
    console.error("Failed to load CRM data:", err);
    cardGrid.innerHTML = `<p style="color:#c0392b;">Couldn't load data from CRM. Check console for details.</p>`;
  }
}

// Groups units under their parent project, tallies each status bucket, and
// fetches each project's native record photo (in parallel) via Deluge.
async function buildProjectCards(projects, units) {
  const unitsByProjectId = {};

  units.forEach((u) => {
    const projId = u.Project && u.Project.id;
    if (!projId) return;
    if (!unitsByProjectId[projId]) unitsByProjectId[projId] = [];
    unitsByProjectId[projId].push(u);
  });

  return Promise.all(
    projects.map(async (p) => {
      const projUnits = unitsByProjectId[p.id] || [];

      const stats = {};
      STATUS_KEYS.forEach((key) => (stats[key] = 0));

      projUnits.forEach((u) => {
        const status = u.Status || "Unsold";
        if (stats.hasOwnProperty(status)) {
          stats[status] += 1;
        }
      });

      const imageUrl = await fetchProjectPhoto(p.id);

      return {
        project: p,
        total: projUnits.length,
        stats,
        imageUrl
      };
    })
  );
}

function populateProjectFilter(cards) {
  const projectNames = [...new Set(cards.map((c) => c.project.Name).filter(Boolean))].sort();

  projectFilterEl.innerHTML = '<option value="">All Projects</option>';
  projectNames.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    projectFilterEl.appendChild(opt);
  });
}

function applyFilters() {
  let filtered = projectCards;

  if (activeFilters.project) {
    filtered = filtered.filter((c) => c.project.Name === activeFilters.project);
  }

  // With project-level cards, the status filter narrows to projects that
  // actually have at least one unit in that status.
  if (activeFilters.status) {
    filtered = filtered.filter((c) => (c.stats[activeFilters.status] || 0) > 0);
  }

  renderCards(filtered);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

function statusBadgeClass(status) {
  if (status === "Sold") return "Sold";
  if (status === "Blocked") return "Booked"; // reuses existing grey/green style
  return "Active"; // Unsold / Owner Share / Mortgage -> default orange
}

function renderCards(cards) {
  cardGrid.innerHTML = "";

  cards.forEach((c) => {
    const projectName = c.project.Name || "Unnamed Project";
    const photoUrl = c.imageUrl || DEFAULT_PHOTO;

    const card = document.createElement("article");
    card.className = "unit-card";

    card.innerHTML = `
      <div class="card-photo" style="background-image: url('${photoUrl}');">
        <div class="logo-badge">
          <img src="${DEFAULT_LOGO}" alt="logo" />
        </div>
        <div class="photo-caption">
          <h2 class="unit-name">${escapeHtml(projectName)}</h2>
        </div>
      </div>

      <div class="card-body">
        <div class="stat-row">
          <div class="stat-pill total" data-project-id="${c.project.id}" data-project-name="${escapeHtml(projectName)}" data-status="">
            <span class="num">${c.total}</span>
            <span class="lbl">Total</span>
          </div>
          <div class="stat-pill available" data-project-id="${c.project.id}" data-project-name="${escapeHtml(projectName)}" data-status="Unsold">
            <span class="num">${c.stats["Unsold"]}</span>
            <span class="lbl">Available</span>
          </div>
          <div class="stat-pill sold" data-project-id="${c.project.id}" data-project-name="${escapeHtml(projectName)}" data-status="Sold">
            <span class="num">${c.stats["Sold"]}</span>
            <span class="lbl">Sold</span>
          </div>
        </div>
        <div class="stat-row">
          <div class="stat-pill owner-share" data-project-id="${c.project.id}" data-project-name="${escapeHtml(projectName)}" data-status="Owner Share">
            <span class="num">${c.stats["Owner Share"]}</span>
            <span class="lbl">Owner Share</span>
          </div>
          <div class="stat-pill blocked" data-project-id="${c.project.id}" data-project-name="${escapeHtml(projectName)}" data-status="Blocked">
            <span class="num">${c.stats["Blocked"]}</span>
            <span class="lbl">Blocked</span>
          </div>
          <div class="stat-pill mortgage" data-project-id="${c.project.id}" data-project-name="${escapeHtml(projectName)}" data-status="Mortgage">
            <span class="num">${c.stats["Mortgage"]}</span>
            <span class="lbl">Mortgage</span>
          </div>
        </div>
      </div>
    `;

    cardGrid.appendChild(card);
  });

  totalUnitsEl.textContent = cards.reduce((sum, c) => sum + c.total, 0);

  // Each stat pill drills down into the matching units for that project.
  document.querySelectorAll(".stat-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const projectId = pill.dataset.projectId;
      const status = pill.dataset.status; // "" means all statuses (Total pill)
      const projectName = pill.dataset.projectName;
      const label = pill.querySelector(".lbl").textContent;
      openUnitModal(projectId, status, `${projectName} — ${label}`);
    });
  });
}

function openUnitModal(projectId, status, title) {
  const matches = allUnits.filter((u) => {
    const belongsToProject = u.Project && u.Project.id === projectId;
    if (!belongsToProject) return false;
    if (!status) return true;
    return (u.Status || "Unsold") === status;
  });

  unitModalTitleEl.textContent = title;
  unitModalBodyEl.innerHTML = "";

  if (matches.length === 0) {
    unitModalBodyEl.innerHTML = `<p class="modal-empty">No units found.</p>`;
  } else {
    const grid = document.createElement("div");
    grid.className = "unit-card-grid";

    matches.forEach((u) => {
      const unitName = u.Product_Name || "Unnamed Unit";
      const unitCode = u.Product_Code || "—";
      const towerName = (u.Tower && u.Tower.name) || "—";
      const floorName = (u.Floor && u.Floor.name) || "—";
      const price = u.Unit_Price ? "₹" + Number(u.Unit_Price).toLocaleString("en-IN") : "—";
      const status = u.Status || "Unsold";

      const card = document.createElement("div");
      card.className = "unit-card-simple";
      card.innerHTML = `
        <div class="unit-card-simple-top">
          <div>
            <div class="unit-card-simple-name">${escapeHtml(unitName)}</div>
            <div class="unit-card-simple-code">Code: ${escapeHtml(unitCode)}</div>
          </div>
          <span class="status ${statusBadgeClass(status)}">${escapeHtml(status)}</span>
        </div>
        <div class="unit-card-simple-details">
          <div>
            <div class="label">Tower</div>
            <div class="value">${escapeHtml(towerName)}</div>
          </div>
          <div>
            <div class="label">Floor</div>
            <div class="value">${escapeHtml(floorName)}</div>
          </div>
          <div>
            <div class="label">Unit Price</div>
            <div class="value">${escapeHtml(price)}</div>
          </div>
        </div>
        <button class="unit-card-simple-view-btn" data-id="${u.id}">View Unit</button>
      `;
      grid.appendChild(card);
    });

    unitModalBodyEl.appendChild(grid);
  }

  unitModalBodyEl.querySelectorAll(".unit-card-simple-view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const recordId = btn.dataset.id;
      if (ZOHO && ZOHO.CRM && ZOHO.CRM.UI && ZOHO.CRM.UI.Record) {
        ZOHO.CRM.UI.Record.open({ Entity: UNIT_MODULE, RecordID: recordId });
      } else {
        alert("Unit record ID: " + recordId);
      }
    });
  });

  unitModalOverlayEl.classList.add("open");
}

function closeUnitModal() {
  unitModalOverlayEl.classList.remove("open");
}

document.getElementById("addUnitBtn").addEventListener("click", () => {
  if (ZOHO && ZOHO.CRM && ZOHO.CRM.UI && ZOHO.CRM.UI.Record) {
    ZOHO.CRM.UI.Record.create({ Entity: UNIT_MODULE });
  } else {
    alert("Couldn't open the create page — Zoho SDK not available.");
  }
});

document.getElementById("filterBtn").addEventListener("click", () => {
  filterPanelEl.classList.toggle("open");
});

document.getElementById("filterApplyBtn").addEventListener("click", () => {
  activeFilters.project = projectFilterEl.value;
  activeFilters.status = statusFilterEl.value;
  applyFilters();
  filterPanelEl.classList.remove("open");
});

document.getElementById("filterClearBtn").addEventListener("click", () => {
  projectFilterEl.value = "";
  statusFilterEl.value = "";
  activeFilters = { project: "", status: "" };
  applyFilters();
  filterPanelEl.classList.remove("open");
});

document.addEventListener("click", (e) => {
  const wrap = document.querySelector(".filter-wrap");
  if (wrap && !wrap.contains(e.target)) {
    filterPanelEl.classList.remove("open");
  }
});

unitModalCloseBtnEl.addEventListener("click", closeUnitModal);

unitModalOverlayEl.addEventListener("click", (e) => {
  if (e.target === unitModalOverlayEl) closeUnitModal();
});

ZOHO.embeddedApp.on("PageLoad", function (data) {
  loadData();
});

ZOHO.embeddedApp.init();
