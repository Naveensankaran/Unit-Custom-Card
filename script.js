// ---- Config: module + field API names ----
// NOTE: In this org, the tab labeled "Project" actually has API name "Unit",
// and the tab labeled "Unit" actually has API name "Products".
const PROJECT_MODULE = "Unit";       // Project records live here
const UNIT_MODULE = "Products";      // Unit records live here

// Fallback photo/logo if a project has no Record_Image
const DEFAULT_PHOTO = "project1.jpg";
const DEFAULT_LOGO = "logo.png";

// Field on the Project module that holds the project photo (Image upload field)
const PROJECT_IMAGE_FIELD = "Record_Image";

const cardGrid = document.getElementById("cardGrid");
const totalUnitsEl = document.getElementById("totalUnits");
const projectFilterEl = document.getElementById("projectFilter");
const statusFilterEl = document.getElementById("statusFilter");
const filterPanelEl = document.getElementById("filterPanel");

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

// Pulls a usable image URL out of an Image-type field, whatever shape the
// API happens to hand back (plain string vs. object with a url-ish key).
function resolveImageUrl(fieldValue) {
  if (!fieldValue) return null;
  if (typeof fieldValue === "string") return fieldValue;
  if (typeof fieldValue === "object") {
    return (
      fieldValue.url ||
      fieldValue.download_url ||
      fieldValue.__unstable__url ||
      null
    );
  }
  return null;
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

    projectCards = buildProjectCards(allProjects, allUnits);
    populateProjectFilter(projectCards);
    applyFilters();
  } catch (err) {
    console.error("Failed to load CRM data:", err);
    cardGrid.innerHTML = `<p style="color:#c0392b;">Couldn't load data from CRM. Check console for details.</p>`;
  }
}

// Groups units under their parent project and tallies each status bucket.
function buildProjectCards(projects, units) {
  const unitsByProjectId = {};

  units.forEach((u) => {
    const projId = u.Project && u.Project.id;
    if (!projId) return;
    if (!unitsByProjectId[projId]) unitsByProjectId[projId] = [];
    unitsByProjectId[projId].push(u);
  });

  return projects.map((p) => {
    const projUnits = unitsByProjectId[p.id] || [];

    const stats = {};
    STATUS_KEYS.forEach((key) => (stats[key] = 0));

    projUnits.forEach((u) => {
      const status = u.Status || "Unsold";
      if (stats.hasOwnProperty(status)) {
        stats[status] += 1;
      }
    });

    return {
      project: p,
      total: projUnits.length,
      stats,
      imageUrl: resolveImageUrl(p[PROJECT_IMAGE_FIELD])
    };
  });
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
          <div class="stat-pill total">
            <span class="num">${c.total}</span>
            <span class="lbl">Total</span>
          </div>
          <div class="stat-pill available">
            <span class="num">${c.stats["Unsold"]}</span>
            <span class="lbl">Available</span>
          </div>
          <div class="stat-pill sold">
            <span class="num">${c.stats["Sold"]}</span>
            <span class="lbl">Sold</span>
          </div>
        </div>
        <div class="stat-row">
          <div class="stat-pill owner-share">
            <span class="num">${c.stats["Owner Share"]}</span>
            <span class="lbl">Owner Share</span>
          </div>
          <div class="stat-pill blocked">
            <span class="num">${c.stats["Blocked"]}</span>
            <span class="lbl">Blocked</span>
          </div>
          <div class="stat-pill mortgage">
            <span class="num">${c.stats["Mortgage"]}</span>
            <span class="lbl">Mortgage</span>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <button class="view-btn" data-id="${c.project.id}">
          View Project
        </button>
      </div>
    `;

    cardGrid.appendChild(card);
  });

  totalUnitsEl.textContent = cards.reduce((sum, c) => sum + c.total, 0);

  document.querySelectorAll(".view-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const recordId = button.dataset.id;
      if (ZOHO && ZOHO.CRM && ZOHO.CRM.UI && ZOHO.CRM.UI.Record) {
        ZOHO.CRM.UI.Record.open({
          Entity: PROJECT_MODULE,
          RecordID: recordId
        });
      } else {
        alert("Project record ID: " + recordId);
      }
    });
  });
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

ZOHO.embeddedApp.on("PageLoad", function (data) {
  loadData();
});

ZOHO.embeddedApp.init();
