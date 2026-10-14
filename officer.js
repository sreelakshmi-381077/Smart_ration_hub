// ══════════════════════════════════════════════════════════════
//   SMART RATION HUB 2026 — officer.js
//   Supply Officer Portal
//   ✅ Set dealer shop location (lat/lon)
//   ✅ View dealer location on map link
// ══════════════════════════════════════════════════════════════

// ── SUPABASE ──────────────────────────────────────────────────
const SUPABASE_URL = "https://znwpouhmbukhttsccgzd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpud3BvdWhtYnVraHR0c2NjZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MDY4NzEsImV4cCI6MjA5OTk4Mjg3MX0.ODBpp43FrasZp1006uzLXNiy_5TYjIWS_S8ILQv7J8s";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── GLOBAL STATE ──────────────────────────────────────────────
let currentOfficer = null;
let overviewChart  = null;

// ══════════════════════════════════════════════════════════════
// 1. LIVE CLOCK
// ══════════════════════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  const d   = document.getElementById("currentDate");
  const t   = document.getElementById("currentTime");
  if (d) d.textContent = now.toLocaleDateString("en-IN",{
    weekday:"long",year:"numeric",
    month:"long",day:"numeric"
  });
  if (t) t.textContent = now.toLocaleTimeString("en-IN",{
    hour:"2-digit",minute:"2-digit",second:"2-digit"
  });
}
setInterval(updateClock,1000);
updateClock();

// ══════════════════════════════════════════════════════════════
// 2. LOGIN
// ══════════════════════════════════════════════════════════════
document.getElementById("officerLoginBtn")
  .addEventListener("click", async () => {
  const id  = document.getElementById("officerId").value.trim();
  const pwd = document.getElementById("officerPassword").value.trim();
  const err = document.getElementById("officerLoginError");

  if (!id || !pwd) {
    err.style.display = "block";
    err.textContent   = "⚠️ Enter both fields."; return;
  }

  const btn = document.getElementById("officerLoginBtn");
  btn.disabled    = true;
  btn.textContent = "⏳ Logging in...";

  const { data: rows } = await db.from("supply_officers")
    .select("*").eq("officer_id",id).eq("password",pwd).limit(1);
  const data = rows && rows[0] ? rows[0] : null;

  if (data) {
    currentOfficer = data;
    err.style.display = "none";
    document.getElementById("officerLoginPage").style.display = "none";
    document.getElementById("officerDashboard").style.display = "flex";
    document.getElementById("officerName").textContent     = data.name;
    document.getElementById("officerDistrict").textContent =
      "📍 " + data.district;
    document.getElementById("officerIdBadge").textContent  = data.officer_id;
    loadDashboard();
  } else {
    err.style.display = "block";
    err.textContent   =
      "❌ Invalid credentials. Try SO001 / officer123";
  }

  btn.disabled    = false;
  btn.textContent = "🔐 Login";
});

// ══════════════════════════════════════════════════════════════
// 3. LOGOUT
// ══════════════════════════════════════════════════════════════
document.getElementById("officerLogoutBtn")
  .addEventListener("click", () => {
  currentOfficer = null;
  document.getElementById("officerLoginPage").style.display = "flex";
  document.getElementById("officerDashboard").style.display = "none";
  document.getElementById("officerId").value       = "";
  document.getElementById("officerPassword").value = "";
});

// ══════════════════════════════════════════════════════════════
// 4. TAB SWITCHING
// ══════════════════════════════════════════════════════════════
function showTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(t => {
    t.style.display = "none";
  });
  document.querySelectorAll("nav button").forEach(b => {
    b.classList.remove("active");
  });
  const tab = document.getElementById(tabId);
  if (tab) tab.style.display = "block";
  const btn = document.getElementById("btn-" + tabId);
  if (btn) btn.classList.add("active");

  const titles = {
    overviewTab:     "Overview",
    dealersTab:      "Manage Dealers",
    createDealerTab: "Create Dealer Account",
    stockTab:        "Stock Management",
    citizensTab:     "Registered Citizens",
    requestsTab:     "Stock Requests from Dealers",
    reportsTab:      "Reports & Bills"
  };
  const pt = document.getElementById("pageTitle");
  if (pt) pt.textContent = titles[tabId] || "";

  if (tabId === "dealersTab")   loadDealers();
  if (tabId === "stockTab")     loadStock();
  if (tabId === "citizensTab")  loadCitizens();
  if (tabId === "requestsTab")  loadStockRequests();
  if (tabId === "reportsTab")   loadReports();
  if (tabId === "closureTab") {
    loadShopClosures();
    loadDealersForClosure();
  }
  if (tabId === "inconvTab") {
    loadDealerInconveniences();
  }
  if (tabId === "commodityTab") {
    loadCommodities();
  }
  if (tabId === "dealerNoticesTab") {
    loadDealerNoticesForOfficer();
  }
}

// ══════════════════════════════════════════════════════════════
// 5. LOAD DASHBOARD
// ══════════════════════════════════════════════════════════════
async function loadDashboard() {
  await loadOverviewStats();
}

// ══════════════════════════════════════════════════════════════
// 6. OVERVIEW STATS
// ══════════════════════════════════════════════════════════════
async function loadOverviewStats() {
  const today = new Date().toISOString().split("T")[0];
  const { data: dealers } = await db.from("dealers").select("*");
  const { data: users }   = await db.from("users").select("*");
  const { data: tokens }  = await db.from("tokens")
    .select("*").eq("date",today);
  const { data: stock }   = await db.from("stock").select("*");

  document.getElementById("totalDealers").textContent =
    dealers ? dealers.length : 0;
  document.getElementById("totalCitizens").textContent =
    users   ? users.length   : 0;
  document.getElementById("totalTokens").textContent  =
    tokens  ? tokens.length  : 0;

  const totalKg = stock
    ? stock.reduce((s,i) => s + parseFloat(i.available_kg), 0)
    : 0;
  document.getElementById("totalStock").textContent =
    totalKg.toFixed(0);

  // Stock bars
  const ovGrid = document.getElementById("overviewStockGrid");
  if (ovGrid && stock) {
    ovGrid.innerHTML = "";
    const COLORS = {Rice:"#16a34a",Wheat:"#d97706",Sugar:"#9333ea"};
    stock.forEach(item => {
      const kg      = parseFloat(item.available_kg);
      const percent = Math.min((kg/50)*100,100).toFixed(0);
      const color   = COLORS[item.item] || "#7e3af2";
      const div     = document.createElement("div");
      div.className = "ov-stock-row";
      div.innerHTML = `
        <span class="ov-stock-label">${item.item}</span>
        <div class="ov-stock-bar-track">
          <div class="ov-stock-bar-fill"
               style="width:${percent}%;background:${color}">
          </div>
        </div>
        <span class="ov-stock-val" style="color:${color}">
          ${kg} kg
        </span>`;
      ovGrid.appendChild(div);
    });
  }

  if (tokens) {
    const w = tokens.filter(t=>t.status==="waiting").length;
    const s = tokens.filter(t=>t.status==="serving").length;
    const c = tokens.filter(t=>t.status==="completed").length;
    const x = tokens.filter(t=>t.status==="cancelled").length;
    drawChart(w,s,c,x);
  }
}

function drawChart(w,s,c,x) {
  const canvas = document.getElementById("overviewChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (overviewChart) overviewChart.destroy();
  overviewChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Waiting","Serving","Completed","Cancelled"],
      datasets: [{
        data: [w,s,c,x],
        backgroundColor:["#e65100","#1565c0","#2e7d32","#c62828"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position:"bottom" } }
    }
  });
}

