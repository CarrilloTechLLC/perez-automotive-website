/* Perez Automotive static website + localStorage dealership portal.
   This first version saves records in the browser so it can deploy instantly on GitHub + Cloudflare Pages.
   Replace the storage helpers with Cloudflare D1 calls later for multi-user production data. */

const DB_KEY = "perezAutomotivePortal.v1";
const SESSION_KEY = "perezAutomotiveUser.v1";
const CLOUD_API = "/api/db";
const DISCORD_ALERT_API = "/api/discord-alert";
const DISCORD_INVITE_URL = "https://discord.gg/EpKfSMNBXm";
let CLOUD_READY = false;
let CLOUD_SYNC_TIMER = null;

const roles = {
  owner: "Owner / President",
  coowner: "Co-Owner / Vice President",
  gm: "General Manager",
  sourcer: "Vehicle Sourcing Manager",
  sales: "Sales & Finance Representative",
  clerk: "Service & Inventory Clerk"
};

const demoUsers = [
  { email: "owner@perezauto.com", password: "owner123", name: "Giovanni Perez", role: "owner" },
  { email: "coowner@perezauto.com", password: "coowner123", name: "Savannah Perez", role: "coowner" },
  { email: "manager@perezauto.com", password: "manager123", name: "Alex Moreno", role: "gm" },
  { email: "sourcer@perezauto.com", password: "sourcer123", name: "Marco Vega", role: "sourcer" },
  { email: "sales@perezauto.com", password: "sales123", name: "Elena Cruz", role: "sales" },
  { email: "clerk@perezauto.com", password: "clerk123", name: "Dante Ruiz", role: "clerk" }
];

const services = [
  ["Sales", "Used Vehicle Sales", "Premium pre-owned vehicles prepared for serious Los Santos buyers."],
  ["Source", "Vehicle Sourcing", "Staff can submit sourcing leads and purchase requests for approval."],
  ["Trade", "Trade-Ins", "Clean trade-in and consignment records for every customer deal."],
  ["Build", "Custom Builds", "Luxury performance, cosmetics, and special-order automotive builds."],
  ["Repair", "Repairs", "Mechanical service notes, cost tracking, and vehicle readiness records."],
  ["Detail", "Detailing", "Showroom-ready detailing and inspection notes before listing."],
  ["Care", "Customer Service", "Professional service from first contact through final delivery."],
  ["Consign", "Consignment Sales", "Manual records for third-party sales without real payment processing."]
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const now = () => new Date().toLocaleString();
const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const number = (value) => Number(value || 0);
const id = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const proofLink = (url) => url ? `<a class="gold" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open proof</a>` : `<span class="muted">No proof</span>`;
const initials = (name = "") => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("") || "PA";
const isManagementRole = (user = currentUser()) => user && ["owner", "coowner", "gm"].includes(user.role);

function staffDefaults(s = {}, index = 0) {
  return {
    publicVisible: s.publicVisible !== false && s.showOnAbout !== "No",
    showOnAbout: s.showOnAbout || (s.publicVisible === false ? "No" : "Yes"),
    photo: s.photo || "",
    bio: s.bio || s.notes || "",
    displayOrder: Number.isFinite(Number(s.displayOrder)) ? Number(s.displayOrder) : index + 1
  };
}



function cleanInCharacterCopy(value) {
  if (typeof value === "string") {
    const termA = String.fromCharCode(71,84,65);
    const termB = String.fromCharCode(69,99,108,105,112,115,101);
    const termC = String.fromCharCode(82,80);
    const termD = String.fromCharCode(114,111,108,101,112,108,97,121);
    return value
      .replace(new RegExp(`${termA}\\/${termB} ${termC}`, "gi"), "")
      .replace(new RegExp(`${termA}\\s*V?\\s*${termC}`, "gi"), "")
      .replace(new RegExp(`${termB} ${termC}`, "gi"), "")
      .replace(new RegExp(`\\b${termC}\\b`, "gi"), "business")
      .replace(new RegExp(termD, "gi"), "business")
      .replace(/manual business business records/gi, "manual business records")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+:/g, ":")
      .trim();
  }
  if (Array.isArray(value)) return value.map(cleanInCharacterCopy);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = cleanInCharacterCopy(value[key]);
  }
  return value;
}


function normalizeDB(db) {
  const seeded = seedData();
  const beforeClean = JSON.stringify(db);
  cleanInCharacterCopy(db);
  let changed = JSON.stringify(db) !== beforeClean;
  for (const key of ["inventory", "applications", "purchaseRequests", "sales", "customers", "staff", "treasury", "payouts", "logs"]) {
    if (!Array.isArray(db[key])) { db[key] = seeded[key] || []; changed = true; }
  }
  db.staff = db.staff.map((member, index) => {
    const merged = { ...staffDefaults(member, index), ...member };
    if (merged.publicVisible !== (member.publicVisible ?? true) || !member.showOnAbout || !Object.prototype.hasOwnProperty.call(member, "displayOrder")) changed = true;
    return merged;
  });
  return { db, changed };
}

function seedData() {
  return {
    inventory: [
      { id: id("veh"), stock: "PA-001", model: "Benefactor Schafter V12", photo: "", purchasedFrom: "Private seller", sourcedBy: "Marco Vega", soldBy: "", purchasePrice: 52000, repairCost: 3500, detailCost: 800, totalCost: 56300, listingPrice: 78500, lowestPrice: 72000, status: "Available", salePrice: 0, profit: 0, notes: "Luxury sedan. Clean paint. Ready for premium listing.", proof: "" },
      { id: id("veh"), stock: "PA-002", model: "Ubermacht Sentinel Classic", photo: "", purchasedFrom: "Auction lead", sourcedBy: "Giovanni Perez", soldBy: "Elena Cruz", purchasePrice: 38000, repairCost: 4200, detailCost: 700, totalCost: 42900, listingPrice: 64000, lowestPrice: 59000, status: "Sold", salePrice: 61500, profit: 18600, notes: "Sold after full detail and inspection.", proof: "" },
      { id: id("veh"), stock: "PA-003", model: "Enus Windsor Drop", photo: "", purchasedFrom: "Consignment customer", sourcedBy: "Alex Moreno", soldBy: "", purchasePrice: 73000, repairCost: 0, detailCost: 1200, totalCost: 74200, listingPrice: 99000, lowestPrice: 92500, status: "Pending", salePrice: 0, profit: 0, notes: "Pending final paperwork and inspection.", proof: "" }
    ],
    applications: [
      { id: id("app"), name: "Luis Ortega", phone: "555-0138", position: "Sales & Finance Representative", experience: "Prior dealership desk work and customer service.", availability: "Evenings and weekends", why: "I want to build a serious automotive career inside Los Santos.", understandsCommission: "Yes", canSource: "Yes", fundsRule: "Yes", status: "Pending", date: now() }
    ],
    purchaseRequests: [
      { id: id("req"), staff: "Marco Vega", date: now(), model: "Dewbauchee Exemplar", seller: "J. Wallace", phone: "555-0444", asking: 61000, lowest: 54500, resale: 76000, repair: 2800, profit: 18700, reason: "High-demand executive coupe with strong resale margin.", proof: "", status: "Pending", approvedBy: "" }
    ],
    sales: [
      { id: id("sale"), stock: "PA-002", model: "Ubermacht Sentinel Classic", purchasedFrom: "Auction lead", sourcedBy: "Giovanni Perez", soldBy: "Elena Cruz", purchasePrice: 38000, repairCost: 4200, detailCost: 700, fees: 0, totalCost: 42900, salePrice: 61500, netProfit: 18600, sourcerPercent: 20, salesPercent: 7, sourcerCommission: 3720, salesCommission: 1302, businessProfit: 13578, dateSold: now(), proof: "", approvedBy: "Giovanni Perez" }
    ],
    customers: [
      { id: id("cust"), name: "Maya Bennett", phone: "555-0199", interest: "Luxury coupe under $90k", notes: "Interested in test drive after inventory refresh.", date: now() }
    ],
    staff: [
      { id: id("staff"), name: "Giovanni Perez", position: "Owner / President", phone: "438-6918", role: "owner", photo: "", showOnAbout: "Yes", publicVisible: true, displayOrder: 1, bio: "Founder and lead decision-maker for Perez Automotive. Oversees approvals, treasury, staff, and the dealership standard.", notes: "Full access." },
      { id: id("staff"), name: "Savannah Perez", position: "Co-Owner / Vice President", phone: "", role: "coowner", photo: "", showOnAbout: "Yes", publicVisible: true, displayOrder: 2, bio: "Co-owner focused on leadership, customer trust, staff accountability, and daily dealership operations.", notes: "Full access." },
      { id: id("staff"), name: "Alex Moreno", position: "General Manager", phone: "555-0102", role: "gm", photo: "", showOnAbout: "Yes", publicVisible: true, displayOrder: 3, bio: "Manages staff records, applications, inventory flow, sale records, and daily business activity.", notes: "Can manage staff, applications, inventory, and sales." },
      { id: id("staff"), name: "Marco Vega", position: "Vehicle Sourcing Manager", phone: "555-0103", role: "sourcer", photo: "", showOnAbout: "Yes", publicVisible: true, displayOrder: 4, bio: "Finds strong vehicle leads, negotiates purchase prices, and submits sourcing deals for approval.", notes: "Sourcing leads and purchase requests." },
      { id: id("staff"), name: "Elena Cruz", position: "Sales & Finance Representative", phone: "555-0104", role: "sales", photo: "", showOnAbout: "Yes", publicVisible: true, displayOrder: 5, bio: "Handles customer records, test-drive notes, sale records, and closing support for premium vehicle deals.", notes: "Customer records and closing deals." },
      { id: id("staff"), name: "Dante Ruiz", position: "Service & Inventory Clerk", phone: "555-0105", role: "clerk", photo: "", showOnAbout: "Yes", publicVisible: true, displayOrder: 6, bio: "Updates inspections, detailing notes, repair notes, stock numbers, photos, and inventory readiness.", notes: "Inspections, detailing notes, inventory updates." }
    ],
    treasury: [
      { id: id("tre"), date: now(), type: "Deposit", description: "Starting business treasury", amount: 125000, handledBy: "Giovanni Perez", approvedBy: "Giovanni Perez", notes: "Initial manual business treasury balance.", proof: "", approved: true },
      { id: id("tre"), date: now(), type: "Sale", description: "PA-002 vehicle sale profit recorded", amount: 61500, handledBy: "Elena Cruz", approvedBy: "Giovanni Perez", notes: "Gross sale amount recorded. Costs and payouts tracked separately.", proof: "", approved: true },
      { id: id("tre"), date: now(), type: "Purchase", description: "PA-002 acquisition cost", amount: -38000, handledBy: "Giovanni Perez", approvedBy: "Giovanni Perez", notes: "Vehicle purchase cost.", proof: "", approved: true }
    ],
    payouts: [
      { id: id("pay"), staff: "Elena Cruz", role: "Sales Representative", amount: 1302, reason: "PA-002 sales commission", date: now(), status: "Pending", approvedBy: "" }
    ],
    logs: [
      { id: id("log"), action: "Portal created", staff: "System", date: now(), notes: "Perez Automotive website and local dashboard data initialized." }
    ]
  };
}

