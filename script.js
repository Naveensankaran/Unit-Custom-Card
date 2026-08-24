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
  cardGrid.innerHTML = `<p style="color:#667085;">Loading projects…</p>`;

  try {
    const [projects, units] = await Promise.all([
      fetchAllRecords(PROJECT_MODULE),
      fetchAllRecords(UNIT_MODULE)
    ]);

    const projectMap = {};
    projects.forEach((p) => {
      projectMap[p.id] = {
        id: p.id,
        name: p.Name || "Untitled Project",
        units: [],
        configCounts: {}
      };
    });

    units.forEach((u) => {
      const pid = u.Project && u.Project.id;
      if (pid && projectMap[pid]) {
        projectMap[pid].units.push(u);

        const cfg = u.Unit_Configuration_Name || "N/A";
        projectMap[pid].configCounts[cfg] =
          (projectMap[pid].configCounts[cfg] || 0) + 1;
      }
    });

    renderCards(Object.values(projectMap));
  } catch (err) {
    console.error("Failed to load CRM data:", err);
    cardGrid.innerHTML = `<p style="color:#c0392b;">Couldn't load data from CRM. Check console for details.</p>`;
  }
}

function renderCards(projectList) {
  cardGrid.innerHTML = "";

  let grandTotal = 0;

  projectList.forEach((project) => {
    const total = project.units.length;
    grandTotal += total;

    let available = 0,
      blocked = 0,
      sold = 0;

    project.units.forEach((u) => {
      const bucket = bucketStatus(u.Status);
      if (bucket === "available") available++;
      else if (bucket === "blocked") blocked++;
      else if (bucket === "sold") sold++;
    });

    const statusLabel = available > 0 ? "Ongoing" : "Completed";

    const configBadges = Object.entries(project.configCounts)
      .map(
        ([cfg, count]) =>
          `<div class="config-badge"><span class="bhk-tag">${cfg}</span> ${count}</div>`
      )
      .join("");

    const card = document.createElement("article");
    card.className = "unit-card";

    card.innerHTML = `
      <div class="card-photo" style="background-image: url('${DEFAULT_PHOTO}');">
        <div class="logo-badge">
          <img src="${DEFAULT_LOGO}" alt="logo" />
        </div>
        <span class="status ${statusLabel}">${statusLabel}</span>
        <div class="photo-caption">
          <h2 class="unit-name">${project.name}</h2>
        </div>
      </div>

      <div class="card-body">
        <div class="stat-row">
          <div class="stat-pill total">
            <span class="num">${total}</span>
            <span class="lbl">Total</span>
          </div>
          <div class="stat-pill available">
            <span class="num">${available}</span>
            <span class="lbl">Available</span>
          </div>
          <div class="stat-pill blocked">
            <span class="num">${blocked}</span>
            <span class="lbl">Blocked</span>
          </div>
          <div class="stat-pill sold">
            <span class="num">${sold}</span>
            <span class="lbl">Sold</span>
          </div>
        </div>

        <div class="config-badges">
          ${configBadges || `<span style="color:#8f9ac2; font-size:12px;">No units yet</span>`}
        </div>

        <div class="divider"></div>
      </div>

      <div class="card-footer">
        <button class="view-btn" data-id="${project.id}">
          View Project
        </button>
      </div>
    `;

    cardGrid.appendChild(card);
  });

  totalUnitsEl.textContent = grandTotal;

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
  alert("We will connect this button to Zoho CRM later.");
});

document.getElementById("filterBtn").addEventListener("click", () => {
  alert("Filtering will be connected later.");
});

ZOHO.embeddedApp.on("PageLoad", function (data) {
  loadData();
});

ZOHO.embeddedApp.init();
