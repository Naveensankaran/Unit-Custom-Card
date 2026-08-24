// ---- Config: module + field API names ----
// NOTE: In this org, the tab labeled "Project" actually has API name "Unit",
// and the tab labeled "Unit" actually has API name "Products".
const PROJECT_MODULE = "Unit";
const UNIT_MODULE = "Products";

// Fallback photo/logo if a project has no matching image
const DEFAULT_PHOTO = "project1.jpg";
const DEFAULT_LOGO = "logo.png";

const cardGrid = document.getElementById("cardGrid");
const totalUnitsEl = document.getElementById("totalUnits");
const projectFilterEl = document.getElementById("projectFilter");
const statusFilterEl = document.getElementById("statusFilter");
const filterPanelEl = document.getElementById("filterPanel");

// Holds every unit fetched from CRM so filters can be applied client-side
// without re-fetching.
let allUnits = [];
let activeFilters = { project: "", status: "" };

function bucketStatus(status) {
  if (status === "Unsold") return "available";
  if (status === "Blocked") return "blocked";
  if (status === "Sold" || status === "Owner Share" || status === "Mortgage") return "sold";
  return "other";
}

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

async function loadData() {
  cardGrid.innerHTML = `<p style="color:#667085;">Loading units…</p>`;

  try {
    allUnits = await fetchAllRecords(UNIT_MODULE);
    populateProjectFilter(allUnits);
    applyFilters();
  } catch (err) {
    console.error("Failed to load CRM data:", err);
    cardGrid.innerHTML = `<p style="color:#c0392b;">Couldn't load data from CRM. Check console for details.</p>`;
  }
}

function populateProjectFilter(units) {
  const projectNames = [
    ...new Set(
      units
        .map((u) => u.Project && u.Project.name)
        .filter((name) => !!name)
    ),
  ].sort();

  // Preserve the "All Projects" option, rebuild the rest
  projectFilterEl.innerHTML = '<option value="">All Projects</option>';
  projectNames.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    projectFilterEl.appendChild(opt);
  });
}

function applyFilters() {
  let filtered = allUnits;

  if (activeFilters.project) {
    filtered = filtered.filter(
      (u) => u.Project && u.Project.name === activeFilters.project
    );
  }

  if (activeFilters.status) {
    filtered = filtered.filter(
      (u) => bucketStatus(u.Status || "Unsold") === activeFilters.status
    );
  }

  renderCards(filtered);
}

function statusBadgeClass(status) {
  const bucket = bucketStatus(status);
  if (bucket === "sold") return "Sold";
  if (bucket === "blocked") return "Booked"; // reuses grey style already defined
  return "Active"; // available / unsold -> default orange
}

function renderCards(units) {
  cardGrid.innerHTML = "";

  units.forEach((u) => {
    const projectName = (u.Project && u.Project.name) || "—";
    const towerName = (u.Tower && u.Tower.name) || "—";
    const floorName = (u.Floor && u.Floor.name) || "—";
    const unitName = u.Product_Name || "Unnamed Unit";
    const unitCode = u.Product_Code || "—";
    const price = u.Unit_Price
      ? "₹" + Number(u.Unit_Price).toLocaleString("en-IN")
      : "—";
    const config = u.Unit_Configuration_Name || "N/A";
    const status = u.Status || "Unsold";

    const card = document.createElement("article");
    card.className = "unit-card";

    card.innerHTML = `
      <div class="card-photo" style="background-image: url('${DEFAULT_PHOTO}');">
        <div class="logo-badge">
          <img src="${DEFAULT_LOGO}" alt="logo" />
        </div>
        <span class="status ${statusBadgeClass(status)}">${status}</span>
        <div class="photo-caption">
          <div class="unit-code" style="opacity:.9; font-weight:600;">${projectName}</div>
          <h2 class="unit-name">${unitName}</h2>
          <div class="unit-code">Code: ${unitCode}</div>
        </div>
      </div>

      <div class="card-body">
        <div class="config-badges">
          <div class="config-badge">
            <span class="bhk-tag">${config}</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="details">
          <div>
            <div class="label">Tower</div>
            <div class="value">${towerName}</div>
          </div>
          <div>
            <div class="label">Floor</div>
            <div class="value">${floorName}</div>
          </div>
          <div>
            <div class="label">Unit Price</div>
            <div class="value">${price}</div>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <button class="view-btn" data-id="${u.id}">
          View Unit
        </button>
      </div>
    `;

    cardGrid.appendChild(card);
  });

  totalUnitsEl.textContent = units.length;

  document.querySelectorAll(".view-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const recordId = button.dataset.id;
      if (ZOHO && ZOHO.CRM && ZOHO.CRM.UI && ZOHO.CRM.UI.Record) {
        ZOHO.CRM.UI.Record.open({
          Entity: UNIT_MODULE,
          RecordID: recordId
        });
      } else {
        alert("Unit record ID: " + recordId);
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

// Close the filter panel when clicking outside of it
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