// ══════════════════════════════════════════════════════════════
// 7. LOAD DEALERS — with location status
// ══════════════════════════════════════════════════════════════
async function loadDealers() {
  const { data } = await db.from("dealers").select("*")
    .order("created_at",{ascending:false});
  const tbody = document.getElementById("dealersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data || data.length===0) {
    tbody.innerHTML = `<tr><td colspan="8"
      style="text-align:center;padding:24px;color:#999">
      No dealers found.</td></tr>`;
    return;
  }

  data.forEach((d,i) => {
    const badgeClass = d.role==="admin"
      ? "badge-admin" : "badge-dealer";

    // Location status
    const hasLocation = d.latitude && d.longitude;
    const locStatus   = hasLocation
      ? `<span style="color:#15803d;font-size:11px;
                      font-weight:bold">
           ✅ Set<br/>
           <small style="color:#888;font-weight:normal">
             ${parseFloat(d.latitude).toFixed(4)},
             ${parseFloat(d.longitude).toFixed(4)}
           </small>
         </span>`
      : `<span style="color:#c62828;font-size:11px;
                      font-weight:bold">
           ❌ Not Set
         </span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td><strong>${d.dealer_id}</strong></td>
      <td>${d.shop_name}</td>
      <td>📍 ${d.locality}</td>
      <td><span class="${badgeClass}">${d.role.toUpperCase()}</span></td>
      <td>${locStatus}</td>
      <td style="font-size:12px;color:#888">
        ${d.created_at
          ? new Date(d.created_at).toLocaleDateString("en-IN")
          : "—"}
      </td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn-view"
            onclick='viewDealerDetails(${JSON.stringify(d)})'>
            👁 View
          </button>
          <button class="btn-location"
            onclick='openSetLocationModal(${JSON.stringify(d)})'>
            📍 Set Location
          </button>
          <button class="btn-delete"
            onclick="deleteDealer('${d.dealer_id}')">
            🗑 Delete
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function filterDealers() {
  const q = document.getElementById("dealerSearch")
              .value.toLowerCase();
  document.querySelectorAll("#dealersTableBody tr")
    .forEach(row => {
    row.style.display =
      row.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}

// ══════════════════════════════════════════════════════════════
// 8. VIEW DEALER DETAILS
// ══════════════════════════════════════════════════════════════
function viewDealerDetails(d) {
  const hasLoc = d.latitude && d.longitude;
  const mapUrl = hasLoc
    ? `https://www.google.com/maps?q=${d.latitude},${d.longitude}`
    : null;

  document.getElementById("dealerDetailContent").innerHTML = `
    <div class="dealer-detail-row">
      <span>Dealer ID</span>
      <strong>${d.dealer_id}</strong>
    </div>
    <div class="dealer-detail-row">
      <span>Shop Name</span>
      <strong>${d.shop_name}</strong>
    </div>
    <div class="dealer-detail-row">
      <span>Locality</span>
      <strong>📍 ${d.locality}</strong>
    </div>
    <div class="dealer-detail-row">
      <span>Role</span>
      <strong>${d.role.toUpperCase()}</strong>
    </div>
    <div class="dealer-detail-row">
      <span>Latitude</span>
      <strong style="color:${hasLoc?'#15803d':'#c62828'}">
        ${hasLoc ? parseFloat(d.latitude).toFixed(6) : "❌ Not set"}
      </strong>
    </div>
    <div class="dealer-detail-row">
      <span>Longitude</span>
      <strong style="color:${hasLoc?'#15803d':'#c62828'}">
        ${hasLoc ? parseFloat(d.longitude).toFixed(6) : "❌ Not set"}
      </strong>
    </div>
    <div class="dealer-detail-row">
      <span>Location Status</span>
      <strong style="color:${hasLoc?'#15803d':'#c62828'}">
        ${hasLoc
          ? "✅ Location set — Geo verification active"
          : "❌ Not set — Geo verification will auto-set on first use"}
      </strong>
    </div>
    ${hasLoc ? `
    <div class="dealer-detail-row">
      <span>View on Map</span>
      <a href="${mapUrl}" target="_blank"
         style="color:#1565c0;font-size:12px">
        🗺️ Open in Google Maps
      </a>
    </div>` : ""}
    <div class="dealer-detail-row">
      <span>Created</span>
      <strong>${d.created_at
        ? new Date(d.created_at).toLocaleDateString("en-IN")
        : "—"}</strong>
    </div>`;
  document.getElementById("dealerModalOverlay").style.display = "flex";
}

function closeDealerModal() {
  document.getElementById("dealerModalOverlay").style.display = "none";
}

async function deleteDealer(dealerId) {
  if (!confirm(`Delete dealer ${dealerId}?`)) return;
  const { error } = await db.from("dealers")
    .delete().eq("dealer_id",dealerId);
  if (error) { alert("❌ Failed: "+error.message); }
  else { alert("✅ Dealer deleted."); loadDealers(); loadOverviewStats(); }
}

// ══════════════════════════════════════════════════════════════
// 9. SET DEALER LOCATION MODAL
//    Officer sets the registered shop GPS coordinates
//    Dealer must be within 500m of this location
//    during ration distribution time
// ══════════════════════════════════════════════════════════════
function openSetLocationModal(dealer) {
  // Remove existing modal if any
  const existing = document.getElementById("locationModalOverlay");
  if (existing) existing.remove();

  const hasLoc = dealer.latitude && dealer.longitude;

  const overlay = document.createElement("div");
  overlay.id    = "locationModalOverlay";
  overlay.style.cssText = `
    position:fixed;inset:0;
    background:rgba(0,0,0,0.65);
    z-index:300;display:flex;
    align-items:center;justify-content:center`;

  overlay.innerHTML = `
    <div style="background:white;padding:30px;
                border-radius:16px;width:480px;
                max-width:93vw;max-height:90vh;
                overflow-y:auto;
                box-shadow:0 12px 48px rgba(0,0,0,0.25)">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;
                  align-items:start;margin-bottom:20px">
        <div>
          <h3 style="color:#4a1d96;font-size:16px;
                     margin-bottom:4px">
            📍 Set Shop Location
          </h3>
          <p style="color:#888;font-size:12px">
            ${dealer.shop_name} — ${dealer.locality}
          </p>
        </div>
        <button onclick="closeLocationModal()"
                style="background:#fee2e2;color:#c62828;
                       border:none;border-radius:6px;
                       padding:6px 10px;cursor:pointer;
                       font-size:12px;width:auto">
          ✕ Close
        </button>
      </div>

      <!-- Current location status -->
      ${hasLoc ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                  border-radius:8px;padding:12px;margin-bottom:16px">
        <p style="font-size:12px;font-weight:bold;
                  color:#15803d;margin-bottom:4px">
          ✅ Current Saved Location:
        </p>
        <p style="font-size:12px;color:#555">
          Latitude: <strong>${parseFloat(dealer.latitude).toFixed(6)}</strong> |
          Longitude: <strong>${parseFloat(dealer.longitude).toFixed(6)}</strong>
        </p>
        <a href="https://www.google.com/maps?q=${dealer.latitude},${dealer.longitude}"
           target="_blank"
           style="font-size:11px;color:#1565c0">
          🗺️ View on Google Maps
        </a>
      </div>` : `
      <div style="background:#fff3e0;border:1px solid #fde68a;
                  border-radius:8px;padding:12px;margin-bottom:16px">
        <p style="font-size:12px;color:#a16207">
          ⚠️ No location set yet.
          Set location so geo-verification works
          during ration distribution.
        </p>
      </div>`}

      <!-- ⚠️ GPS Warning -->
      <div style="background:#fff3e0;border:1px solid #fde68a;
                  border-radius:10px;padding:14px;
                  margin-bottom:14px">
        <p style="font-size:13px;font-weight:bold;
                  color:#a16207;margin-bottom:6px">
          ⚠️ Important — Laptop GPS is Inaccurate
        </p>
        <p style="font-size:11px;color:#666;line-height:1.6">
          Laptop has NO GPS chip. It uses WiFi triangulation
          which gives <strong>±200m to ±1000m error</strong>.
          Two detections on same laptop give different results
          and will MISMATCH.<br/><br/>
          <strong>✅ Recommended:</strong> Use Google Maps on
          phone to get exact coordinates and enter manually below.
        </p>
      </div>

      <!-- Method 1: Use Current GPS Location -->
      <div style="background:#eff6ff;border:1px solid #bfdbfe;
                  border-radius:10px;padding:16px;margin-bottom:14px">
        <p style="font-size:13px;font-weight:bold;
                  color:#1d4ed8;margin-bottom:8px">
          📱 Method 1 — Auto Detect (Use Phone for Best Result)
        </p>
        <p style="font-size:11px;color:#555;margin-bottom:10px">
          For accurate result, open this page on your
          <strong>phone</strong> at the shop location,
          then click detect. On laptop this may be inaccurate.
        </p>
        <button onclick="useCurrentLocation('${dealer.dealer_id}')"
                id="detectLocationBtn"
                style="width:100%;padding:10px;
                       background:#1d4ed8;color:white;
                       border:none;border-radius:8px;
                       cursor:pointer;font-size:13px">
          📍 Detect My Current Location
        </button>
        <div id="locationDetectMsg"
             style="display:none;margin-top:10px;
                    padding:10px;border-radius:8px;
                    font-size:12px;font-weight:bold"></div>
      </div>

      <!-- Method 2: Manual Entry -->
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;
                  border-radius:10px;padding:16px;margin-bottom:14px">
        <p style="font-size:13px;font-weight:bold;
                  color:#4a1d96;margin-bottom:8px">
          ✏️ Method 2 — Enter Coordinates Manually
        </p>
        <p style="font-size:11px;color:#555;margin-bottom:12px">
          Open Google Maps → Go to shop →
          Right click → Copy coordinates
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr;
                    gap:10px;margin-bottom:12px">
          <div>
            <label style="font-size:11px;font-weight:bold;
                          color:#555;display:block;
                          margin-bottom:4px">
              Latitude (e.g. 9.2648)
            </label>
            <input id="setLat" type="number"
                   step="0.000001" min="-90" max="90"
                   placeholder="9.2648"
                   value="${hasLoc ? parseFloat(dealer.latitude).toFixed(6) : ''}"
                   style="width:100%;padding:9px 10px;
                          border:1.5px solid #ddd6fe;
                          border-radius:6px;font-size:13px"/>
          </div>
          <div>
            <label style="font-size:11px;font-weight:bold;
                          color:#555;display:block;
                          margin-bottom:4px">
              Longitude (e.g. 76.7870)
            </label>
            <input id="setLon" type="number"
                   step="0.000001" min="-180" max="180"
                   placeholder="76.7870"
                   value="${hasLoc ? parseFloat(dealer.longitude).toFixed(6) : ''}"
                   style="width:100%;padding:9px 10px;
                          border:1.5px solid #ddd6fe;
                          border-radius:6px;font-size:13px"/>
          </div>
        </div>

        <button onclick="saveLocation('${dealer.dealer_id}')"
                style="width:100%;padding:10px;
                       background:#4a1d96;color:white;
                       border:none;border-radius:8px;
                       cursor:pointer;font-size:13px">
          💾 Save Location
        </button>
      </div>

      <!-- Kerala Quick Locations -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;
                  border-radius:10px;padding:14px;margin-bottom:14px">
        <p style="font-size:12px;font-weight:bold;
                  color:#475569;margin-bottom:10px">
          🗺️ Quick Select — Kerala District Locations
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;
                    gap:6px">
          ${[
            ["Vaikom",         "9.7519",  "76.3941"],
            ["Kottayam",       "9.5916",  "76.5222"],
            ["Adur",           "9.1667",  "76.7167"],
            ["Pathanamthitta", "9.2648",  "76.7870"],
            ["Thiruvalla",     "9.3833",  "76.5667"],
            ["Alappuzha",      "9.4981",  "76.3388"],
            ["Ernakulam",      "9.9312",  "76.2673"],
            ["Thrissur",       "10.5276", "76.2144"],
            ["Palakkad",       "10.7867", "76.6548"],
            ["Kozhikode",      "11.2588", "75.7804"],
            ["Thiruvananthapuram","8.5241","76.9366"],
            ["Kollam",         "8.8932",  "76.6141"],
            ["Kannur",         "11.8745", "75.3704"]
          ].map(([name,lat,lon]) => `
            <button onclick="fillLocation(${lat},${lon})"
                    style="padding:6px 8px;background:white;
                           border:1px solid #e2e8f0;
                           border-radius:6px;cursor:pointer;
                           font-size:11px;color:#475569;
                           text-align:left;width:auto">
              📍 ${name}
            </button>`).join("")}
        </div>
      </div>

      <!-- Save message -->
      <div id="locationSaveMsg"
           style="display:none;padding:12px;border-radius:8px;
                  font-weight:bold;font-size:13px;
                  text-align:center;margin-bottom:10px">
      </div>

      <!-- Info box -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                  border-radius:8px;padding:10px;
                  font-size:11px;color:#15803d">
        ℹ️ <strong>How geo-verification works:</strong>
        When dealer clicks Serve, system checks if dealer is
        within <strong>500 meters</strong> of this saved location.
        If outside range → ration distribution is blocked.
      </div>

    </div>`;

  document.body.appendChild(overlay);
}

// ── Fill location from quick select ──────────────────────────
function fillLocation(lat, lon) {
  document.getElementById("setLat").value = lat;
  document.getElementById("setLon").value = lon;
}

// ── Detect current GPS location — with retry and accuracy check
function useCurrentLocation(dealerId) {
  const btn = document.getElementById("detectLocationBtn");
  const msg = document.getElementById("locationDetectMsg");

  btn.disabled    = true;
  btn.textContent = "⏳ Detecting...";
  msg.style.display    = "block";
  msg.style.background = "#e0f2fe";
  msg.style.color      = "#0369a1";
  msg.innerHTML        =
    "⏳ Getting your GPS location...<br/>" +
    "<small>This may take 10-15 seconds for accurate result.</small>";

  if (!navigator.geolocation) {
    msg.style.background = "#fee2e2";
    msg.style.color      = "#b91c1c";
    msg.textContent      =
      "❌ Geolocation not supported. Use Google Chrome browser.";
    btn.disabled    = false;
    btn.textContent = "📍 Detect My Current Location";
    return;
  }

  // ── Try multiple times to get best accuracy ───────────────
  let bestPosition = null;
  let attempts     = 0;
  const MAX_TRIES  = 3;

  function tryGetLocation() {
    attempts++;
    msg.style.background = "#e0f2fe";
    msg.style.color      = "#0369a1";
    msg.innerHTML        =
      `⏳ Attempt ${attempts}/${MAX_TRIES}: Getting GPS location...<br/>` +
      `<small>Keep device still for better accuracy.</small>`;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Keep best (most accurate) position
        if (!bestPosition ||
            pos.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = pos;
        }

        const lat = bestPosition.coords.latitude;
        const lon = bestPosition.coords.longitude;
        const acc = bestPosition.coords.accuracy;

        console.log(`📍 Attempt ${attempts}: ` +
          `${lat.toFixed(6)}, ${lon.toFixed(6)} | ` +
          `Accuracy: ±${acc.toFixed(0)}m`);

        // If accuracy is good enough OR all attempts done
        if (acc <= 100 || attempts >= MAX_TRIES) {
          // Fill input fields
          document.getElementById("setLat").value =
            lat.toFixed(6);
          document.getElementById("setLon").value =
            lon.toFixed(6);

          // Show result with accuracy indicator
          let accColor  = "#15803d";
          let accLabel  = "🟢 Excellent accuracy";
          let accAdvice = "This is very accurate. Safe to save.";

          if (acc > 500) {
            accColor  = "#b91c1c";
            accLabel  = "🔴 Poor accuracy";
            accAdvice =
              "Accuracy is poor. Recommend using Google Maps " +
              "to get exact coordinates and enter manually.";
          } else if (acc > 100) {
            accColor  = "#a16207";
            accLabel  = "🟡 Medium accuracy";
            accAdvice =
              "Medium accuracy. For better result, use " +
              "Google Maps to verify coordinates.";
          } else if (acc > 30) {
            accColor  = "#0369a1";
            accLabel  = "🔵 Good accuracy";
            accAdvice =
              "Good accuracy. Safe to save for most cases.";
          }

          msg.style.background = "#dcfce7";
          msg.style.color      = "#15803d";
          msg.innerHTML        = `
            ✅ <strong>Location Detected!</strong><br/><br/>
            📍 Latitude  : <strong>${lat.toFixed(6)}</strong><br/>
            📍 Longitude : <strong>${lon.toFixed(6)}</strong><br/>
            📡 Accuracy  :
              <strong style="color:${accColor}">
                ±${acc.toFixed(0)} meters — ${accLabel}
              </strong><br/>
            <small style="color:#555">
              ${accAdvice}
            </small><br/><br/>
            <small style="color:#888">
              💡 If accuracy is poor, use Google Maps to get
              exact coordinates and enter them manually below.
            </small>`;

          btn.disabled    = false;
          btn.textContent = "🔄 Detect Again";

        } else {
          // Try again for better accuracy
          msg.innerHTML =
            `⏳ Attempt ${attempts}/${MAX_TRIES} done. ` +
            `Accuracy: ±${acc.toFixed(0)}m. ` +
            `Trying again for better result...`;
          setTimeout(tryGetLocation, 2000);
        }
      },

      (err) => {
        let errMsg = "❌ ";
        switch(err.code) {
          case 1:
            errMsg +=
              "Location permission denied!<br/>" +
              "Fix: Click 🔒 in Chrome address bar → " +
              "Location → Allow. Then refresh and try again.<br/>" +
              "Or: Windows Settings → Privacy → Location → " +
              "Turn ON for Chrome.";
            break;
          case 2:
            errMsg +=
              "Location unavailable.<br/>" +
              "Fix: Check internet connection or try on a " +
              "phone with GPS enabled.";
            break;
          case 3:
            errMsg +=
              "Location timeout.<br/>" +
              "Fix: Check GPS signal and try again.";
            break;
          default:
            errMsg += err.message;
        }
        msg.style.background = "#fee2e2";
        msg.style.color      = "#b91c1c";
        msg.innerHTML        = errMsg;
        btn.disabled    = false;
        btn.textContent = "📍 Detect My Current Location";
      },

      {
        enableHighAccuracy: true,
        timeout:            20000,
        maximumAge:         0
      }
    );
  }

  // Start first attempt
  tryGetLocation();
}

// ── Save location to database ─────────────────────────────────
async function saveLocation(dealerId) {
  const latVal = document.getElementById("setLat").value;
  const lonVal = document.getElementById("setLon").value;
  const msg    = document.getElementById("locationSaveMsg");

  const lat = parseFloat(latVal);
  const lon = parseFloat(lonVal);

  // Validation
  if (!latVal || !lonVal || isNaN(lat) || isNaN(lon)) {
    msg.style.display    = "block";
    msg.style.background = "#fee2e2";
    msg.style.color      = "#b91c1c";
    msg.textContent      = "⚠️ Enter valid latitude and longitude.";
    return;
  }
  if (lat < -90 || lat > 90) {
    msg.style.display    = "block";
    msg.style.color      = "#b91c1c";
    msg.textContent      = "⚠️ Latitude must be between -90 and 90.";
    return;
  }
  if (lon < -180 || lon > 180) {
    msg.style.display    = "block";
    msg.style.color      = "#b91c1c";
    msg.textContent      = "⚠️ Longitude must be between -180 and 180.";
    return;
  }

  msg.style.display    = "block";
  msg.style.background = "#e0f2fe";
  msg.style.color      = "#0369a1";
  msg.textContent      = "⏳ Saving location...";

  const { error } = await db.from("dealers")
    .update({ latitude: lat, longitude: lon })
    .eq("dealer_id", dealerId);

  if (error) {
    msg.style.background = "#fee2e2";
    msg.style.color      = "#b91c1c";
    msg.textContent      = "❌ Failed to save: " + error.message;
  } else {
    msg.style.background = "#dcfce7";
    msg.style.color      = "#15803d";
    msg.textContent      =
      `✅ Location saved! `+
      `Lat: ${lat.toFixed(4)}, `+
      `Lon: ${lon.toFixed(4)} for dealer ${dealerId}. `+
      `Geo-verification is now active!`;
    setTimeout(() => {
      closeLocationModal();
      loadDealers();
    }, 2500);
  }
}

// ── Close location modal ──────────────────────────────────────
function closeLocationModal() {
  const overlay = document.getElementById("locationModalOverlay");
  if (overlay) overlay.remove();
}

// ══════════════════════════════════════════════════════════════
// 10. CREATE DEALER
// ══════════════════════════════════════════════════════════════
document.getElementById("createDealerBtn")
  .addEventListener("click", async () => {
  const dealerId = document.getElementById("newDealerId").value.trim();
  const password = document.getElementById("newDealerPassword").value.trim();
  const shopName = document.getElementById("newShopName").value.trim();
  const locality = document.getElementById("newLocality").value.trim();
  const role     = document.getElementById("newRole").value;
  const msg      = document.getElementById("createDealerMsg");

  if (!dealerId||!password||!shopName||!locality) {
    showMsg(msg,"⚠️ Fill all fields.","red"); return;
  }
  if (dealerId.length < 4) {
    showMsg(msg,"⚠️ Dealer ID must be at least 4 characters.","red");
    return;
  }
  if (password.length < 6) {
    showMsg(msg,"⚠️ Password must be at least 6 characters.","red");
    return;
  }

  const { data: existing } = await db.from("dealers")
    .select("dealer_id").eq("dealer_id",dealerId).limit(1);
  if (existing && existing[0]) {
    showMsg(msg,"❌ Dealer ID already exists.","red"); return;
  }

  const btn = document.getElementById("createDealerBtn");
  btn.disabled    = true;
  btn.textContent = "⏳ Creating...";

  const { error } = await db.from("dealers").insert([{
    dealer_id:  dealerId, password, shop_name: shopName,
    locality, role, created_at: new Date().toISOString()
  }]);

  if (error) {
    showMsg(msg,"❌ Failed: "+error.message,"red");
  } else {
    showMsg(msg,
      `✅ Dealer created! ID: ${dealerId} | `+
      `Shop: ${shopName} | Password: ${password}. `+
      `Now go to Manage Dealers to set shop location.`,
      "green"
    );
    document.getElementById("newDealerId").value       = "";
    document.getElementById("newDealerPassword").value = "";
    document.getElementById("newShopName").value       = "";
    document.getElementById("newLocality").value       = "";
    loadOverviewStats();
  }
  btn.disabled    = false;
  btn.textContent = "✅ Create Dealer Account";
});

// ══════════════════════════════════════════════════════════════
// 11. STOCK MANAGEMENT
// ══════════════════════════════════════════════════════════════
async function loadStock() {
  const { data } = await db.from("stock").select("*");
  const row = document.getElementById("stockCardsRow");
  if (!row) return;
  row.innerHTML = "";
  if (!data) return;

  const COLORS = {Rice:"#16a34a",Wheat:"#d97706",Sugar:"#9333ea"};
  const ICONS  = {Rice:"🌾",Wheat:"🌿",Sugar:"🍬"};

  data.forEach(item => {
    const kg      = parseFloat(item.available_kg);
    const percent = Math.min((kg/50)*100,100).toFixed(0);
    const color   = COLORS[item.item] || "#7e3af2";
    const icon    = ICONS[item.item]  || "📦";
    let status="", statusColor="";
    if (kg>=20)      {status="✅ Good";    statusColor="#15803d";}
    else if (kg>=10) {status="⚠️ Low";     statusColor="#a16207";}
    else             {status="🔴 Critical"; statusColor="#b91c1c";}

    const card = document.createElement("div");
    card.className = "stock-card";
    card.innerHTML = `
      <div class="stock-card-icon">${icon}</div>
      <div class="stock-card-name">${item.item}</div>
      <div class="stock-card-kg" style="color:${statusColor}">
        ${kg} kg
      </div>
      <div class="stock-card-bar-track">
        <div class="stock-card-bar-fill"
             style="width:${percent}%;background:${color}"></div>
      </div>
      <div class="stock-card-status" style="color:${statusColor}">
        ${status}
      </div>
      <div class="stock-card-date">
        Updated: ${new Date(item.updated_at)
          .toLocaleDateString("en-IN")}
      </div>`;
    row.appendChild(card);
  });
}

document.getElementById("updateStockBtn")
  .addEventListener("click", async () => {
  const item = document.getElementById("updateItem").value;
  const qty  = parseFloat(document.getElementById("updateQty").value);
  const msg  = document.getElementById("stockUpdateMsg");

  if (!qty||qty<0) {
    showMsg(msg,"⚠️ Enter valid quantity.","red"); return;
  }

  const btn = document.getElementById("updateStockBtn");
  btn.disabled    = true;
  btn.textContent = "⏳ Updating...";

  const { data: existing } = await db.from("stock")
    .select("*").eq("item",item).limit(1);
  let error;
  if (existing && existing[0]) {
    const res = await db.from("stock")
      .update({available_kg:qty,updated_at:new Date().toISOString()})
      .eq("item",item);
    error = res.error;
  } else {
    const res = await db.from("stock").insert([{
      item, available_kg:qty, updated_at:new Date().toISOString()
    }]);
    error = res.error;
  }

  if (error) {
    showMsg(msg,"❌ Failed: "+error.message,"red");
  } else {
    showMsg(msg,`✅ ${item} updated to ${qty} kg!`,"green");
    document.getElementById("updateQty").value = "";
    loadStock();
    loadOverviewStats();
  }
  btn.disabled    = false;
  btn.textContent = "📦 Update Stock";
});

// ══════════════════════════════════════════════════════════════
// 12. CITIZENS
// ══════════════════════════════════════════════════════════════
async function loadCitizens() {
  const { data: users } = await db.from("users").select("*")
    .order("created_at",{ascending:false});
  const { data: fam }   = await db.from("family_members").select("*");
  const tbody = document.getElementById("citizensTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!users||users.length===0) {
    tbody.innerHTML = `<tr><td colspan="6"
      style="text-align:center;padding:24px;color:#999">
      No citizens registered.</td></tr>`;
    return;
  }

  users.forEach((user,i) => {
    const members   = fam
      ? fam.filter(f=>f.ration_card===user.ration_card) : [];
    const withPhoto = members.find(m=>m.photo_url);
    const catClass  = "badge-"+user.category.toLowerCase();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td><strong>${user.ration_card}</strong></td>
      <td><span class="${catClass}">${user.category}</span></td>
      <td>${members.length} members</td>
      <td>
        ${withPhoto
          ? `<img src="${withPhoto.photo_url}"
                  style="width:36px;height:36px;border-radius:50%;
                         object-fit:cover;border:2px solid #7e3af2"/>`
          : `<span style="color:#c62828;font-size:12px">
               ❌ No photo</span>`}
      </td>
      <td style="font-size:12px;color:#888">
        ${user.created_at
          ? new Date(user.created_at).toLocaleDateString("en-IN")
          : "—"}
      </td>`;
    tbody.appendChild(tr);
  });
}

function filterCitizens() {
  const q = document.getElementById("citizenSearch")
              .value.toLowerCase();
  document.querySelectorAll("#citizensTableBody tr")
    .forEach(row => {
    row.style.display =
      row.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}

// ══════════════════════════════════════════════════════════════
// 13. STOCK REQUESTS
// ══════════════════════════════════════════════════════════════
async function loadStockRequests() {
  const tbody = document.getElementById("requestsTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8"
    style="text-align:center;padding:20px;color:#999">
    ⏳ Loading...</td></tr>`;

  const { data } = await db.from("stock_reports").select("*")
    .order("reported_at",{ascending:false});

  tbody.innerHTML = "";
  if (!data||data.length===0) {
    tbody.innerHTML = `<tr><td colspan="8"
      style="text-align:center;padding:24px;color:#999">
      No stock requests yet.</td></tr>`;
    return;
  }

  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-size:12px">
        ${new Date(r.reported_at).toLocaleDateString("en-IN")}
      </td>
      <td><strong>${r.ration_card}</strong></td>
      <td>—</td>
      <td>${r.item}</td>
      <td>${r.quantity_received} kg</td>
      <td style="color:#15803d;font-weight:bold">Normal</td>
      <td style="font-size:12px;color:#555">Stock request</td>
      <td>
        <button class="btn-approve"
          onclick="approveRequest('${r.id}','${r.item}',
            ${r.quantity_received})">
          ✅ Approve
        </button>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function approveRequest(requestId, item, qty) {
  if (!confirm(`Approve? Item: ${item} | Qty: ${qty} kg`)) return;
  const { data: existing } = await db.from("stock")
    .select("*").eq("item",item).limit(1);
  if (existing && existing[0]) {
    const newQty =
      parseFloat(existing[0].available_kg) + parseFloat(qty);
    await db.from("stock")
      .update({available_kg:newQty,updated_at:new Date().toISOString()})
      .eq("item",item);
  }
  alert(`✅ Approved! ${item} stock increased by ${qty} kg.`);
  loadStockRequests();
  loadOverviewStats();
}

