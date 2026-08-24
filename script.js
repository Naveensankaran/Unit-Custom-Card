const units = [
  {
    name: "Aparna Harmony Garden Phase II",
    code: "PRJ005",
    tower: "Tower A",
    floor: "Floor 2",
    configuration: "2 BHK",
    price: "₹50,00,000",
    status: "Active",
    photo: "assets/project1.jpg",
    logo: "assets/logo.png",
    total: 11,
    available: 11,
    blocked: 0,
    sold: 0
  },
  {
    name: "Aparna Serenity Residency",
    code: "PRJ006",
    tower: "Tower B",
    floor: "Floor 5",
    configuration: "3 BHK",
    price: "₹72,00,000",
    status: "Active",
    photo: "assets/project2.jpg",
    logo: "assets/logo.png",
    total: 37,
    available: 34,
    blocked: 2,
    sold: 0
  },
  {
    name: "Green Meadows Phase I",
    code: "PRJ007",
    tower: "Tower A",
    floor: "Floor 1",
    configuration: "2 BHK",
    price: "₹48,00,000",
    status: "Booked",
    photo: "assets/project3.jpg",
    logo: "assets/logo.png",
    total: 25,
    available: 25,
    blocked: 0,
    sold: 0
  }
];

const cardGrid = document.getElementById("cardGrid");
const totalUnits = document.getElementById("totalUnits");

function renderCards() {
  cardGrid.innerHTML = "";
  totalUnits.textContent = units.length;

  units.forEach((unit) => {
    const card = document.createElement("article");
    card.className = "unit-card";

    card.innerHTML = `
      <div class="card-photo" style="background-image: url('${unit.photo}');">
        <div class="logo-badge">
          <img src="${unit.logo}" alt="logo" />
        </div>
        <span class="status ${unit.status}">${unit.status}</span>
        <div class="photo-caption">
          <h2 class="unit-name">${unit.name}</h2>
          <div class="unit-code">${unit.tower} • Code: ${unit.code}</div>
        </div>
      </div>

      <div class="card-body">
        <div class="stat-row">
          <div class="stat-pill total">
            <span class="num">${unit.total}</span>
            <span class="lbl">Total</span>
          </div>
          <div class="stat-pill available">
            <span class="num">${unit.available}</span>
            <span class="lbl">Available</span>
          </div>
          <div class="stat-pill blocked">
            <span class="num">${unit.blocked}</span>
            <span class="lbl">Blocked</span>
          </div>
          <div class="stat-pill sold">
            <span class="num">${unit.sold}</span>
            <span class="lbl">Sold</span>
          </div>
        </div>

        <div class="config-badges">
          <div class="config-badge">
            <span class="bhk-tag">${unit.configuration}</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="details">
          <div>
            <div class="label">Floor</div>
            <div class="value">${unit.floor}</div>
          </div>
          <div>
            <div class="label">Unit Price</div>
            <div class="value">${unit.price}</div>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <button class="view-btn" data-code="${unit.code}">
          View Unit
        </button>
      </div>
    `;

    cardGrid.appendChild(card);
  });

  document.querySelectorAll(".view-btn").forEach((button) => {
    button.addEventListener("click", () => {
      alert("Selected Unit: " + button.dataset.code);
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
  renderCards();
});

ZOHO.embeddedApp.init();