function getDB() {
  const saved = localStorage.getItem(DB_KEY);
  if (!saved) {
    const seeded = seedData();
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const { db, changed } = normalizeDB(JSON.parse(saved));
    if (changed) localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  } catch {
    const seeded = seedData();
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

async function initCloudSync() {
  // D1 only works after the site is deployed on Cloudflare Pages.
  // If the API/binding is not ready yet, the site falls back to browser localStorage.
  if (location.protocol === "file:") return;
  try {
    const res = await fetch(CLOUD_API, { cache: "no-store" });
    if (!res.ok) throw new Error(`D1 API returned ${res.status}`);
    const payload = await res.json();
    CLOUD_READY = true;
    if (payload && payload.data) {
      const { db, changed } = normalizeDB(payload.data);
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      if (changed) saveDB(db);
    } else {
      // First deploy: seed D1 with the current local starter data.
      saveDB(getDB());
    }
    console.info("Perez Automotive D1 sync ready.");
  } catch (err) {
    console.warn("Perez Automotive D1 sync not active yet; using local browser storage.", err);
  }
}

async function pushCloudDB(db) {
  try {
    await fetch(CLOUD_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(db)
    });
  } catch (err) {
    console.warn("Could not sync Perez Automotive data to D1.", err);
  }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  if (CLOUD_READY) {
    clearTimeout(CLOUD_SYNC_TIMER);
    CLOUD_SYNC_TIMER = setTimeout(() => pushCloudDB(db), 300);
  }
}
function currentUser() {
  const email = sessionStorage.getItem(SESSION_KEY);
  return demoUsers.find(u => u.email === email) || null;
}
function userName() { return currentUser()?.name || "Public Visitor"; }
function roleName(user = currentUser()) { return user ? roles[user.role] : "Guest"; }
function isOwnerRole(user = currentUser()) { return user && ["owner", "coowner"].includes(user.role); }
function can(area) {
  const u = currentUser();
  if (!u) return false;
  if (["owner", "coowner"].includes(u.role)) return true;
  const map = {
    gm: ["overview", "inventory", "purchases", "sales", "customers", "applications", "staff", "treasuryView", "treasuryAdd", "payouts", "calculator", "logs"],
    sourcer: ["overview", "inventoryView", "purchases", "calculator", "logs"],
    sales: ["overview", "inventoryView", "sales", "customers", "calculator", "logs"],
    clerk: ["overview", "inventory", "calculator", "logs"]
  };
  return (map[u.role] || []).includes(area);
}
function addLog(action, notes = "") {
  const db = getDB();
  db.logs.unshift({ id: id("log"), action, staff: userName(), date: now(), notes });
  saveDB(db);
}
function toast(message) {
  const t = $("#toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

function discordInviteButton(label = "Join Customer Lounge") {
  if (!DISCORD_INVITE_URL || DISCORD_INVITE_URL.includes("PASTE_YOUR_DISCORD_INVITE_HERE")) return "";
  return `<a class="btn" href="${escapeHtml(DISCORD_INVITE_URL)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

async function sendDiscordAlert(type, title, fields = {}, description = "A Perez Automotive website action was submitted.") {
  // Webhook URLs stay private inside Cloudflare environment variables.
  // This browser code only calls our own Cloudflare Pages Function.
  if (location.protocol === "file:") return;
  try {
    await fetch(DISCORD_ALERT_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, title, description, fields })
    });
  } catch (err) {
    console.warn("Discord alert could not be sent.", err);
  }
}
function getTreasuryBalance(db = getDB()) { return db.treasury.reduce((sum, entry) => sum + number(entry.amount), 0); }
function nextStock(db) {
  const nums = db.inventory.map(v => Number(String(v.stock || "").replace(/[^0-9]/g, ""))).filter(Boolean);
  const next = Math.max(0, ...nums) + 1;
  return `PA-${String(next).padStart(3, "0")}`;
}
function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
function setActiveNav() {
  const hash = location.hash || "#home";
  $$(".main-nav a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === hash || (hash.startsWith("#dashboard") && a.id === "loginNav")));
  const login = $("#loginNav");
  const user = currentUser();
  if (login) {
    login.textContent = user ? "Dashboard" : "Staff Login";
    login.href = user ? "#dashboard/overview" : "#login";
  }
}
function pageHeader(kicker, title, text) {
  return `<section class="section tight"><div class="page-title"><div class="kicker">${kicker}</div><h1>${title}</h1><p class="lead">${text}</p></div></section>`;
}

function renderHome() {
  const db = getDB();
  const available = db.inventory.filter(v => v.status === "Available").length;
  const sold = db.inventory.filter(v => v.status === "Sold").length;
  $("#app").innerHTML = `
    <section class="section hero">
      <div>
        <span class="eyebrow">Premium Los Santos Dealership</span>
        <h1>Perez <span>Automotive</span></h1>
        <p class="lead">A luxury dealership and automotive service business located at <strong>74 Spanish Ave</strong>. We specialize in quality pre-owned vehicles, custom builds, trade-ins, sourcing, repairs, detailing, and customer service for the Los Santos community.</p>
        <div class="hero-actions">
          <a class="btn primary" href="#inventory">View Inventory</a>
          <a class="btn" href="#careers">Apply Now</a>
          <a class="btn ghost" href="#contact">Contact Us</a>
          ${discordInviteButton()}
        </div>
      </div>
      <div class="hero-card" aria-label="Perez Automotive brand card">
        <img class="hero-logo" src="assets/perez-logo.png" alt="Perez Automotive logo" />
        <div class="hero-stat-row">
          <div class="mini-stat"><strong>${available}</strong><span>Available</span></div>
          <div class="mini-stat"><strong>${sold}</strong><span>Sold</span></div>
          <div class="mini-stat"><strong>24/7</strong><span>Records</span></div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="page-title"><div class="kicker">Luxury Services</div><h1>Dealership. Custom Shop. Service Center.</h1></div>
      <div class="grid cols-4">${services.slice(0, 4).map(serviceCard).join("")}</div>
    </section>
    <section class="section tight">
      <div class="grid cols-3">
        ${db.inventory.slice(0, 3).map(vehicleCard).join("")}
      </div>
      <div class="actions"><a href="#inventory" class="btn primary">Browse Full Inventory</a></div>
    </section>
  `;
}

function serviceCard(s) {
  return `<article class="card hover"><div class="icon">${escapeHtml(s[0])}</div><h3>${escapeHtml(s[1])}</h3><p>${escapeHtml(s[2])}</p></article>`;
}
function vehicleCard(v) {
  return `<article class="card hover">
    <div class="vehicle-image">${v.photo ? `<img src="${escapeHtml(v.photo)}" alt="${escapeHtml(v.model)}" />` : `<span>${escapeHtml(v.stock)}</span>`}</div>
    <div class="badge ${escapeHtml(v.status)}">${escapeHtml(v.status)}</div>
    <h3 style="margin-top:14px">${escapeHtml(v.model)}</h3>
    <p><strong class="money">${money(v.listingPrice)}</strong> listing · Lowest accepted ${money(v.lowestPrice)}</p>
    <p class="muted">Stock ${escapeHtml(v.stock)} · Sourced by ${escapeHtml(v.sourcedBy || "N/A")}</p>
  </article>`;
}

function teamCard(s) {
  const roleLabel = roles[s.role] || s.position || "Staff Member";
  return `<article class="team-card card hover">
    <div class="team-avatar">${s.photo ? `<img src="${escapeHtml(s.photo)}" alt="${escapeHtml(s.name)}" />` : `<span>${escapeHtml(initials(s.name))}</span>`}</div>
    <div class="team-body">
      <span class="badge">${escapeHtml(roleLabel)}</span>
      <h3>${escapeHtml(s.name)}</h3>
      <p class="team-position">${escapeHtml(s.position || roleLabel)}</p>
      <p>${escapeHtml(s.bio || s.notes || "Perez Automotive team member.")}</p>
      ${s.phone ? `<p class="muted"><strong>Contact:</strong> ${escapeHtml(s.phone)}</p>` : ``}
    </div>
  </article>`;
}

function renderAbout() {
  const db = getDB();
  const team = db.staff
    .filter(s => s.showOnAbout !== "No" && s.publicVisible !== false)
    .sort((a, b) => number(a.displayOrder) - number(b.displayOrder) || String(a.name).localeCompare(String(b.name)));
  $("#app").innerHTML = `
    ${pageHeader("About Us", "More Than A <span>Used Car Lot</span>", "Perez Automotive is built to operate as a serious premium automotive business: dealership, custom build shop, sourcing desk, trade-in center, consignment operation, and service record system in one.")}
    <section class="section tight">
      <div class="grid cols-2">
        <article class="card"><h3>Our Standard</h3><p>Every record is handled like a real dealership file: vehicle source, purchase cost, repair cost, detailing cost, listing price, lowest accepted price, sale proof, commission payout, and final business profit.</p></article>
        <article class="card"><h3>Our Brand</h3><p>Black, gold, and silver luxury styling with a premium Los Santos automotive identity. The goal is clean customer trust on the public side and clean staff accountability on the private side.</p></article>
        <article class="card"><h3>Business Records</h3><p>This website is built for internal record keeping, proof links, applications, approvals, and business management. All payments and approvals are tracked manually through management.</p></article>
        <article class="card"><h3>Location</h3><p>Perez Automotive operates from <strong>74 Spanish Ave</strong>, serving the Los Santos community with vehicle sales, sourcing, custom builds, repairs, detailing, trade-ins, and customer service.</p></article>
      </div>
      <div class="divider"></div>
      <div class="page-title team-heading"><div class="kicker">Our Team</div><h1>Meet The <span>Employees</span></h1><p class="lead">Every employee shown here is controlled from the private staff dashboard. Management can update names, jobs, photos, bios, and whether each person appears on this public About Us page.</p></div>
      <div class="team-grid">${team.length ? team.map(teamCard).join("") : `<div class="notice">No public staff members are listed yet.</div>`}</div>
    </section>
  `;
}

function renderServices() {
  $("#app").innerHTML = `
    ${pageHeader("Services", "Premium Automotive <span>Services</span>", "Clean luxury cards for every core Perez Automotive service with a dealership-grade feel.")}
    <section class="section tight"><div class="grid cols-4">${services.map(serviceCard).join("")}</div></section>
  `;
}

function renderPublicInventory() {
  const db = getDB();
  $("#app").innerHTML = `
    ${pageHeader("Vehicle Inventory", "Current <span>Inventory</span>", "Browse Perez Automotive records by stock number, vehicle model, status, staff member, and price range.")}
    <section class="section tight">
      <div class="filters">
        <input class="input" id="inventorySearch" style="max-width:360px" placeholder="Search stock, model, sourced by, sold by..." />
        <select class="select" id="inventoryStatus" style="max-width:210px">
          <option value="">All Statuses</option><option>Available</option><option>Pending</option><option>Sold</option><option>Archived</option>
        </select>
      </div>
      <div id="inventoryResults" class="grid cols-3"></div>
      <div class="divider"></div>
      <div class="table-wrap">${inventoryTable(db.inventory)}</div>
    </section>`;
  const renderCards = () => {
    const term = $("#inventorySearch").value.toLowerCase();
    const status = $("#inventoryStatus").value;
    const results = db.inventory.filter(v => {
      const hay = `${v.stock} ${v.model} ${v.sourcedBy} ${v.soldBy} ${v.notes}`.toLowerCase();
      return hay.includes(term) && (!status || v.status === status);
    });
    $("#inventoryResults").innerHTML = results.length ? results.map(vehicleCard).join("") : `<div class="notice">No vehicles matched your filters.</div>`;
  };
  $("#inventorySearch").addEventListener("input", renderCards);
  $("#inventoryStatus").addEventListener("change", renderCards);
  renderCards();
}

function inventoryTable(items) {
  return `<table><thead><tr><th>Stock</th><th>Vehicle</th><th>Status</th><th>Purchase</th><th>Listing</th><th>Lowest</th><th>Sourced</th><th>Sold By</th><th>Notes</th></tr></thead><tbody>
    ${items.map(v => `<tr><td>${escapeHtml(v.stock)}</td><td>${escapeHtml(v.model)}</td><td><span class="badge ${escapeHtml(v.status)}">${escapeHtml(v.status)}</span></td><td>${money(v.purchasePrice)}</td><td>${money(v.listingPrice)}</td><td>${money(v.lowestPrice)}</td><td>${escapeHtml(v.sourcedBy || "")}</td><td>${escapeHtml(v.soldBy || "")}</td><td>${escapeHtml(v.notes || "")}</td></tr>`).join("")}
  </tbody></table>`;
}

function renderCareers() {
  $("#app").innerHTML = `
    ${pageHeader("Careers", "Apply To <span>Perez Automotive</span>", "Submit a staff application. Applications save into the private staff dashboard for management review.")}
    <section class="section tight">
      <form id="applicationForm" class="card">
        <div class="form-grid">
          <label><span>Full Legal Name</span><input class="input" name="name" required /></label>
          <label><span>Phone Number</span><input class="input" name="phone" required /></label>
          <label><span>Position Applying For</span><select class="select" name="position" required><option>Vehicle Sourcing Manager</option><option>Sales & Finance Representative</option><option>Service & Inventory Clerk</option><option>General Staff</option></select></label>
          <label><span>Availability</span><input class="input" name="availability" placeholder="Days / hours you can work" required /></label>
          <label class="full"><span>Previous Work Experience</span><textarea class="textarea" name="experience" required></textarea></label>
          <label class="full"><span>Why do you want to work for Perez Automotive?</span><textarea class="textarea" name="why" required></textarea></label>
          <label><span>Do you understand this is commission-based pay?</span><select class="select" name="understandsCommission"><option>Yes</option><option>No</option></select></label>
          <label><span>Can you source vehicles or help with sales?</span><select class="select" name="canSource"><option>Yes</option><option>No</option><option>Somewhat</option></select></label>
          <label class="full"><span>Do you agree not to use business funds without approval?</span><select class="select" name="fundsRule"><option>Yes</option><option>No</option></select></label>
        </div>
        <div class="actions"><button class="btn primary" type="submit">Submit Application</button></div>
      </form>
    </section>`;
  $("#applicationForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = formData(e.target);
    const db = getDB();
    db.applications.unshift({ id: id("app"), ...data, status: "Pending", date: now() });
    db.logs.unshift({ id: id("log"), action: "Application submitted", staff: data.name, date: now(), notes: `${data.name} applied for ${data.position}.` });
    saveDB(db);
    sendDiscordAlert("application", "New Staff Application", {
      "Name": data.name,
      "Phone": data.phone,
      "Position": data.position,
      "Availability": data.availability,
      "Can Source / Sell": data.canSource,
      "Commission Based Pay": data.understandsCommission
    }, `${data.name} submitted a staff application from the website.`);
    e.target.reset();
    toast("Application submitted and saved to the staff dashboard.");
  });
}

function renderContact() {
  $("#app").innerHTML = `
    ${pageHeader("Contact", "Reach <span>Perez Automotive</span>", "For business inquiries, vehicle questions, trade-ins, service, or sourcing requests.")}
    <section class="section tight">
      <div class="grid cols-2">
        <article class="card">
          <img class="login-logo" src="assets/perez-logo.png" alt="Perez Automotive logo" />
          <h3>Perez Automotive</h3>
          <p><strong>Address:</strong> 74 Spanish Ave</p>
          <p><strong>Business Type:</strong> Premium used vehicles, custom builds, trade-ins, sourcing, repairs, detailing, and customer service.</p>
          <p><strong>Status:</strong> Open for vehicle sales, sourcing, service records, and staff management.</p>
          <div class="actions">${discordInviteButton("Join Our Customer Lounge")}</div>
        </article>
        <form id="contactForm" class="card">
          <div class="form-grid">
            <label><span>Name</span><input class="input" name="name" required /></label>
            <label><span>Phone</span><input class="input" name="phone" required /></label>
            <label class="full"><span>Message</span><textarea class="textarea" name="message" required></textarea></label>
          </div>
          <div class="actions"><button class="btn primary" type="submit">Send Message</button></div>
          <p class="muted">This first version stores staff records locally. Contact messages show confirmation only until a database is connected.</p>
        </form>
      </div>
    </section>`;
  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = formData(e.target);
    sendDiscordAlert("contact", "New Website Contact Message", {
      "Name": data.name,
      "Phone": data.phone,
      "Message": data.message
    }, `${data.name} sent a message from the Perez Automotive website.`);
    e.target.reset();
    toast("Message sent to Perez Automotive staff.");
  });
}

function renderLogin() {
  if (currentUser()) { location.hash = "#dashboard/overview"; return; }
  $("#app").innerHTML = `
    <section class="section">
      <div class="login-wrap card">
        <img class="login-logo" src="assets/perez-logo.png" alt="Perez Automotive logo" />
        <div class="page-title" style="text-align:center"><div class="kicker">Private Portal</div><h1>Staff <span>Login</span></h1><p class="lead">Access the Perez Automotive dealership management dashboard.</p></div>
        <form id="loginForm">
          <div class="form-grid">
            <label class="full"><span>Email / Username</span><input class="input" name="email" autocomplete="username" required /></label>
            <label class="full"><span>Password</span><input class="input" name="password" type="password" autocomplete="current-password" required /></label>
          </div>
          <div class="actions"><button class="btn primary" type="submit">Login</button></div>
        </form>
        <div class="demo-box">
          <strong class="gold">Demo accounts:</strong><br />
          Owner: <code>owner@perezauto.com</code> / <code>owner123</code><br />
          General Manager: <code>manager@perezauto.com</code> / <code>manager123</code><br />
          Sales: <code>sales@perezauto.com</code> / <code>sales123</code>
        </div>
      </div>
    </section>`;
  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = formData(e.target);
    const user = demoUsers.find(u => u.email.toLowerCase() === String(data.email).toLowerCase().trim() && u.password === data.password);
    if (!user) { toast("Invalid login. Try a demo account from the box below."); return; }
    sessionStorage.setItem(SESSION_KEY, user.email);
    addLog("Staff logged in", `${user.name} accessed the portal as ${roles[user.role]}.`);
    toast(`Welcome, ${user.name}.`);
    location.hash = "#dashboard/overview";
  });
}

const dashItems = [
  ["overview", "Dashboard", "◆"], ["inventory", "Inventory", "▣"], ["purchases", "Purchase Requests", "$"],
  ["sales", "Sale Records", "✓"], ["customers", "Customers", "◎"], ["applications", "Applications", "✦"],
  ["staff", "Staff Roster", "♛"], ["treasury", "Treasury", "◈"], ["payouts", "Payouts", "◇"],
  ["calculator", "Commission Calculator", "%"], ["logs", "Activity Logs", "⌁"]
];

function renderDashboard(section = "overview") {
  const user = currentUser();
  if (!user) { location.hash = "#login"; return; }
  const content = dashboardContent(section);
  $("#app").innerHTML = `
    <section class="dashboard-shell">
      <aside class="sidebar">
        <div class="user-card"><img src="assets/perez-logo.png" alt="Perez Automotive logo" /><div><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(roleName(user))}</span></div></div>
        <nav class="side-nav">${dashItems.map(([key, label, icon]) => `<a href="#dashboard/${key}" class="${key === section ? "active" : ""}"><span>${icon} ${label}</span></a>`).join("")}</nav>
        <div class="actions"><button class="btn small danger" onclick="logout()">Logout</button></div>
      </aside>
      <div class="dashboard-main">${content}</div>
    </section>`;
  bindDashboardForms(section);
}

function dashboardHeader(title, subtitle = "Perez Automotive staff management portal") {
  return `<div class="dash-header"><div><div class="kicker">${escapeHtml(subtitle)}</div><h1>${title}</h1></div><a class="btn small" href="#home">Public Site</a></div>`;
}

function dashboardContent(section) {
  switch (section) {
    case "inventory": return dashInventory();
    case "purchases": return dashPurchases();
    case "sales": return dashSales();
    case "customers": return dashCustomers();
    case "applications": return dashApplications();
    case "staff": return dashStaff();
    case "treasury": return dashTreasury();
    case "payouts": return dashPayouts();
    case "calculator": return dashCalculator();
    case "logs": return dashLogs();
    default: return dashOverview();
  }
}

function dashOverview() {
  const db = getDB();
  const available = db.inventory.filter(v => v.status === "Available").length;
  const sold = db.inventory.filter(v => v.status === "Sold").length;
  const pendingApps = db.applications.filter(a => a.status === "Pending").length;
  const pendingReq = db.purchaseRequests.filter(r => r.status === "Pending").length;
  const pendingPayouts = db.payouts.filter(p => p.status === "Pending").length;
  const profit = db.sales.reduce((sum, sale) => sum + number(sale.businessProfit), 0);
  return `${dashboardHeader("Dealership Dashboard")}
    <div class="stat-grid">
      ${stat("Vehicles Available", available, "Inventory ready for buyers")}
      ${stat("Vehicles Sold", sold, "Closed deal records")}
      ${stat("Treasury Balance", money(getTreasuryBalance(db)), "Manual ledger")}
      ${stat("Pending Applications", pendingApps, "Awaiting review")}
      ${stat("Purchase Requests", pendingReq, "Need owner/co-owner approval")}
      ${stat("Pending Payouts", pendingPayouts, "Commission records")}
      ${stat("Business Profit", money(profit), "After staff commissions")}
      ${stat("Recent Activity", db.logs.length, "System log entries")}
    </div>
    <div class="grid cols-2" style="margin-top:18px">
      <article class="card"><h3>Recent Activity</h3>${db.logs.slice(0, 6).map(l => `<p><strong>${escapeHtml(l.action)}</strong><br><span class="muted">${escapeHtml(l.date)} · ${escapeHtml(l.staff)}</span></p>`).join("<div class='divider'></div>")}</article>
      <article class="card"><h3>Staff Performance</h3>${performanceList(db)}</article>
    </div>`;
}
function stat(label, value, tiny) { return `<div class="stat-card"><span>${label}</span><strong>${value}</strong><div class="tiny">${tiny}</div></div>`; }
function performanceList(db) {
  return db.staff.map(s => {
    const sourced = db.inventory.filter(v => v.sourcedBy === s.name).length;
    const sold = db.sales.filter(v => v.soldBy === s.name).length;
    const profit = db.sales.filter(v => v.soldBy === s.name || v.sourcedBy === s.name).reduce((sum, sale) => sum + number(sale.businessProfit), 0);
    const max = Math.max(1, db.sales.reduce((sum, sale) => sum + number(sale.businessProfit), 0));
    const pct = Math.min(100, Math.round((profit / max) * 100));
    return `<div style="margin-bottom:16px"><strong>${escapeHtml(s.name)}</strong><span class="muted"> · ${escapeHtml(s.position)}</span><br><span class="muted">Sourced ${sourced} · Sold ${sold} · Profit ${money(profit)}</span><div class="bar"><span style="width:${pct}%"></span></div></div>`;
  }).join("");
}

function dashInventory() {
  const db = getDB();
  const allow = can("inventory");
  return `${dashboardHeader("Vehicle Inventory Records")}
    ${!allow ? `<div class="notice">Your role can view inventory but cannot add/edit inventory records.</div>` : ``}
    ${allow ? `<form id="inventoryForm" class="card"><h3>Add Vehicle Record</h3><div class="form-grid">
      <label><span>Stock Number</span><input class="input" name="stock" value="${nextStock(db)}" required /></label>
      <label><span>Vehicle Model</span><input class="input" name="model" required /></label>
      <label><span>Vehicle Photo URL</span><input class="input" name="photo" placeholder="Optional image/proof link" /></label>
      <label><span>Purchased From</span><input class="input" name="purchasedFrom" /></label>
      <label><span>Sourced By</span><input class="input" name="sourcedBy" value="${escapeHtml(userName())}" /></label>
      <label><span>Sold By</span><input class="input" name="soldBy" /></label>
      <label><span>Purchase Price</span><input class="input" name="purchasePrice" type="number" value="0" /></label>
      <label><span>Repair Cost</span><input class="input" name="repairCost" type="number" value="0" /></label>
      <label><span>Detail Cost</span><input class="input" name="detailCost" type="number" value="0" /></label>
      <label><span>Listing Price</span><input class="input" name="listingPrice" type="number" value="0" /></label>
      <label><span>Lowest Accepted Price</span><input class="input" name="lowestPrice" type="number" value="0" /></label>
      <label><span>Status</span><select class="select" name="status"><option>Available</option><option>Pending</option><option>Sold</option><option>Archived</option></select></label>
      <label><span>Sale Price If Sold</span><input class="input" name="salePrice" type="number" value="0" /></label>
      <label><span>Proof / Screenshot Link</span><input class="input" name="proof" /></label>
      <label class="full"><span>Notes</span><textarea class="textarea" name="notes"></textarea></label>
    </div><div class="actions"><button class="btn primary" type="submit">Save Vehicle</button></div></form>` : ``}
    <div class="divider"></div><div class="table-wrap">${inventoryTable(db.inventory)}</div>`;
}

function dashPurchases() {
  const db = getDB();
  return `${dashboardHeader("Vehicle Purchase Requests")}
    <form id="purchaseForm" class="card"><h3>Submit Vehicle For Approval</h3><div class="form-grid">
      <label><span>Staff Name</span><input class="input" name="staff" value="${escapeHtml(userName())}" required /></label>
      <label><span>Date</span><input class="input" name="date" value="${escapeHtml(now())}" required /></label>
      <label><span>Vehicle Model</span><input class="input" name="model" required /></label>
      <label><span>Seller Name</span><input class="input" name="seller" required /></label>
      <label><span>Seller Phone Number</span><input class="input" name="phone" /></label>
      <label><span>Seller Asking Price</span><input class="input calc-purchase" name="asking" type="number" value="0" /></label>
      <label><span>Lowest Negotiated Price</span><input class="input calc-purchase" name="lowest" type="number" value="0" /></label>
      <label><span>Estimated Resale Price</span><input class="input calc-purchase" name="resale" type="number" value="0" /></label>
      <label><span>Estimated Repair / Detail Cost</span><input class="input calc-purchase" name="repair" type="number" value="0" /></label>
      <label><span>Expected Net Profit</span><input class="input" name="profit" id="expectedProfit" type="number" readonly value="0" /></label>
      <label class="full"><span>Reason Vehicle Is Worth Buying</span><textarea class="textarea" name="reason"></textarea></label>
      <label class="full"><span>Photo / Proof Link</span><input class="input" name="proof" /></label>
    </div><div class="actions"><button class="btn primary" type="submit">Submit Request</button></div></form>
    <div class="divider"></div><div class="table-wrap"><table><thead><tr><th>Vehicle</th><th>Staff</th><th>Seller</th><th>Lowest</th><th>Resale</th><th>Profit</th><th>Status</th><th>Approved By</th><th>Proof</th><th>Actions</th></tr></thead><tbody>
      ${db.purchaseRequests.map(r => `<tr><td>${escapeHtml(r.model)}</td><td>${escapeHtml(r.staff)}</td><td>${escapeHtml(r.seller)}<br><span class="muted">${escapeHtml(r.phone)}</span></td><td>${money(r.lowest)}</td><td>${money(r.resale)}</td><td>${money(r.profit)}</td><td><span class="badge ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></td><td>${escapeHtml(r.approvedBy || "")}</td><td>${proofLink(r.proof)}</td><td>${isOwnerRole() && r.status === "Pending" ? `<button class="btn small" onclick="approvePurchase('${r.id}','Approved')">Approve</button> <button class="btn small danger" onclick="approvePurchase('${r.id}','Denied')">Deny</button>` : `<span class="muted">No action</span>`}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function dashSales() {
  const db = getDB();
  const allow = can("sales");
  return `${dashboardHeader("Vehicle Sale Records")}
    ${!allow ? `<div class="notice">Your role cannot add sale records.</div>` : `<form id="saleForm" class="card"><h3>Create Sale Record</h3><div class="form-grid">
      <label><span>Stock Number</span><input class="input" name="stock" placeholder="PA-004" required /></label>
      <label><span>Vehicle Model</span><input class="input" name="model" required /></label>
      <label><span>Purchased From</span><input class="input" name="purchasedFrom" /></label>
      <label><span>Sourced By</span><input class="input" name="sourcedBy" /></label>
      <label><span>Sold By</span><input class="input" name="soldBy" value="${escapeHtml(userName())}" /></label>
      <label><span>Purchase Price</span><input class="input sale-calc" name="purchasePrice" type="number" value="0" /></label>
      <label><span>Repair Cost</span><input class="input sale-calc" name="repairCost" type="number" value="0" /></label>
      <label><span>Detail Cost</span><input class="input sale-calc" name="detailCost" type="number" value="0" /></label>
      <label><span>Fees</span><input class="input sale-calc" name="fees" type="number" value="0" /></label>
      <label><span>Final Sale Price</span><input class="input sale-calc" name="salePrice" type="number" value="0" /></label>
      <label><span>Sourcer Commission %</span><input class="input sale-calc" name="sourcerPercent" type="number" value="20" /></label>
      <label><span>Sales Commission %</span><input class="input sale-calc" name="salesPercent" type="number" value="7" /></label>
      <label><span>Total Business Cost</span><input class="input" name="totalCost" id="saleTotalCost" readonly /></label>
      <label><span>Net Profit</span><input class="input" name="netProfit" id="saleNetProfit" readonly /></label>
      <label><span>Sourcer Commission</span><input class="input" name="sourcerCommission" id="saleSourcerCommission" readonly /></label>
      <label><span>Sales Commission</span><input class="input" name="salesCommission" id="saleSalesCommission" readonly /></label>
      <label><span>Business Final Profit</span><input class="input" name="businessProfit" id="saleBusinessProfit" readonly /></label>
      <label><span>Proof / Screenshot Link</span><input class="input" name="proof" /></label>
      <label class="full"><span>Approved By</span><input class="input" name="approvedBy" value="${isOwnerRole() ? escapeHtml(userName()) : "Pending Management Approval"}" /></label>
    </div><div class="actions"><button class="btn primary" type="submit">Save Sale Record</button></div></form>`}
    <div class="divider"></div><div class="table-wrap"><table><thead><tr><th>Stock</th><th>Vehicle</th><th>Sourced</th><th>Sold By</th><th>Sale</th><th>Net</th><th>Payouts</th><th>Business Profit</th><th>Approved</th><th>Proof</th></tr></thead><tbody>
      ${db.sales.map(s => `<tr><td>${escapeHtml(s.stock)}</td><td>${escapeHtml(s.model)}</td><td>${escapeHtml(s.sourcedBy)}</td><td>${escapeHtml(s.soldBy)}</td><td>${money(s.salePrice)}</td><td>${money(s.netProfit)}</td><td>Sourcer ${money(s.sourcerCommission)}<br>Sales ${money(s.salesCommission)}</td><td class="money">${money(s.businessProfit)}</td><td>${escapeHtml(s.approvedBy || "")}</td><td>${proofLink(s.proof)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function dashCustomers() {
  const db = getDB();
  const allow = can("customers");
  return `${dashboardHeader("Customer Records")}
    ${allow ? `<form id="customerForm" class="card"><h3>Add Customer Record</h3><div class="form-grid">
      <label><span>Customer Name</span><input class="input" name="name" required /></label>
      <label><span>Phone Number</span><input class="input" name="phone" /></label>
      <label><span>Vehicle Interest</span><input class="input" name="interest" /></label>
      <label><span>Date</span><input class="input" name="date" value="${escapeHtml(now())}" /></label>
      <label class="full"><span>Notes / Test Drive Notes</span><textarea class="textarea" name="notes"></textarea></label>
    </div><div class="actions"><button class="btn primary" type="submit">Save Customer</button></div></form>` : `<div class="notice">Your role can view but cannot add customer records.</div>`}
    <div class="divider"></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Interest</th><th>Date</th><th>Notes</th></tr></thead><tbody>${db.customers.map(c => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.phone)}</td><td>${escapeHtml(c.interest)}</td><td>${escapeHtml(c.date)}</td><td>${escapeHtml(c.notes)}</td></tr>`).join("")}</tbody></table></div>`;
}

function dashApplications() {
  const db = getDB();
  const allow = can("applications");
  return `${dashboardHeader("Job Applications")}
    ${!allow ? `<div class="notice">Only Owner, Co-Owner, and General Manager can change application statuses.</div>` : ``}
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Position</th><th>Availability</th><th>Commission</th><th>Funds Rule</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${db.applications.map(a => `<tr><td>${escapeHtml(a.name)}<br><span class="muted">${escapeHtml(a.date)}</span></td><td>${escapeHtml(a.phone)}</td><td>${escapeHtml(a.position)}</td><td>${escapeHtml(a.availability)}</td><td>${escapeHtml(a.understandsCommission)}</td><td>${escapeHtml(a.fundsRule)}</td><td><span class="badge ${escapeHtml(a.status)}">${escapeHtml(a.status)}</span></td><td>${allow ? appStatusButtons(a.id) : `<span class="muted">View only</span>`}</td></tr>`).join("")}
    </tbody></table></div>`;
}
function appStatusButtons(appId) { return ["Pending", "Interviewed", "Accepted", "Denied"].map(s => `<button class="btn small" onclick="setApplicationStatus('${appId}','${s}')">${s}</button>`).join(" "); }

function roleOptions(selected = "clerk") {
  return Object.entries(roles).map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function dashStaff() {
  const db = getDB();
  const allow = can("staff") || isManagementRole();
  return `${dashboardHeader("Staff Roster & Public About Us Editor", "Management-only employee profile controls")}
    ${allow ? `<form id="staffForm" class="card"><h3 id="staffFormTitle">Add / Edit Employee</h3><p class="muted">Management can edit the employees shown on the public About Us page from here.</p><input type="hidden" name="editId" id="staffEditId" />
    <div class="form-grid">
      <label><span>Staff Name</span><input class="input" name="name" required /></label>
      <label><span>Phone</span><input class="input" name="phone" /></label>
      <label><span>Position / Job Title</span><input class="input" name="position" required placeholder="Owner / Sales Rep / Service Clerk" /></label>
      <label><span>Role / Permission Level</span><select class="select" name="role">${roleOptions()}</select></label>
      <label><span>Profile Photo URL</span><input class="input" name="photo" placeholder="Optional image link" /></label>
      <label><span>Show On Public About Us Page?</span><select class="select" name="showOnAbout"><option>Yes</option><option>No</option></select></label>
      <label><span>Display Order</span><input class="input" name="displayOrder" type="number" value="99" /></label>
      <label class="full"><span>Public About Us Bio</span><textarea class="textarea" name="bio" placeholder="Short public description of what this employee does."></textarea></label>
      <label class="full"><span>Private Staff Notes</span><textarea class="textarea" name="notes"></textarea></label>
    </div><div class="actions"><button class="btn primary" id="staffSaveBtn" type="submit">Save Employee</button><button class="btn ghost" type="button" id="clearStaffEdit">Clear Form</button><a class="btn" href="#about">View About Us Page</a></div></form>` : `<div class="notice">Only management can add or edit public employee profiles.</div>`}
    <div class="divider"></div><div class="grid cols-3">${db.staff.map(s => staffCard(s, db, allow)).join("")}</div>`;
}
function staffCard(s, db, allow = false) {
  const sourced = db.inventory.filter(v => v.sourcedBy === s.name).length;
  const sold = db.sales.filter(v => v.soldBy === s.name).length;
  const commission = db.payouts.filter(p => p.staff === s.name).reduce((sum, p) => sum + number(p.amount), 0);
  const profit = db.sales.filter(v => v.soldBy === s.name || v.sourcedBy === s.name).reduce((sum, sale) => sum + number(sale.businessProfit), 0);
  const publicStatus = s.showOnAbout === "No" || s.publicVisible === false ? "Hidden from About Us" : "Shown on About Us";
  return `<article class="card staff-card">
    <div class="team-avatar small">${s.photo ? `<img src="${escapeHtml(s.photo)}" alt="${escapeHtml(s.name)}" />` : `<span>${escapeHtml(initials(s.name))}</span>`}</div>
    <span class="badge">${escapeHtml(roles[s.role] || s.position)}</span>
    <h3>${escapeHtml(s.name)}</h3>
    <p>${escapeHtml(s.position)}</p>
    <p class="muted">${escapeHtml(publicStatus)} · Order ${escapeHtml(s.displayOrder ?? "99")}</p>
    <div class="divider"></div>
    <p>Vehicles sourced: <strong>${sourced}</strong><br>Vehicles sold: <strong>${sold}</strong><br>Total profit brought in: <strong class="money">${money(profit)}</strong><br>Total commission paid: <strong>${money(commission)}</strong></p>
    <p class="muted">${escapeHtml(s.bio || s.notes || "")}</p>
    ${allow ? `<div class="actions"><button class="btn small" onclick="editStaff('${s.id}')">Edit</button><button class="btn small danger" onclick="deleteStaff('${s.id}')">Remove</button></div>` : ``}
  </article>`;
}

function dashTreasury() {
  const db = getDB();
  const canView = can("treasuryView") || isOwnerRole();
  const canAdd = can("treasuryAdd") || isOwnerRole();
  if (!canView) return `${dashboardHeader("Treasury Ledger")}<div class="notice">Your role cannot access treasury records.</div>`;
  return `${dashboardHeader("Treasury Ledger")}
    <div class="stat-grid" style="margin-bottom:16px">${stat("Current Treasury Balance", money(getTreasuryBalance(db)), "Based on manual ledger entries")}${stat("Ledger Entries", db.treasury.length, "Searchable record list")}</div>
    ${canAdd ? `<form id="treasuryForm" class="card"><h3>Add Treasury Entry</h3><div class="form-grid">
      <label><span>Type</span><select class="select" name="type"><option>Deposit</option><option>Withdrawal</option><option>Purchase</option><option>Sale</option><option>Payout</option><option>Expense</option></select></label>
      <label><span>Amount</span><input class="input" name="amount" type="number" required placeholder="Use positive amount; type decides sign" /></label>
      <label><span>Date</span><input class="input" name="date" value="${escapeHtml(now())}" /></label>
      <label><span>Handled By</span><input class="input" name="handledBy" value="${escapeHtml(userName())}" /></label>
      <label><span>Approved By</span><input class="input" name="approvedBy" value="${isOwnerRole() ? escapeHtml(userName()) : "Pending Owner / Co-Owner"}" /></label>
      <label><span>Proof / Screenshot Link</span><input class="input" name="proof" /></label>
      <label class="full"><span>Description</span><input class="input" name="description" required /></label>
      <label class="full"><span>Notes</span><textarea class="textarea" name="notes"></textarea></label>
    </div><div class="actions"><button class="btn primary" type="submit">Save Ledger Entry</button></div></form>` : `<div class="notice">Your role can view treasury but cannot add entries.</div>`}
    <div class="divider"></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Handled</th><th>Approved</th><th>Proof</th><th>Actions</th></tr></thead><tbody>
      ${db.treasury.map(t => `<tr><td>${escapeHtml(t.date)}</td><td><span class="badge ${escapeHtml(t.type)}">${escapeHtml(t.type)}</span></td><td>${escapeHtml(t.description)}<br><span class="muted">${escapeHtml(t.notes || "")}</span></td><td class="money">${money(t.amount)}</td><td>${escapeHtml(t.handledBy)}</td><td>${escapeHtml(t.approvedBy || "")}</td><td>${proofLink(t.proof)}</td><td>${isOwnerRole() ? `<button class="btn small danger" onclick="deleteTreasury('${t.id}')">Delete</button>` : `<span class="muted">Locked</span>`}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function dashPayouts() {
  const db = getDB();
  const allow = can("payouts");
  return `${dashboardHeader("Staff Payout Records")}
    ${allow ? `<form id="payoutForm" class="card"><h3>Record Staff Payout</h3><div class="form-grid">
      <label><span>Staff Member</span><input class="input" name="staff" required /></label>
      <label><span>Role / Reason Type</span><input class="input" name="role" placeholder="Sourcer / Sales / Bonus" /></label>
      <label><span>Amount</span><input class="input" name="amount" type="number" required /></label>
      <label><span>Date</span><input class="input" name="date" value="${escapeHtml(now())}" /></label>
      <label class="full"><span>Reason</span><input class="input" name="reason" required /></label>
    </div><div class="actions"><button class="btn primary" type="submit">Save Payout</button></div></form>` : `<div class="notice">Your role cannot add payout records.</div>`}
    <div class="divider"></div><div class="table-wrap"><table><thead><tr><th>Staff</th><th>Role</th><th>Amount</th><th>Reason</th><th>Date</th><th>Status</th><th>Approved By</th><th>Actions</th></tr></thead><tbody>
      ${db.payouts.map(p => `<tr><td>${escapeHtml(p.staff)}</td><td>${escapeHtml(p.role)}</td><td class="money">${money(p.amount)}</td><td>${escapeHtml(p.reason)}</td><td>${escapeHtml(p.date)}</td><td><span class="badge ${escapeHtml(p.status)}">${escapeHtml(p.status)}</span></td><td>${escapeHtml(p.approvedBy || "")}</td><td>${isOwnerRole() && p.status === "Pending" ? `<button class="btn small" onclick="approvePayout('${p.id}')">Approve</button>` : `<span class="muted">No action</span>`}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function dashCalculator() {
  return `${dashboardHeader("Commission Calculator")}
    <div class="grid cols-2">
      <form id="calculatorForm" class="card"><h3>Live Deal Calculator</h3><div class="form-grid">
        <label><span>Sale Price</span><input class="input commission-input" name="salePrice" type="number" value="75000" /></label>
        <label><span>Purchase Price</span><input class="input commission-input" name="purchasePrice" type="number" value="52000" /></label>
        <label><span>Repair Cost</span><input class="input commission-input" name="repairCost" type="number" value="3500" /></label>
        <label><span>Detail Cost</span><input class="input commission-input" name="detailCost" type="number" value="800" /></label>
        <label><span>Fees</span><input class="input commission-input" name="fees" type="number" value="0" /></label>
        <label><span>Sourcer Commission %</span><input class="input commission-input" name="sourcerPercent" type="number" value="20" /></label>
        <label><span>Sales Commission %</span><input class="input commission-input" name="salesPercent" type="number" value="7" /></label>
        <label><span>Current Treasury Balance</span><input class="input commission-input" name="treasury" type="number" value="${getTreasuryBalance()}" /></label>
        <label class="full"><span>Same person sourced and sold?</span><select class="select commission-input" name="samePerson"><option value="no">No</option><option value="yes">Yes - use 25% total commission</option></select></label>
      </div></form>
      <article class="card" id="calculatorResults"></article>
    </div>
    <div class="notice" style="margin-top:16px">Default rules: Vehicle Sourcer 20%, Trusted Sourcer 25%, Senior/Premium Sourcer up to 30%, Sales Representative 5%–10%, same person sourcing and selling gets 25% total commission. Company keeps the remaining profit.</div>`;
}

function dashLogs() {
  const db = getDB();
  return `${dashboardHeader("Activity Logs")}
    <div class="table-wrap"><table><thead><tr><th>Action</th><th>Staff Member</th><th>Date / Time</th><th>Notes</th></tr></thead><tbody>
      ${db.logs.map(l => `<tr><td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.staff)}</td><td>${escapeHtml(l.date)}</td><td>${escapeHtml(l.notes)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function bindDashboardForms(section) {
  if (section === "inventory" && $("#inventoryForm")) {
    $("#inventoryForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = formData(e.target); const db = getDB();
      const totalCost = number(data.purchasePrice) + number(data.repairCost) + number(data.detailCost);
      const profit = number(data.salePrice) ? number(data.salePrice) - totalCost : 0;
      db.inventory.unshift({ id: id("veh"), ...data, purchasePrice: number(data.purchasePrice), repairCost: number(data.repairCost), detailCost: number(data.detailCost), totalCost, listingPrice: number(data.listingPrice), lowestPrice: number(data.lowestPrice), salePrice: number(data.salePrice), profit });
      db.logs.unshift({ id: id("log"), action: "Vehicle added", staff: userName(), date: now(), notes: `${data.stock} ${data.model} added to inventory.` });
      saveDB(db);
      sendDiscordAlert("inventory", "Vehicle Added To Inventory", {
        "Stock": data.stock,
        "Vehicle": data.model,
        "Status": data.status,
        "Listing Price": money(data.listingPrice),
        "Sourced By": data.sourcedBy || "Not listed"
      }, `${data.stock} ${data.model} was added to inventory.`);
      toast("Vehicle record saved."); renderDashboard("inventory");
    });
  }
  if (section === "purchases" && $("#purchaseForm")) {
    const calculate = () => { const f = $("#purchaseForm"); $("#expectedProfit").value = number(f.resale.value) - number(f.lowest.value) - number(f.repair.value); };
    $$(".calc-purchase").forEach(i => i.addEventListener("input", calculate)); calculate();
    $("#purchaseForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = formData(e.target); const db = getDB();
      db.purchaseRequests.unshift({ id: id("req"), ...data, asking: number(data.asking), lowest: number(data.lowest), resale: number(data.resale), repair: number(data.repair), profit: number(data.profit), status: "Pending", approvedBy: "" });
      db.logs.unshift({ id: id("log"), action: "Vehicle purchase requested", staff: userName(), date: now(), notes: `${data.model} submitted for approval.` });
      saveDB(db);
      sendDiscordAlert("purchase", "New Vehicle Purchase Request", {
        "Vehicle": data.model,
        "Staff": data.staff || userName(),
        "Seller": data.seller,
        "Seller Phone": data.phone,
        "Lowest Negotiated Price": money(data.lowest),
        "Estimated Resale": money(data.resale),
        "Expected Profit": money(data.profit)
      }, `${data.model} was submitted for management approval.`);
      toast("Purchase request submitted for management approval."); renderDashboard("purchases");
    });
  }
  if (section === "sales" && $("#saleForm")) {
    const calc = () => {
      const f = $("#saleForm");
      const totalCost = number(f.purchasePrice.value) + number(f.repairCost.value) + number(f.detailCost.value) + number(f.fees.value);
      const net = number(f.salePrice.value) - totalCost;
      const sourcer = Math.max(0, net * (number(f.sourcerPercent.value) / 100));
      const sales = Math.max(0, net * (number(f.salesPercent.value) / 100));
      f.totalCost.value = totalCost; f.netProfit.value = net; f.sourcerCommission.value = Math.round(sourcer); f.salesCommission.value = Math.round(sales); f.businessProfit.value = Math.round(net - sourcer - sales);
    };
    $$(".sale-calc").forEach(i => i.addEventListener("input", calc)); calc();
    $("#saleForm").addEventListener("submit", (e) => {
      e.preventDefault(); const data = formData(e.target); const db = getDB();
      const sale = { id: id("sale"), ...data, purchasePrice: number(data.purchasePrice), repairCost: number(data.repairCost), detailCost: number(data.detailCost), fees: number(data.fees), totalCost: number(data.totalCost), salePrice: number(data.salePrice), netProfit: number(data.netProfit), sourcerPercent: number(data.sourcerPercent), salesPercent: number(data.salesPercent), sourcerCommission: number(data.sourcerCommission), salesCommission: number(data.salesCommission), businessProfit: number(data.businessProfit), dateSold: now() };
      db.sales.unshift(sale);
      const vehicle = db.inventory.find(v => v.stock === data.stock);
      if (vehicle) { vehicle.status = "Sold"; vehicle.salePrice = sale.salePrice; vehicle.profit = sale.netProfit; vehicle.soldBy = sale.soldBy; }
      db.treasury.unshift({ id: id("tre"), date: now(), type: "Sale", description: `${data.stock} vehicle sale recorded`, amount: sale.salePrice, handledBy: data.soldBy || userName(), approvedBy: data.approvedBy, notes: `Net profit ${money(sale.netProfit)}. Business final profit ${money(sale.businessProfit)}.`, proof: data.proof, approved: isOwnerRole() });
      if (sale.sourcerCommission > 0) db.payouts.unshift({ id: id("pay"), staff: data.sourcedBy || "Vehicle Sourcer", role: "Sourcer Commission", amount: sale.sourcerCommission, reason: `${data.stock} sourcer commission`, date: now(), status: "Pending", approvedBy: "" });
      if (sale.salesCommission > 0) db.payouts.unshift({ id: id("pay"), staff: data.soldBy || "Sales Rep", role: "Sales Commission", amount: sale.salesCommission, reason: `${data.stock} sales commission`, date: now(), status: "Pending", approvedBy: "" });
      db.logs.unshift({ id: id("log"), action: "Vehicle sold", staff: userName(), date: now(), notes: `${data.stock} ${data.model} sale saved.` });
      saveDB(db);
      sendDiscordAlert("sale", "Vehicle Sale Recorded", {
        "Stock": data.stock,
        "Vehicle": data.model,
        "Sold By": data.soldBy,
        "Sourced By": data.sourcedBy,
        "Sale Price": money(data.salePrice),
        "Net Profit": money(data.netProfit),
        "Business Profit": money(data.businessProfit),
        "Approved By": data.approvedBy || "Not listed"
      }, `${data.stock} ${data.model} sale was recorded.`);
      toast("Sale saved, inventory updated, payouts created."); renderDashboard("sales");
    });
  }
  if (section === "customers" && $("#customerForm")) {
    $("#customerForm").addEventListener("submit", (e) => { e.preventDefault(); const data = formData(e.target); const db = getDB(); db.customers.unshift({ id: id("cust"), ...data }); db.logs.unshift({ id: id("log"), action: "Customer record added", staff: userName(), date: now(), notes: `${data.name} added to customer records.` }); saveDB(db); sendDiscordAlert("customer", "Customer Record Added", { "Name": data.name, "Phone": data.phone, "Interest": data.interest, "Notes": data.notes }, `${data.name} was added to customer records.`); toast("Customer saved."); renderDashboard("customers"); });
  }
  if (section === "staff" && $("#staffForm")) {
    const resetStaffForm = () => {
      const form = $("#staffForm");
      form.reset();
      form.editId.value = "";
      form.displayOrder.value = "99";
      form.showOnAbout.value = "Yes";
      $("#staffFormTitle").textContent = "Add / Edit Employee";
      $("#staffSaveBtn").textContent = "Save Employee";
    };
    $("#clearStaffEdit").addEventListener("click", resetStaffForm);
    $("#staffForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!isManagementRole()) return toast("Only management can edit employee profiles.");
      const data = formData(e.target);
      const db = getDB();
      const editing = Boolean(data.editId);
      const staffRecord = {
        id: editing ? data.editId : id("staff"),
        name: data.name,
        phone: data.phone || "",
        position: data.position,
        role: data.role,
        photo: data.photo || "",
        showOnAbout: data.showOnAbout || "Yes",
        publicVisible: data.showOnAbout !== "No",
        displayOrder: number(data.displayOrder || 99),
        bio: data.bio || "",
        notes: data.notes || ""
      };
      if (editing) {
        const index = db.staff.findIndex(s => s.id === data.editId);
        if (index >= 0) db.staff[index] = { ...db.staff[index], ...staffRecord };
        else db.staff.unshift(staffRecord);
      } else {
        db.staff.unshift(staffRecord);
      }
      db.staff.sort((a, b) => number(a.displayOrder) - number(b.displayOrder) || String(a.name).localeCompare(String(b.name)));
      db.logs.unshift({ id: id("log"), action: editing ? "Staff member updated" : "Staff member added", staff: userName(), date: now(), notes: `${data.name} saved as ${data.position}. Public About Us: ${staffRecord.showOnAbout}.` });
      saveDB(db);
      sendDiscordAlert("websiteAdmin", editing ? "Employee Profile Updated" : "Employee Profile Added", {
        "Employee": data.name,
        "Position": data.position,
        "Role": roles[data.role] || data.role,
        "Show On About Us": staffRecord.showOnAbout,
        "Edited By": userName()
      }, `${data.name} was saved from the staff dashboard.`);
      toast(editing ? "Employee profile updated." : "Employee profile saved."); renderDashboard("staff");
    });
  }
  if (section === "treasury" && $("#treasuryForm")) {
    $("#treasuryForm").addEventListener("submit", (e) => {
      e.preventDefault(); const data = formData(e.target); const db = getDB();
      const negativeTypes = ["Withdrawal", "Purchase", "Payout", "Expense"];
      const amount = Math.abs(number(data.amount)) * (negativeTypes.includes(data.type) ? -1 : 1);
      db.treasury.unshift({ id: id("tre"), ...data, amount, approved: isOwnerRole() });
      db.logs.unshift({ id: id("log"), action: "Treasury entry added", staff: userName(), date: now(), notes: `${data.type}: ${data.description} (${money(amount)}).` });
      saveDB(db);
      sendDiscordAlert("treasury", "Treasury Entry Added", {
        "Type": data.type,
        "Description": data.description,
        "Amount": money(amount),
        "Handled By": data.handledBy || userName(),
        "Approved By": data.approvedBy || "Not listed"
      }, `A treasury entry was added by ${userName()}.`);
      toast("Treasury entry saved."); renderDashboard("treasury");
    });
  }
  if (section === "payouts" && $("#payoutForm")) {
    $("#payoutForm").addEventListener("submit", (e) => { e.preventDefault(); const data = formData(e.target); const db = getDB(); db.payouts.unshift({ id: id("pay"), ...data, amount: number(data.amount), status: "Pending", approvedBy: "" }); db.logs.unshift({ id: id("log"), action: "Payout recorded", staff: userName(), date: now(), notes: `${data.staff} payout pending for ${money(data.amount)}.` }); saveDB(db); sendDiscordAlert("payout", "Payout Recorded", { "Staff": data.staff, "Role": data.role, "Amount": money(data.amount), "Reason": data.reason }, `${data.staff} has a payout pending.`); toast("Payout saved as pending."); renderDashboard("payouts"); });
  }
  if (section === "calculator") bindCommissionCalculator();
}

function bindCommissionCalculator() {
  const form = $("#calculatorForm"); const box = $("#calculatorResults");
  const calc = () => {
    const f = formData(form);
    const totalCost = number(f.purchasePrice) + number(f.repairCost) + number(f.detailCost) + number(f.fees);
    const net = number(f.salePrice) - totalCost;
    let sourcer = 0, sales = 0;
    if (f.samePerson === "yes") sourcer = Math.max(0, net * .25);
    else { sourcer = Math.max(0, net * (number(f.sourcerPercent) / 100)); sales = Math.max(0, net * (number(f.salesPercent) / 100)); }
    const totalPayout = sourcer + sales;
    const business = net - totalPayout;
    const finalTreasury = number(f.treasury) + business;
    box.innerHTML = `<h3>Deal Breakdown</h3>
      <div class="stat-grid" style="grid-template-columns:1fr 1fr">
        ${stat("Total Net Profit", money(net), "Sale minus all costs")}
        ${stat("Sourcer Payout", money(sourcer), f.samePerson === "yes" ? "25% total same-person commission" : `${f.sourcerPercent}% of net profit`)}
        ${stat("Sales Rep Payout", money(sales), f.samePerson === "yes" ? "Included in same-person payout" : `${f.salesPercent}% of net profit`)}
        ${stat("Total Staff Payout", money(totalPayout), "Combined staff commission")}
        ${stat("Business Final Profit", money(business), "Company keeps this")}
        ${stat("Final Treasury", money(finalTreasury), "After company profit")}
      </div>`;
  };
  $$(".commission-input").forEach(i => i.addEventListener("input", calc));
  $("select.commission-input").addEventListener("change", calc);
  calc();
}

window.logout = function logout() { sessionStorage.removeItem(SESSION_KEY); toast("Logged out."); location.hash = "#home"; };
window.approvePurchase = function approvePurchase(reqId, status) {
  if (!isOwnerRole()) return toast("Only Owner or Co-Owner can approve purchases.");
  const db = getDB(); const req = db.purchaseRequests.find(r => r.id === reqId); if (!req) return;
  req.status = status; req.approvedBy = userName();
  db.logs.unshift({ id: id("log"), action: `Purchase ${status.toLowerCase()}`, staff: userName(), date: now(), notes: `${req.model} request marked ${status}.` });
  if (status === "Approved") {
    db.treasury.unshift({ id: id("tre"), date: now(), type: "Purchase", description: `${req.model} purchase approved`, amount: -number(req.lowest), handledBy: req.staff, approvedBy: userName(), notes: `Approved purchase request. Expected profit ${money(req.profit)}.`, proof: req.proof, approved: true });
  }
  saveDB(db); toast(`Purchase request ${status.toLowerCase()}.`); renderDashboard("purchases");
};
window.setApplicationStatus = function setApplicationStatus(appId, status) {
  if (!can("applications")) return toast("Your role cannot change applications.");
  const db = getDB(); const app = db.applications.find(a => a.id === appId); if (!app) return;
  app.status = status;
  db.logs.unshift({ id: id("log"), action: "Application status changed", staff: userName(), date: now(), notes: `${app.name} marked ${status}.` });
  saveDB(db); toast(`Application marked ${status}.`); renderDashboard("applications");
};
window.deleteTreasury = function deleteTreasury(tId) {
  if (!isOwnerRole()) return toast("Only Owner or Co-Owner can delete treasury records.");
  const db = getDB(); const item = db.treasury.find(t => t.id === tId); db.treasury = db.treasury.filter(t => t.id !== tId);
  db.logs.unshift({ id: id("log"), action: "Treasury entry deleted", staff: userName(), date: now(), notes: item ? item.description : tId });
  saveDB(db); toast("Treasury record deleted."); renderDashboard("treasury");
};
window.approvePayout = function approvePayout(pId) {
  if (!isOwnerRole()) return toast("Only Owner or Co-Owner can approve payouts.");
  const db = getDB(); const p = db.payouts.find(x => x.id === pId); if (!p) return;
  p.status = "Approved"; p.approvedBy = userName();
  db.treasury.unshift({ id: id("tre"), date: now(), type: "Payout", description: p.reason, amount: -Math.abs(number(p.amount)), handledBy: p.staff, approvedBy: userName(), notes: `Approved staff payout for ${p.staff}.`, proof: "", approved: true });
  db.logs.unshift({ id: id("log"), action: "Payout approved", staff: userName(), date: now(), notes: `${p.staff} payout approved for ${money(p.amount)}.` });
  saveDB(db); toast("Payout approved and treasury updated."); renderDashboard("payouts");
};

window.editStaff = function editStaff(staffId) {
  if (!isManagementRole()) return toast("Only management can edit employee profiles.");
  const form = $("#staffForm");
  if (!form) return;
  const staff = getDB().staff.find(s => s.id === staffId);
  if (!staff) return toast("Staff member not found.");
  form.editId.value = staff.id || "";
  form.name.value = staff.name || "";
  form.phone.value = staff.phone || "";
  form.position.value = staff.position || "";
  form.role.value = staff.role || "clerk";
  form.photo.value = staff.photo || "";
  form.showOnAbout.value = staff.showOnAbout || (staff.publicVisible === false ? "No" : "Yes");
  form.displayOrder.value = staff.displayOrder ?? 99;
  form.bio.value = staff.bio || "";
  form.notes.value = staff.notes || "";
  $("#staffFormTitle").textContent = `Editing ${staff.name}`;
  $("#staffSaveBtn").textContent = "Update Employee";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
};

window.deleteStaff = function deleteStaff(staffId) {
  if (!isManagementRole()) return toast("Only management can remove employee profiles.");
  const db = getDB();
  const staff = db.staff.find(s => s.id === staffId);
  if (!staff) return;
  if (!confirm(`Remove ${staff.name} from the staff roster and About Us page?`)) return;
  db.staff = db.staff.filter(s => s.id !== staffId);
  db.logs.unshift({ id: id("log"), action: "Staff member removed", staff: userName(), date: now(), notes: `${staff.name} was removed from the roster.` });
  saveDB(db); toast("Employee removed."); renderDashboard("staff");
};

function route() {
  setActiveNav();
  const raw = (location.hash || "#home").replace("#", "");
  const [routeName, sub] = raw.split("/");
  if (routeName === "dashboard") return renderDashboard(sub || "overview");
  const routes = { home: renderHome, about: renderAbout, services: renderServices, inventory: renderPublicInventory, careers: renderCareers, contact: renderContact, login: renderLogin };
  (routes[routeName] || renderHome)();
  $("#app").focus({ preventScroll: true });
}

$("#menuToggle").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
$("#mainNav").addEventListener("click", () => $("#mainNav").classList.remove("open"));
window.addEventListener("hashchange", route);
initCloudSync().finally(route);