// ══════════════════════════════════════════════════════════════
// 14. REPORTS
// ══════════════════════════════════════════════════════════════
async function loadReports() {
  const { data: bills } = await db.from("bills").select("*")
    .order("bill_date",{ascending:false}).limit(20);
  const billTbody = document.getElementById("billsTableBody");
  if (billTbody) {
    billTbody.innerHTML = "";
    if (!bills||bills.length===0) {
      billTbody.innerHTML = `<tr><td colspan="4"
        style="text-align:center;padding:16px;color:#999">
        No bills yet.</td></tr>`;
    } else {
      bills.forEach(b => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-size:11px">${b.bill_number}</td>
          <td>${b.ration_card}</td>
          <td>${b.month} ${b.year}</td>
          <td style="font-weight:bold;color:#2e7d32">
            ₹${parseFloat(b.total_amount).toFixed(2)}
          </td>`;
        billTbody.appendChild(tr);
      });
    }
  }

  const { data: reports } = await db.from("stock_reports")
    .select("*")
    .order("reported_at",{ascending:false}).limit(20);
  const repTbody = document.getElementById("citizenReportsBody");
  if (repTbody) {
    repTbody.innerHTML = "";
    if (!reports||reports.length===0) {
      repTbody.innerHTML = `<tr><td colspan="4"
        style="text-align:center;padding:16px;color:#999">
        No reports yet.</td></tr>`;
    } else {
      reports.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.ration_card}</td>
          <td>${r.item}</td>
          <td>${r.quantity_received} kg</td>
          <td style="font-size:12px;color:#888">
            ${new Date(r.reported_at).toLocaleDateString("en-IN")}
          </td>`;
        repTbody.appendChild(tr);
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════
// 15. HELPER
// ══════════════════════════════════════════════════════════════
function showMsg(el, text, color) {
  if (!el) return;
  el.style.display    = "block";
  el.style.color      =
    color==="green" ?"#15803d":
    color==="red"   ?"#b91c1c":
    color==="orange"?"#e65100":"#333";
  el.style.background =
    color==="green" ?"#f0fdf4":
    color==="red"   ?"#fff1f2":
    color==="orange"?"#fff7ed":"#f9fafb";
  el.textContent = text;
}

// ══════════════════════════════════════════════════════════════
// SHOP CLOSURE MANAGEMENT — OFFICER SIDE
// ══════════════════════════════════════════════════════════════

// Load all closures in officer dashboard
async function loadShopClosures() {
  const list = document.getElementById("closureList");
  if (!list) return;

  list.innerHTML = `<p style="color:#888;text-align:center;
    padding:20px">⏳ Loading...</p>`;

  const today = new Date().toISOString().split("T")[0];

  const { data: closures } = await db
    .from("shop_closures")
    .select("*")
    .eq("is_active", true)
    .order("closure_date", { ascending: false });

  if (!closures || closures.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:30px;color:#888">
        <div style="font-size:40px;margin-bottom:10px">✅</div>
        <div style="font-size:14px;font-weight:bold">
          No Active Shop Closures
        </div>
        <div style="font-size:12px;margin-top:6px">
          All shops are currently open for distribution
        </div>
      </div>`;
    return;
  }

  list.innerHTML = closures.map(c => {
    const isToday  = c.closure_date === today;
    const isPast   = c.closure_date < today;
    const isFuture = c.closure_date > today;
    const dateFmt  = new Date(c.closure_date)
      .toLocaleDateString("en-IN", {
        weekday:"long", day:"2-digit",
        month:"long", year:"numeric"
      });

    return `
      <div style="border:2px solid ${isToday?'#b91c1c':
                                     isFuture?'#1565c0':'#aaa'};
                  border-radius:12px;overflow:hidden;
                  margin-bottom:12px">
        <div style="background:${isToday?'#b91c1c':
                                  isFuture?'#1565c0':'#9e9e9e'};
                    padding:12px 16px;color:white;
                    display:flex;justify-content:space-between;
                    align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:14px;font-weight:bold">
              ${isToday?'🔴':'📅'} ${c.shop_name}
              — ${c.locality}
            </div>
            <div style="font-size:11px;opacity:0.9;
                        margin-top:2px">
              ${isToday?'🚨 CLOSED TODAY':
                isFuture?`📅 Closing on ${dateFmt}`:
                         `⏰ Was closed on ${dateFmt}`}
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <button onclick="removeShopClosure('${c.id}')"
                    style="background:rgba(255,255,255,0.2);
                           color:white;border:1px solid
                           rgba(255,255,255,0.4);
                           padding:5px 10px;font-size:11px;
                           border-radius:6px;width:auto">
              🗑️ Remove
            </button>
          </div>
        </div>
        <div style="padding:12px 16px;background:white">
          <div style="font-size:12px;font-weight:bold;
                      color:#333;margin-bottom:4px">
            📋 Reason: ${c.reason}
          </div>
          ${c.message ? `
          <div style="font-size:12px;color:#555;
                      margin-top:6px;padding:8px 12px;
                      background:#f9fafb;border-radius:6px">
            💬 Message: ${c.message}
          </div>` : ""}
          <div style="font-size:11px;color:#888;margin-top:8px">
            🏪 Dealer: ${c.dealer_id} |
            Added by: ${c.created_by} |
            Date: ${c.closure_date}
          </div>
        </div>
      </div>`;
  }).join("");
}

// Add shop closure
async function addShopClosure() {
  const dealerId    =
    document.getElementById("closureDealerId")?.value;
  const date        =
    document.getElementById("closureDate")?.value;
  const reason      =
    document.getElementById("closureReason")?.value.trim();
  const message     =
    document.getElementById("closureMessage")?.value.trim();
  const msg         =
    document.getElementById("closureMsg");

  if (!dealerId || !date || !reason) {
    showMsg(msg,
      "⚠️ Select dealer, date and reason.", "red");
    return;
  }

  // Fetch dealer info
  const { data: dealers } = await db
    .from("dealers").select("*")
    .eq("dealer_id", dealerId).limit(1);
  const dealer = dealers && dealers[0] ? dealers[0] : null;
  if (!dealer) {
    showMsg(msg, "❌ Dealer not found.", "red"); return;
  }

  const { error } = await db.from("shop_closures").insert([{
    dealer_id:  dealerId,
    shop_name:  dealer.shop_name,
    locality:   dealer.locality,
    closure_date: date,
    reason,
    message,
    is_active:  true,
    created_by: currentOfficer.officer_id
  }]);

  if (error) {
    showMsg(msg, "❌ " + error.message, "red"); return;
  }

  showMsg(msg,
    `✅ Closure notice added for ${dealer.shop_name}!`,
    "green");

  // Clear form
  document.getElementById("closureDate").value    = "";
  document.getElementById("closureReason").value  = "";
  document.getElementById("closureMessage").value = "";

  loadShopClosures();
}

// Remove closure
async function removeShopClosure(id) {
  if (!confirm("Remove this closure notice?")) return;
  await db.from("shop_closures")
    .update({ is_active: false })
    .eq("id", id);
  loadShopClosures();
}

// Load dealers in closure dropdown
async function loadDealersForClosure() {
  const sel = document.getElementById("closureDealerId");
  if (!sel) return;
  const { data } = await db.from("dealers")
    .select("*").eq("role","dealer");
  sel.innerHTML =
    "<option value=''>-- Select Shop --</option>";
  if (!data) return;
  data.forEach(d => {
    const o = document.createElement("option");
    o.value       = d.dealer_id;
    o.textContent =
      `${d.shop_name} — ${d.locality}`;
    sel.appendChild(o);
  });
}

// ══════════════════════════════════════════════════════════════
// DEALER NOTICES — OFFICER SIDE
// Review, add note and publish to citizens
// ══════════════════════════════════════════════════════════════

// Load all dealer inconvenience reports
async function loadDealerNoticesForOfficer() {
  const list   = document.getElementById("officerNoticesList");
  if (!list) return;

  const filter =
    document.getElementById("noticeFilter")?.value || "all";

  list.innerHTML = `
    <p style="color:#888;text-align:center;padding:20px">
      ⏳ Loading...
    </p>`;

  let query = db.from("dealer_notices")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data: notices } = await query;

  if (!notices || notices.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:30px;color:#888">
        <div style="font-size:40px;margin-bottom:10px">✅</div>
        <div style="font-size:14px;font-weight:bold">
          No Reports Found
        </div>
        <div style="font-size:12px;margin-top:6px">
          No dealer inconvenience reports at this time
        </div>
      </div>`;
    return;
  }

  const statusMap = {
    pending:  { bg:"#fff3e0", color:"#a16207",
                border:"#fde68a", label:"⏳ Pending" },
    reviewed: { bg:"#eff6ff", color:"#1565c0",
                border:"#bfdbfe", label:"🔍 Reviewed" },
    published:{ bg:"#dcfce7", color:"#15803d",
                border:"#bbf7d0", label:"✅ Published" },
    rejected: { bg:"#fee2e2", color:"#b91c1c",
                border:"#fca5a5", label:"❌ Rejected" }
  };

  list.innerHTML = notices.map(n => {
    const s = statusMap[n.status] || statusMap.pending;
    const dateFmt = new Date(n.notice_date + "T00:00:00")
      .toLocaleDateString("en-IN", {
        weekday:"long", day:"2-digit",
        month:"long", year:"numeric"
      });
    const submAt  = new Date(n.created_at)
      .toLocaleString("en-IN", {
        day:"2-digit", month:"short", year:"numeric",
        hour:"2-digit", minute:"2-digit"
      });

    return `
      <div id="notice_${n.id}"
           style="border:2px solid ${s.border};
                  border-radius:14px;overflow:hidden;
                  margin-bottom:16px;
                  box-shadow:0 2px 8px rgba(0,0,0,0.06)">

        <!-- Notice Header -->
        <div style="background:${s.bg};padding:14px 18px;
                    border-bottom:1px solid ${s.border};
                    display:flex;justify-content:space-between;
                    align-items:start;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:14px;font-weight:bold;
                        color:${s.color}">
              🏪 ${n.shop_name} — ${n.locality}
            </div>
            <div style="font-size:12px;color:#555;
                        margin-top:3px">
              Dealer: ${n.dealer_id} |
              Submitted: ${submAt}
            </div>
          </div>
          <div style="display:flex;align-items:center;
                      gap:8px;flex-wrap:wrap">
            <span style="background:${s.color};color:white;
                         padding:4px 12px;border-radius:20px;
                         font-size:12px;font-weight:bold">
              ${s.label}
            </span>
          </div>
        </div>

        <!-- Notice Content -->
        <div style="padding:16px 18px;background:white">

          <!-- Date and Reason -->
          <div style="display:flex;gap:12px;flex-wrap:wrap;
                      margin-bottom:12px">
            <div style="background:#f9fafb;
                        border:1px solid #e5e7eb;
                        border-radius:8px;padding:10px 14px;
                        flex:1;min-width:150px">
              <div style="font-size:10px;color:#888;
                          text-transform:uppercase;
                          margin-bottom:3px">
                Date of Issue
              </div>
              <div style="font-size:13px;font-weight:bold;
                          color:#333">
                📅 ${dateFmt}
              </div>
            </div>
            <div style="background:#f9fafb;
                        border:1px solid #e5e7eb;
                        border-radius:8px;padding:10px 14px;
                        flex:2;min-width:200px">
              <div style="font-size:10px;color:#888;
                          text-transform:uppercase;
                          margin-bottom:3px">
                Reason
              </div>
              <div style="font-size:13px;font-weight:bold;
                          color:#b91c1c">
                📋 ${n.reason}
              </div>
            </div>
          </div>

          <!-- Dealer Message -->
          <div style="background:#fff8f0;border:1px solid #fde68a;
                      border-radius:8px;padding:12px 14px;
                      margin-bottom:14px">
            <div style="font-size:11px;font-weight:bold;
                        color:#a16207;margin-bottom:4px">
              💬 Dealer's Message:
            </div>
            <div style="font-size:13px;color:#333;
                        line-height:1.6">
              ${n.message}
            </div>
          </div>

          ${n.status !== "published" &&
            n.status !== "rejected" ? `
          <!-- Officer Action Form -->
          <div style="background:#f0fdf4;
                      border:1px solid #bbf7d0;
                      border-radius:10px;padding:14px;
                      margin-bottom:12px">
            <div style="font-size:12px;font-weight:bold;
                        color:#1b5e20;margin-bottom:10px">
              👮 Officer Action
            </div>

            <!-- Officer Note -->
            <div style="margin-bottom:10px">
              <label style="font-size:11px;color:#555;
                            display:block;margin-bottom:4px;
                            font-weight:bold">
                Add Note for Citizens (optional):
              </label>
              <textarea id="officerNote_${n.id}" rows="2"
                        placeholder="e.g. Shop will reopen tomorrow.
We apologize for the inconvenience. Please visit on Monday."
                        style="width:100%;padding:8px 12px;
                               border:1.5px solid #bbf7d0;
                               border-radius:8px;font-size:12px;
                               resize:vertical">
              </textarea>
            </div>

            <!-- Action Buttons -->
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button onclick="publishDealerNotice('${n.id}')"
                      style="flex:1;min-width:140px;
                             background:#2e7d32;color:white;
                             padding:10px;font-size:13px;
                             border:none;border-radius:8px;
                             cursor:pointer;font-weight:bold">
                📢 Publish to All Citizens
              </button>
              <button onclick="rejectDealerNotice('${n.id}')"
                      style="flex:1;min-width:120px;
                             background:#9e9e9e;color:white;
                             padding:10px;font-size:13px;
                             border:none;border-radius:8px;
                             cursor:pointer;font-weight:bold">
                ❌ Reject / Not Required
              </button>
            </div>
            <p id="noticeActionMsg_${n.id}"
               style="display:none;margin-top:8px;
                      padding:8px 12px;border-radius:8px;
                      font-size:12px;font-weight:bold"></p>
          </div>` : ""}

          ${n.officer_note ? `
          <!-- Officer's Note -->
          <div style="background:#eff6ff;
                      border:1px solid #bfdbfe;
                      border-radius:8px;padding:12px 14px">
            <div style="font-size:11px;font-weight:bold;
                        color:#1565c0;margin-bottom:4px">
              👮 Officer's Note:
            </div>
            <div style="font-size:13px;color:#333;
                        line-height:1.6">
              ${n.officer_note}
            </div>
          </div>` : ""}

          ${n.is_published ? `
          <div style="margin-top:10px;background:#dcfce7;
                      border:1px solid #bbf7d0;
                      border-radius:8px;padding:10px 14px;
                      font-size:12px;color:#15803d;
                      font-weight:bold">
            📢 ✅ This notice is LIVE on all citizen
            dashboards. Citizens can see this before login.
          </div>` : ""}
        </div>
      </div>`;
  }).join("");
}

// Publish dealer notice to citizens
async function publishDealerNotice(noticeId) {
  const officerNoteEl =
    document.getElementById(`officerNote_${noticeId}`);
  const msgEl =
    document.getElementById(`noticeActionMsg_${noticeId}`);
  const officerNote =
    officerNoteEl ? officerNoteEl.value.trim() : "";

  // Update status to published
  const { error } = await db.from("dealer_notices")
    .update({
      status:       "published",
      is_published: true,
      officer_note: officerNote,
      updated_at:   new Date().toISOString()
    })
    .eq("id", noticeId);

  if (error) {
    if (msgEl) {
      msgEl.style.display    = "block";
      msgEl.style.background = "#fee2e2";
      msgEl.style.color      = "#b91c1c";
      msgEl.textContent      = "❌ " + error.message;
    }
    return;
  }

  if (msgEl) {
    msgEl.style.display    = "block";
    msgEl.style.background = "#dcfce7";
    msgEl.style.color      = "#15803d";
    msgEl.textContent =
      "✅ Published! Citizens can see this on their dashboard.";
  }

  setTimeout(loadDealerNoticesForOfficer, 1500);
}

// Reject dealer notice
async function rejectDealerNotice(noticeId) {
  const officerNoteEl =
    document.getElementById(`officerNote_${noticeId}`);
  const msgEl =
    document.getElementById(`noticeActionMsg_${noticeId}`);
  const officerNote = officerNoteEl
    ? officerNoteEl.value.trim()
    : "Not required.";

  const { error } = await db.from("dealer_notices")
    .update({
      status:       "rejected",
      is_published: false,
      officer_note: officerNote || "Reviewed by officer.",
      updated_at:   new Date().toISOString()
    })
    .eq("id", noticeId);

  if (error) {
    if (msgEl) {
      msgEl.style.display    = "block";
      msgEl.style.background = "#fee2e2";
      msgEl.style.color      = "#b91c1c";
      msgEl.textContent      = "❌ " + error.message;
    }
    return;
  }

  setTimeout(loadDealerNoticesForOfficer, 1500);
}

// ══════════════════════════════════════════════════════════════
// DEALER INCONVENIENCE REVIEW — OFFICER SIDE
// ══════════════════════════════════════════════════════════════

let allInconveniences = [];

async function loadDealerInconveniences(filter = "all") {
  const list = document.getElementById("dealerInconvList");
  if (!list) return;

  list.innerHTML = `<p style="color:#888;text-align:center;
    padding:30px">⏳ Loading...</p>`;

  let query = db.from("dealer_inconvenience")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: reports } = await query;
  allInconveniences = reports || [];

  renderInconveniences(filter);
}

function filterInconv(filter) {
  // Update button styles
  ["all","pending","approved","rejected"].forEach(f => {
    const btn = document.getElementById(`inconvFilter${
      f.charAt(0).toUpperCase() + f.slice(1)}`);
    if (btn) {
      btn.style.background = f === filter ? "#1b5e20" : "#e5e7eb";
      btn.style.color      = f === filter ? "white"   : "#333";
    }
  });
  renderInconveniences(filter);
}

function renderInconveniences(filter = "all") {
  const list = document.getElementById("dealerInconvList");
  if (!list) return;

  const filtered = filter === "all"
    ? allInconveniences
    : allInconveniences.filter(r => r.status === filter);

  if (filtered.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:40px;color:#888">
        <div style="font-size:40px;margin-bottom:10px">📋</div>
        <div style="font-size:14px;font-weight:bold">
          No ${filter === "all" ? "" : filter} reports found
        </div>
      </div>`;
    return;
  }

  const statusMap = {
    pending:  { bg:"#fff3e0", color:"#a16207",
                border:"#fde68a", label:"⏳ Pending" },
    approved: { bg:"#dcfce7", color:"#15803d",
                border:"#bbf7d0", label:"✅ Approved" },
    rejected: { bg:"#fee2e2", color:"#b91c1c",
                border:"#fca5a5", label:"❌ Rejected" }
  };

  list.innerHTML = filtered.map(r => {
    const s      = statusMap[r.status] || statusMap.pending;
    const dateFmt = new Date(r.affect_date + "T00:00:00")
      .toLocaleDateString("en-IN", {
        weekday:"long", day:"2-digit",
        month:"long", year:"numeric"
      });
    const created = new Date(r.created_at)
      .toLocaleString("en-IN", {
        day:"2-digit", month:"short", year:"numeric",
        hour:"2-digit", minute:"2-digit"
      });

    return `
      <div style="border:2px solid ${s.border};
                  border-radius:12px;overflow:hidden;
                  margin-bottom:16px;
                  box-shadow:0 2px 8px rgba(0,0,0,0.06)">

        <!-- Report Header -->
        <div style="background:${s.bg};padding:14px 18px;
                    border-bottom:1px solid ${s.border}">
          <div style="display:flex;justify-content:space-between;
                      align-items:start;flex-wrap:wrap;gap:8px">
            <div>
              <div style="font-size:15px;font-weight:bold;
                          color:#333;margin-bottom:4px">
                🏪 ${r.shop_name} — ${r.locality}
              </div>
              <div style="font-size:12px;color:#555">
                🚨 ${r.reason}
              </div>
              <div style="font-size:11px;color:#888;
                          margin-top:4px">
                📅 Affects: <strong>${dateFmt}</strong>
                | Submitted: ${created}
                | Dealer: ${r.dealer_id}
              </div>
            </div>
            <div style="background:${s.color};color:white;
                        padding:5px 14px;border-radius:20px;
                        font-size:12px;font-weight:bold;
                        white-space:nowrap">
              ${s.label}
            </div>
          </div>
        </div>

        <!-- Message -->
        <div style="padding:14px 18px;background:white">
          <div style="font-size:13px;color:#333;
                      margin-bottom:12px;
                      padding:10px 14px;
                      background:#f9fafb;
                      border-radius:8px;
                      border-left:4px solid ${s.border}">
            💬 "${r.message}"
          </div>

          ${r.officer_note
            ? `<div style="font-size:12px;color:#1565c0;
                           margin-bottom:12px">
                 👮 Officer Note: <strong>${r.officer_note}</strong>
               </div>`
            : ""}

          <!-- Action Buttons — only for pending -->
          ${r.status === "pending" ? `
            <div style="background:#f8fafc;border:1px solid #e5e7eb;
                        border-radius:10px;padding:14px;
                        margin-bottom:12px">
              <div style="font-size:12px;font-weight:bold;
                          color:#333;margin-bottom:10px">
                👮 Officer Response:
              </div>
              <textarea id="officerNote_${r.id}"
                        placeholder="Optional note to dealer and citizens..."
                        rows="2"
                        style="width:100%;padding:9px 12px;
                               border:1.5px solid #e5e7eb;
                               border-radius:8px;font-size:12px;
                               font-family:inherit;resize:vertical;
                               margin-bottom:10px"></textarea>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button onclick="approveInconvenience('${r.id}',
                                   '${r.dealer_id}',
                                   '${r.shop_name}',
                                   '${r.locality}',
                                   '${r.affect_date}',
                                   \`${r.reason}\`,
                                   \`${r.message}\`)"
                        style="flex:1;min-width:140px;padding:10px;
                               background:#15803d;color:white;
                               border:none;border-radius:8px;
                               cursor:pointer;font-size:13px;
                               font-weight:bold">
                  ✅ Approve & Notify Everyone
                </button>
                <button onclick="rejectInconvenience('${r.id}')"
                        style="flex:1;min-width:140px;padding:10px;
                               background:#b91c1c;color:white;
                               border:none;border-radius:8px;
                               cursor:pointer;font-size:13px;
                               font-weight:bold">
                  ❌ Reject Report
                </button>
              </div>
              <p id="inconvActionMsg_${r.id}"
                 style="display:none;margin-top:10px;
                        padding:10px;border-radius:8px;
                        font-size:12px;font-weight:bold"></p>
            </div>` : ""}

          ${r.status === "approved"
            ? `<div style="background:#dcfce7;
                           border:1px solid #bbf7d0;
                           border-radius:8px;padding:10px 14px;
                           font-size:12px;color:#15803d;
                           font-weight:bold">
                 ✅ Notice sent to all dashboards.
                 Citizens can see this before and after login.
               </div>`
            : ""}
          ${r.status === "rejected"
            ? `<div style="background:#fee2e2;
                           border:1px solid #fca5a5;
                           border-radius:8px;padding:10px 14px;
                           font-size:12px;color:#b91c1c">
                 ❌ Report rejected. No notice sent to citizens.
               </div>`
            : ""}
        </div>
      </div>`;
  }).join("");
}

// ── Approve Inconvenience → Auto create shop closure notice ──
async function approveInconvenience(
  id, dealerId, shopName, locality,
  affectDate, reason, message
) {
  const noteEl  =
    document.getElementById(`officerNote_${id}`);
  const officerNote = noteEl ? noteEl.value.trim() : "";
  const msgEl   =
    document.getElementById(`inconvActionMsg_${id}`);

  // Update status to approved
  const { error: updErr } = await db
    .from("dealer_inconvenience")
    .update({
      status:      "approved",
      officer_note: officerNote,
      reviewed_by: currentOfficer.officer_id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", id);

  if (updErr) {
    if (msgEl) showMsg(msgEl, "❌ " + updErr.message, "red");
    return;
  }

  // Auto create shop_closure entry
  const fullMessage = officerNote
    ? `${message} | Officer note: ${officerNote}`
    : message;

  const { error: closErr } = await db
    .from("shop_closures")
    .insert([{
      dealer_id:    dealerId,
      shop_name:    shopName,
      locality:     locality,
      closure_date: affectDate,
      reason:       reason,
      message:      fullMessage,
      is_active:    true,
      created_by:   currentOfficer.officer_id
    }]);

  if (closErr && !closErr.message.includes("duplicate")) {
    console.log("Closure note:", closErr.message);
  }

  if (msgEl) {
    msgEl.style.display    = "block";
    msgEl.style.background = "#dcfce7";
    msgEl.style.color      = "#15803d";
    msgEl.style.padding    = "10px";
    msgEl.style.borderRadius = "8px";
    msgEl.textContent =
      "✅ Approved! Closure notice sent to all dashboards " +
      "automatically. Citizens will see it before login.";
  }

  // Reload after 2 seconds
  setTimeout(() => loadDealerInconveniences(), 2000);
}

// ── Reject Inconvenience ──────────────────────────────────────
async function rejectInconvenience(id) {
  const noteEl =
    document.getElementById(`officerNote_${id}`);
  const officerNote = noteEl ? noteEl.value.trim() : "";
  const msgEl  =
    document.getElementById(`inconvActionMsg_${id}`);

  const { error } = await db
    .from("dealer_inconvenience")
    .update({
      status:       "rejected",
      officer_note: officerNote || "Not approved.",
      reviewed_by:  currentOfficer.officer_id,
      reviewed_at:  new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    if (msgEl) showMsg(msgEl, "❌ " + error.message, "red");
    return;
  }

  if (msgEl) {
    msgEl.style.display    = "block";
    msgEl.style.background = "#fee2e2";
    msgEl.style.color      = "#b91c1c";
    msgEl.style.padding    = "10px";
    msgEl.style.borderRadius = "8px";
    msgEl.textContent =
      "❌ Report rejected. Dealer notified. No notice sent.";
  }

  setTimeout(() => loadDealerInconveniences(), 2000);
}

// ══════════════════════════════════════════════════════════════
// COMMODITY MANAGEMENT — SUPPLY OFFICER
// Add / Edit / Delete commodities on stock board
// ══════════════════════════════════════════════════════════════

// Commodity icons map
const COMMODITY_ICONS = {
  rice:      "🌾",
  wheat:     "🌿",
  sugar:     "🍬",
  kerosene:  "🛢️",
  oil:       "🫙",
  dal:       "🫘",
  pulses:    "🫘",
  salt:      "🧂",
  flour:     "🌾",
  maize:     "🌽",
  jowar:     "🌾",
  bajra:     "🌾",
  ragi:      "🌾",
  millets:   "🌾",
  tea:       "🍵",
  soap:      "🧼",
  default:   "📦"
};

function getCommodityIcon(name) {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(COMMODITY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return COMMODITY_ICONS.default;
}

// ── Photo Preview ────────────────────────────────────────────
function previewCommodityPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const preview = document.getElementById(
    "commodityPhotoPreview"
  );
  const img     = document.getElementById("commodityPhotoImg");
  const reader  = new FileReader();
  reader.onload = (e) => {
    if (img)     img.src              = e.target.result;
    if (preview) preview.style.display = "block";
    updateCommodityPreview();
  };
  reader.readAsDataURL(input.files[0]);
}

// ── Live preview when typing ──────────────────────────────────
function updateCommodityPreview() {
  const name   =
    document.getElementById("newCommodityName")?.value.trim();
  const qty    =
    document.getElementById("newCommodityQty")?.value;
  const govt   =
    document.getElementById("newCommodityGovtPrice")?.value;
  const mkt    =
    document.getElementById("newCommodityMarketPrice")?.value;
  const unit   =
    document.getElementById("newCommodityUnit")?.value || "kg";
  const preview=
    document.getElementById("commodityPreview");

  if (!name) { if(preview) preview.style.display="none"; return; }
  if (preview) preview.style.display = "block";

  const icon    = getCommodityIcon(name);
  const el      = (id) => document.getElementById(id);
  const photoEl = document.getElementById("commodityPhotoImg");
  const photoSrc = photoEl && photoEl.src &&
    !photoEl.src.endsWith("/") ? photoEl.src : "";

  // Show photo or icon in preview
  const prevIcon = el("prevIcon");
  if (prevIcon) {
    if (photoSrc) {
      prevIcon.innerHTML = `
        <img src="${photoSrc}"
             style="width:48px;height:48px;
                    border-radius:10px;
                    object-fit:cover;
                    border:2px solid #2e7d32"/>`;
    } else {
      prevIcon.textContent = icon;
      prevIcon.style.fontSize = "36px";
    }
  }

  if (el("prevName"))  el("prevName").textContent  = name;
  if (el("prevQty"))
    el("prevQty").textContent =
      qty ? `${qty} ${unit}` : "—";
  if (el("prevGovt"))
    el("prevGovt").textContent =
      govt ? `₹${govt}/${unit}` : "—";
  if (el("prevMkt"))
    el("prevMkt").textContent  =
      mkt ? `₹${mkt}/${unit}` : "—";
}

// ── Add New Commodity ─────────────────────────────────────────
async function addNewCommodity() {
  const name   =
    document.getElementById("newCommodityName")?.value.trim();
  const unit   =
    document.getElementById("newCommodityUnit")?.value || "kg";
  const govtP  =
    parseFloat(document.getElementById("newCommodityGovtPrice")?.value || 0);
  const mktP   =
    parseFloat(document.getElementById("newCommodityMarketPrice")?.value || 0);
  const qty    =
    parseFloat(document.getElementById("newCommodityQty")?.value || 0);
  const desc   =
    document.getElementById("newCommodityDesc")?.value.trim() || "";
  const msg    =
    document.getElementById("commodityMsg");

  // Validations
  if (!name) {
    showMsg(msg, "⚠️ Enter commodity name.", "red"); return;
  }
  if (govtP <= 0) {
    showMsg(msg, "⚠️ Enter valid govt. price.", "red"); return;
  }
  if (mktP <= 0) {
    showMsg(msg, "⚠️ Enter valid market price.", "red"); return;
  }
  if (qty <= 0) {
    showMsg(msg, "⚠️ Enter available quantity.", "red"); return;
  }
  if (govtP >= mktP) {
    showMsg(msg,
      "⚠️ Govt. price should be less than market price.",
      "orange");
  }

  // Check duplicate
  const { data: existing } = await db
    .from("stock").select("*")
    .ilike("item", name).limit(1);

  if (existing && existing.length > 0) {
    showMsg(msg,
      `⚠️ "${name}" already exists in stock board. ` +
      `Use Stock Management tab to update quantity.`,
      "orange");
    return;
  }

  const btn = document.querySelector(
    "#commodityTab button[onclick='addNewCommodity()']"
  );
  if (btn) { btn.disabled=true; btn.textContent="⏳ Adding..."; }

  // ── Upload photo if selected ────────────────────────────
  let photoUrl = "";
  const photoInput =
    document.getElementById("newCommodityPhoto");
  if (photoInput && photoInput.files &&
      photoInput.files[0]) {
    const file     = photoInput.files[0];
    const safeName = name.replace(/\s+/g, "_").toLowerCase();
    const fileName =
      `commodity_${safeName}_${Date.now()}.jpg`;
    const filePath = `commodity-photos/${fileName}`;

    const { error: upErr } = await db.storage
      .from("member-photos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert:       true,
        contentType:  file.type
      });

    if (!upErr) {
      const { data: urlData } = db.storage
        .from("member-photos")
        .getPublicUrl(filePath);
      photoUrl = urlData.publicUrl || "";
      console.log("✅ Photo uploaded:", photoUrl);
    } else {
      console.log("Photo upload note:", upErr.message);
    }
  }

  const { error } = await db.from("stock").insert([{
    item:         name,
    available_kg: qty,
    govt_price:   govtP,
    market_price: mktP,
    unit:         unit,
    is_active:    true,
    added_by:     currentOfficer.officer_id,
    description:  desc,
    photo_url:    photoUrl,
    updated_at:   new Date().toISOString()
  }]);

  if (btn) {
    btn.disabled    = false;
    btn.textContent = "✅ Add Commodity to Stock Board";
  }

  if (error) {
    showMsg(msg, "❌ " + error.message, "red"); return;
  }

  showMsg(msg,
    `✅ "${name}" added to stock board! ` +
    `Qty: ${qty}${unit} | Govt: ₹${govtP}/${unit} | ` +
    `Market: ₹${mktP}/${unit}`,
    "green");

  // Clear form
  document.getElementById("newCommodityName").value        = "";
  document.getElementById("newCommodityGovtPrice").value   = "";
  document.getElementById("newCommodityMarketPrice").value = "";
  document.getElementById("newCommodityQty").value         = "";
  document.getElementById("newCommodityDesc").value        = "";
  document.getElementById("commodityPreview").style.display  = "none";
  const photoInp = document.getElementById("newCommodityPhoto");
  if (photoInp) photoInp.value = "";
  const photoPrev =
    document.getElementById("commodityPhotoPreview");
  if (photoPrev) photoPrev.style.display = "none";

  // Reload list
  loadCommodities();
}

// ── Load All Commodities ──────────────────────────────────────
async function loadCommodities() {
  const list = document.getElementById("commodityList");
  if (!list) return;

  list.innerHTML = `
    <p style="color:#888;text-align:center;padding:30px">
      ⏳ Loading...
    </p>`;

  const { data: items } = await db
    .from("stock").select("*")
    .eq("is_active", true)
    .order("item", { ascending: true });

  if (!items || items.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:40px;color:#888">
        <div style="font-size:40px;margin-bottom:10px">📦</div>
        <div style="font-size:14px;font-weight:bold">
          No commodities found
        </div>
        <div style="font-size:12px;margin-top:6px">
          Add commodities using the form above
        </div>
      </div>`;
    return;
  }

  list.innerHTML = `
    <div style="display:grid;gap:12px">
      ${items.map(item => {
        const icon       = getCommodityIcon(item.item);
        const govtPrice  = parseFloat(item.govt_price  || 0);
        const mktPrice   = parseFloat(item.market_price || 0);
        const qty        = parseFloat(item.available_kg || 0);
        const unit       = item.unit || "kg";
        const savePct    = mktPrice > 0
          ? Math.round(((mktPrice-govtPrice)/mktPrice)*100)
          : 0;
        const isLow      = qty < 20;
        const isCritical = qty < 10;
        const pct        = Math.min((qty/100)*100, 100);

        return `
          <div style="border:1px solid #e5e7eb;
                      border-radius:14px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.06);
                      background:white">
            <!-- Item Header -->
            <div style="padding:14px 18px;
                        background:#f8fafc;
                        border-bottom:1px solid #f0f0f0;
                        display:flex;align-items:center;
                        gap:14px;flex-wrap:wrap">
              <!-- Photo or Icon -->
              <div style="flex-shrink:0">
                ${item.photo_url
                  ? `<img src="${item.photo_url}"
                          alt="${item.item}"
                          style="width:56px;height:56px;
                                 border-radius:10px;
                                 object-fit:cover;
                                 border:2px solid #e5e7eb"
                          onerror="this.style.display='none';
                            this.nextElementSibling
                              .style.display='flex'"/>
                     <div style="font-size:36px;display:none">
                       ${icon}
                     </div>`
                  : `<div style="font-size:36px">${icon}</div>`}
              </div>
              <div style="flex:1;min-width:150px">
                <div style="font-size:16px;font-weight:bold;
                            color:#1b5e20">
                  ${item.item}
                </div>
                ${item.description
                  ? `<div style="font-size:11px;color:#888;
                                 margin-top:2px">
                       ${item.description}
                     </div>`
                  : ""}
                <div style="font-size:11px;color:#888;
                            margin-top:2px">
                  Added by: ${item.added_by || "system"}
                </div>
              </div>
              <!-- Status Badge -->
              <div style="background:${
                isCritical?'#fee2e2':isLow?'#fff3e0':'#dcfce7'};
                          color:${
                isCritical?'#b91c1c':isLow?'#a16207':'#15803d'};
                          padding:4px 12px;border-radius:20px;
                          font-size:12px;font-weight:bold">
                ${isCritical?'🔴 Critical':
                  isLow?'🟡 Low Stock':'🟢 Available'}
              </div>
            </div>

            <!-- Item Details -->
            <div style="padding:14px 18px">
              <div style="display:grid;
                          grid-template-columns:repeat(4,1fr);
                          gap:10px;margin-bottom:14px">

                <!-- Quantity -->
                <div style="background:#f0fdf4;
                            border:1px solid #bbf7d0;
                            border-radius:10px;padding:12px;
                            text-align:center">
                  <div style="font-size:22px;font-weight:bold;
                              color:#15803d">
                    ${qty}
                  </div>
                  <div style="font-size:10px;color:#888;
                              margin-top:2px">
                    📦 ${unit} available
                  </div>
                </div>

                <!-- Govt Price -->
                <div style="background:#f0fdf4;
                            border:1px solid #bbf7d0;
                            border-radius:10px;padding:12px;
                            text-align:center">
                  <div style="font-size:22px;font-weight:bold;
                              color:#15803d">
                    ₹${govtPrice}
                  </div>
                  <div style="font-size:10px;color:#888;
                              margin-top:2px">
                    💚 Govt/${unit}
                  </div>
                </div>

                <!-- Market Price -->
                <div style="background:#fafafa;
                            border:1px solid #e5e7eb;
                            border-radius:10px;padding:12px;
                            text-align:center">
                  <div style="font-size:22px;font-weight:bold;
                              color:#aaa;
                              text-decoration:line-through">
                    ₹${mktPrice}
                  </div>
                  <div style="font-size:10px;color:#888;
                              margin-top:2px">
                    🏪 Market/${unit}
                  </div>
                </div>

                <!-- Savings -->
                <div style="background:#eff6ff;
                            border:1px solid #bfdbfe;
                            border-radius:10px;padding:12px;
                            text-align:center">
                  <div style="font-size:22px;font-weight:bold;
                              color:#1565c0">
                    ${savePct}%
                  </div>
                  <div style="font-size:10px;color:#888;
                              margin-top:2px">
                    🎉 Savings
                  </div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div style="margin-bottom:12px">
                <div style="display:flex;
                            justify-content:space-between;
                            font-size:11px;color:#888;
                            margin-bottom:4px">
                  <span>Stock Level</span>
                  <span>${qty} ${unit}</span>
                </div>
                <div style="background:#e5e7eb;
                            border-radius:10px;height:8px;
                            overflow:hidden">
                  <div style="background:${
                    isCritical?'#b91c1c':
                    isLow?'#e65100':'#2e7d32'};
                              width:${pct}%;height:100%;
                              border-radius:10px;
                              transition:width 0.5s ease">
                  </div>
                </div>
              </div>

              <!-- Action Row -->
              <div style="display:flex;gap:10px;flex-wrap:wrap">

                <!-- Update Quantity -->
                <div style="flex:1;min-width:200px;
                            display:flex;gap:8px;
                            align-items:center">
                  <input type="number"
                         id="updateQty_${item.id}"
                         placeholder="New qty"
                         min="0" step="0.01"
                         style="flex:1;padding:8px 10px;
                                font-size:13px;
                                border:1.5px solid #2e7d32;
                                border-radius:8px"/>
                  <button onclick="updateCommodityQty(
                                     '${item.id}',
                                     '${item.item}')"
                          style="background:#2e7d32;
                                 color:white;width:auto;
                                 padding:8px 14px;
                                 font-size:12px;
                                 border-radius:8px">
                    📦 Update Qty
                  </button>
                </div>

                <!-- Update Price -->
                <div style="flex:1;min-width:280px;
                            display:flex;gap:8px;
                            align-items:center">
                  <input type="number"
                         id="updateGovt_${item.id}"
                         placeholder="Govt ₹"
                         min="0" step="0.01"
                         value="${govtPrice}"
                         style="flex:1;padding:8px 10px;
                                font-size:13px;
                                border:1.5px solid #15803d;
                                border-radius:8px"/>
                  <input type="number"
                         id="updateMkt_${item.id}"
                         placeholder="Market ₹"
                         min="0" step="0.01"
                         value="${mktPrice}"
                         style="flex:1;padding:8px 10px;
                                font-size:13px;
                                border:1.5px solid #a16207;
                                border-radius:8px"/>
                  <button onclick="updateCommodityPrice(
                                     '${item.id}',
                                     '${item.item}')"
                          style="background:#1565c0;
                                 color:white;width:auto;
                                 padding:8px 14px;
                                 font-size:12px;
                                 border-radius:8px">
                    💰 Update Price
                  </button>
                </div>

                <!-- Remove -->
                <button onclick="removeCommodity(
                                   '${item.id}',
                                   '${item.item}')"
                        style="background:#fee2e2;
                               color:#b91c1c;
                               border:1px solid #fca5a5;
                               width:auto;padding:8px 14px;
                               font-size:12px;
                               border-radius:8px">
                  🗑️ Remove
                </button>
              </div>

              <p id="commodityActionMsg_${item.id}"
                 style="display:none;margin-top:8px;
                        padding:8px 12px;border-radius:8px;
                        font-size:12px;font-weight:bold"></p>
            </div>
          </div>`;
      }).join("")}
    </div>`;
}

// ── Update Commodity Quantity ─────────────────────────────────
async function updateCommodityQty(id, name) {
  const qty  =
    parseFloat(document.getElementById(`updateQty_${id}`)?.value || 0);
  const msg  =
    document.getElementById(`commodityActionMsg_${id}`);

  if (qty < 0) {
    showMsg(msg, "⚠️ Enter valid quantity.", "red"); return;
  }

  const { error } = await db.from("stock").update({
    available_kg: qty,
    updated_at:   new Date().toISOString()
  }).eq("id", id);

  if (error) {
    showMsg(msg, "❌ " + error.message, "red"); return;
  }

  showMsg(msg,
    `✅ ${name} quantity updated to ${qty}`,
    "green");
  setTimeout(() => loadCommodities(), 1500);
}

// ── Update Commodity Price ────────────────────────────────────
async function updateCommodityPrice(id, name) {
  const govt =
    parseFloat(document.getElementById(`updateGovt_${id}`)?.value || 0);
  const mkt  =
    parseFloat(document.getElementById(`updateMkt_${id}`)?.value || 0);
  const msg  =
    document.getElementById(`commodityActionMsg_${id}`);

  if (govt <= 0 || mkt <= 0) {
    showMsg(msg, "⚠️ Enter valid prices.", "red"); return;
  }

  const { error } = await db.from("stock").update({
    govt_price:   govt,
    market_price: mkt,
    updated_at:   new Date().toISOString()
  }).eq("id", id);

  if (error) {
    showMsg(msg, "❌ " + error.message, "red"); return;
  }

  showMsg(msg,
    `✅ ${name} prices updated — Govt: ₹${govt} | Market: ₹${mkt}`,
    "green");
  setTimeout(() => loadCommodities(), 1500);
}

// ── Remove Commodity ──────────────────────────────────────────
async function removeCommodity(id, name) {
  if (!confirm(
    `Remove "${name}" from stock board?\n` +
    `Citizens will no longer see this commodity.`
  )) return;

  const { error } = await db.from("stock")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    alert("❌ Error: " + error.message); return;
  }

  loadCommodities();
}