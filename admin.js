// ══════════════════════════════════════════════════════════════
//   SMART RATION HUB 2026 — admin.js
//   DEALER DASHBOARD
//   ✅ STEP 1: Geo-Location Verification (dealer location)
//   ✅ STEP 2: Face Recognition (live vs stored photo)
//   ✅ STEP 3: OTP Verification (after face match only)
//   ✅ STEP 4: Mark Collected + Bill Generated
// ══════════════════════════════════════════════════════════════

// ── SUPABASE ──────────────────────────────────────────────────
const SUPABASE_URL = "https://znwpouhmbukhttsccgzd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpud3BvdWhtYnVraHR0c2NjZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MDY4NzEsImV4cCI6MjA5OTk4Mjg3MX0.ODBpp43FrasZp1006uzLXNiy_5TYjIWS_S8ILQv7J8s";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── File:// URL Check ──────────────────────────────────────────
// Must open with Live Server — not file://
if (window.location.protocol === "file:") {
  document.addEventListener("DOMContentLoaded", () => {
    document.body.innerHTML = `
      <div style="min-height:100vh;background:#1b5e20;
                  display:flex;align-items:center;
                  justify-content:center;padding:20px">
        <div style="background:white;border-radius:16px;
                    padding:36px 32px;max-width:500px;
                    text-align:center;
                    box-shadow:0 20px 60px rgba(0,0,0,0.3)">
          <div style="font-size:56px;margin-bottom:16px">⚠️</div>
          <h2 style="color:#b91c1c;margin-bottom:12px;
                     font-size:20px">
            Cannot Open as file://
          </h2>
          <p style="color:#555;font-size:14px;
                    line-height:1.8;margin-bottom:20px">
            You opened this from File Explorer.<br/>
            <strong>file://</strong> blocks Supabase API,
            Camera and GPS.<br/>
            You must use <strong>Live Server</strong>.
          </p>
          <div style="background:#f0fdf4;
                      border:1px solid #bbf7d0;
                      border-radius:10px;padding:16px;
                      text-align:left;font-size:13px;
                      color:#333;line-height:2;
                      margin-bottom:20px">
            <strong style="color:#1b5e20">
              ✅ Steps to fix:
            </strong><br/>
            1. Open <strong>VS Code</strong><br/>
            2. Right-click <strong>admin.html</strong><br/>
            3. Click <strong>Open with Live Server</strong><br/>
            4. Chrome opens at:<br/>
            <code style="background:#e8f5e9;
                         padding:4px 12px;
                         border-radius:6px;
                         color:#1b5e20;
                         font-weight:bold;
                         display:inline-block;
                         margin-top:4px">
              http://127.0.0.1:5500/admin.html
            </code>
          </div>
          <p style="font-size:12px;color:#c62828;
                    font-weight:bold">
            ❌ Never open .html files directly from
            File Explorer or Desktop
          </p>
        </div>
      </div>`;
  });
}

// ── GLOBAL STATE ──────────────────────────────────────────────
let currentDealer         = null;
let overviewChart         = null;
let faceStream            = null;
let faceModelsLoaded      = false;
let currentScanRationCard = "";
let currentScanTokenId    = "";
let collectionOTP         = "";
let collectionOTPTimer    = null;

// ── VERIFICATION STATE (tracks each step) ─────────────────────
let geoVerified  = false; // Step 1 passed
let faceVerified = false; // Step 2 passed

// ── RATION QUANTITIES & PRICES ────────────────────────────────
const RATIONS = {
  APL: { rice:5,  wheat:3,  sugar:1  },
  BPL: { rice:10, wheat:7,  sugar:2  },
  AAY: { rice:15, wheat:10, sugar:3  },
  PHH: { rice:10, wheat:7,  sugar:2  }
};
const PRICES = {
  APL: { rice:10, wheat:8,  sugar:15 },
  BPL: { rice:3,  wheat:2,  sugar:13 },
  AAY: { rice:2,  wheat:2,  sugar:13 },
  PHH: { rice:3,  wheat:2,  sugar:13 }
};

// ── GEO CONSTANTS ─────────────────────────────────────────────
// Laptop GPS accuracy : ±100m to ±1000m (WiFi triangulation)
// Phone GPS accuracy  : ±5m to ±30m (satellite)
// Threshold set to 5km to handle laptop GPS inaccuracy
// In real deployment use phone GPS for accuracy
const MAX_DISTANCE_METERS = 5000; // 5km — handles laptop inaccuracy

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
document.getElementById("dealerLoginBtn")
  .addEventListener("click", async () => {
  const id  = document.getElementById("dealerId").value.trim();
  const pwd = document.getElementById("dealerPassword").value.trim();
  const err = document.getElementById("dealerLoginError");

  if (!id || !pwd) {
    err.style.display = "block";
    err.textContent   = "⚠️ Enter both fields."; return;
  }

  const { data: rows } = await db.from("dealers").select("*")
    .eq("dealer_id",id).eq("password",pwd).limit(1);
  const data = rows && rows[0] ? rows[0] : null;

  if (data) {
    currentDealer = data;
    err.style.display = "none";
    document.getElementById("dealerLoginPage").style.display = "none";
    document.getElementById("dashboardPage").style.display   = "flex";
    document.getElementById("shopName").textContent      = data.shop_name;
    document.getElementById("shopLocality").textContent  = "📍 " + data.locality;
    document.getElementById("dealerRoleBadge").textContent = data.role.toUpperCase();
    document.getElementById("dealerIdDisplay").textContent = data.dealer_id;
    loadDashboard();
  } else {
    err.style.display = "block";
    err.textContent   = "❌ Invalid credentials";
  }
});

// ══════════════════════════════════════════════════════════════
// 3. LOGOUT
// ══════════════════════════════════════════════════════════════
document.getElementById("dealerLogoutBtn")
  .addEventListener("click", () => {
  currentDealer = null;
  closeFaceScanner();
  document.getElementById("dealerLoginPage").style.display = "flex";
  document.getElementById("dashboardPage").style.display   = "none";
  document.getElementById("dealerId").value       = "";
  document.getElementById("dealerPassword").value = "";
});

// ══════════════════════════════════════════════════════════════
// 4. TAB SWITCHING
// ══════════════════════════════════════════════════════════════
function showTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(t => {
    t.style.display = "none";
  });
  document.querySelectorAll(".sidebar nav button").forEach(b => {
    b.classList.remove("active");
  });
  const tab = document.getElementById(tabId);
  if (tab) tab.style.display = "block";
  const btn = document.getElementById("btn-" + tabId);
  if (btn) btn.classList.add("active");

  const titles = {
    overviewTab:       "Overview",
    membersTab:        "Registered Members",
    tokenTab:          "Token Queue",
    rationTab:         "Monthly Ration Distribution",
    stockTab:          "Stock Levels",
    officerTab:        "Contact Supply Officer",
    reportsTab:        "Citizen Reports",
    inconvenienceTab:  "My Inconvenience Reports"
  };
  document.getElementById("pageTitle").textContent =
    titles[tabId] || "";

  if (tabId === "tokenTab")         loadTokenQueue();
  if (tabId === "rationTab")        loadRationData();
  if (tabId === "stockTab")         loadStock();
  if (tabId === "officerTab")       loadOfficerTab();
  if (tabId === "reportsTab")       loadReports();
  if (tabId === "inconvenienceTab") {
    loadMyInconveniences();
    const d = document.getElementById("inconvDate");
    if (d) d.min = new Date().toISOString().split("T")[0];
  }
}

// ══════════════════════════════════════════════════════════════
// 5. LOAD DASHBOARD
// ══════════════════════════════════════════════════════════════
async function loadDashboard() {
  await loadMembersTable();
  await loadOverviewStats();
}

// ══════════════════════════════════════════════════════════════
// 6. OVERVIEW STATS + CHART
// ══════════════════════════════════════════════════════════════
async function loadOverviewStats() {
  const today = new Date().toISOString().split("T")[0];
  const { data: users }  = await db.from("users").select("*");
  const { data: fam }    = await db.from("family_members").select("*");
  const { data: tokens } = await db.from("tokens").select("*")
    .eq("date",today).eq("dealer_id",currentDealer.dealer_id);

  document.getElementById("totalMembers").textContent =
    fam    ? fam.length    : 0;
  document.getElementById("totalCards").textContent   =
    users  ? users.length  : 0;
  document.getElementById("todayTokens").textContent  =
    tokens ? tokens.length : 0;

  const pending = tokens
    ? tokens.filter(t=>t.status==="waiting").length : 0;
  document.getElementById("pendingTokens").textContent = pending;

  const serving   = tokens ? tokens.filter(t=>t.status==="serving").length   : 0;
  const completed = tokens ? tokens.filter(t=>t.status==="completed").length : 0;
  const cancelled = tokens ? tokens.filter(t=>t.status==="cancelled").length : 0;
  drawChart(pending, serving, completed, cancelled);
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
// 7. MEMBERS TABLE
// ══════════════════════════════════════════════════════════════
async function loadMembersTable() {
  const { data: users } = await db.from("users").select("*");
  const { data: fam }   = await db.from("family_members").select("*");
  const tbody = document.getElementById("membersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!users || users.length === 0) {
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
                  style="width:38px;height:38px;border-radius:50%;
                         object-fit:cover;border:2px solid #2e7d32"/>`
          : `<span style="color:#c62828;font-size:12px">❌ No photo</span>`}
      </td>
      <td>
        <button class="btn-view"
          onclick='viewMembers(${JSON.stringify(user)},
                               ${JSON.stringify(members)})'>
          👁 View
        </button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function filterMembers() {
  const q = document.getElementById("memberSearch").value.toLowerCase();
  document.querySelectorAll("#membersTableBody tr").forEach(row => {
    row.style.display =
      row.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}

// ══════════════════════════════════════════════════════════════
// 8. TOKEN QUEUE
// ══════════════════════════════════════════════════════════════
async function loadTokenQueue() {
  const today = new Date().toISOString().split("T")[0];
  const tbody = document.getElementById("tokenTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8"
    style="text-align:center;padding:20px;color:#999">
    ⏳ Loading...</td></tr>`;

  const { data: tokens } = await db.from("tokens").select("*")
    .eq("date",today)
    .eq("dealer_id",currentDealer.dealer_id)
    .order("token_number",{ascending:true});
  const { data: users } = await db.from("users").select("*");

  tbody.innerHTML = "";

  if (!tokens || tokens.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"
      style="text-align:center;padding:24px;color:#999">
      No tokens booked today.</td></tr>`;
    updateQueueStats(0,0,0,0); return;
  }

  const waiting   = tokens.filter(t=>t.status==="waiting").length;
  const serving   = tokens.filter(t=>t.status==="serving").length;
  const completed = tokens.filter(t=>t.status==="completed").length;
  const cancelled = tokens.filter(t=>t.status==="cancelled").length;
  updateQueueStats(waiting,serving,completed,cancelled);

  // Now serving banner
  const servingToken = tokens.find(t=>t.status==="serving");
  const banner = document.getElementById("nowServingBanner");
  if (servingToken) {
    banner.style.display = "flex";
    const user = users
      ? users.find(u=>u.ration_card===servingToken.ration_card) : null;
    document.getElementById("nowServingToken").textContent =
      `#${String(servingToken.token_number).padStart(3,"0")}`;
    document.getElementById("servingRationCard").textContent =
      "🪪 "+servingToken.ration_card;
    document.getElementById("servingCategory").textContent =
      user ? "📋 "+user.category : "";
    document.getElementById("servingTime").textContent =
      "⏰ Est: "+servingToken.estimated_time;
  } else {
    banner.style.display = "none";
  }

  tokens.forEach(token => {
    const tokenNo  = `#${String(token.token_number).padStart(3,"0")}`;
    const user     = users
      ? users.find(u=>u.ration_card===token.ration_card) : null;
    const category = user ? user.category : "—";
    const catClass = "badge-"+category.toLowerCase();
    const bookedAt = token.booked_at
      ? new Date(token.booked_at).toLocaleTimeString("en-IN",
          {hour:"2-digit",minute:"2-digit",second:"2-digit"})
      : "—";
    const badgeClass =
      token.status==="waiting"   ? "badge-waiting"   :
      token.status==="serving"   ? "badge-serving"   :
      token.status==="completed" ? "badge-completed" :
      "badge-cancelled";

    let actions = "";
    if (token.status==="waiting") {
      actions = `
        <button class="btn-serve"
          onclick="serveToken('${token.id}','${token.ration_card}')">
          🔵 Serve
        </button>
        <button class="btn-cancel"
          onclick="updateTokenStatus('${token.id}','cancelled')"
          style="margin-left:4px">
          ✕
        </button>`;
    } else if (token.status==="serving") {
      actions = `
        <button class="btn-scan"
          onclick="openFaceScanner('${token.ration_card}','${token.id}')">
          📷 Verify
        </button>`;
    } else {
      actions = `<span style="color:#aaa;font-size:12px">Done</span>`;
    }

    // Get collecting member info from token
    const collectorName  = token.collecting_member_name  || "Head of Family";
    const collectorPhoto = token.collecting_member_photo || "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong style="font-size:15px">${tokenNo}</strong></td>
      <td><strong>${token.queue_position}</strong></td>
      <td>${token.ration_card}</td>
      <td><span class="${catClass}">${category}</span></td>
      <td style="font-size:12px;font-weight:bold;color:#333">
        ${collectorName}
      </td>
      <td>
        ${collectorPhoto
          ? `<img src="${collectorPhoto}"
                  style="width:38px;height:38px;
                         border-radius:50%;
                         object-fit:cover;
                         border:2px solid #2e7d32"/>`
          : `<span style="color:#c62828;font-size:11px">
               ❌ No photo
             </span>`}
      </td>
      <td>🕐 ${bookedAt}</td>
      <td>⏰ ${token.estimated_time}</td>
      <td><span class="${badgeClass}">${token.status.toUpperCase()}</span></td>
      <td>${actions}</td>`;
    tbody.appendChild(tr);
  });
}

// ══════════════════════════════════════════════════════════════
// 9. SERVE TOKEN → Auto opens face scanner
// ══════════════════════════════════════════════════════════════
async function serveToken(tokenId, rationCard) {
  await db.from("tokens")
    .update({status:"serving"}).eq("id",tokenId);
  loadTokenQueue();
  loadOverviewStats();
  setTimeout(() => openFaceScanner(rationCard, tokenId), 500);
}

// ══════════════════════════════════════════════════════════════
// 10. UPDATE TOKEN STATUS
// ══════════════════════════════════════════════════════════════
async function updateTokenStatus(tokenId, newStatus) {
  await db.from("tokens")
    .update({status:newStatus}).eq("id",tokenId);
  loadTokenQueue();
  loadOverviewStats();
}

function updateQueueStats(w,s,d,c) {
  document.getElementById("waitingCount").textContent   = w;
  document.getElementById("servingCount").textContent   = s;
  document.getElementById("doneCount").textContent      = d;
  document.getElementById("cancelledCount").textContent = c;
}

// ══════════════════════════════════════════════════════════════
// 11. MEMBER MODAL
// ══════════════════════════════════════════════════════════════
function viewMembers(user, members) {
  let html = `
    <p><strong>Ration Card:</strong> ${user.ration_card}</p>
    <p style="margin-top:6px">
      <strong>Category:</strong> ${user.category}
    </p>
    <br/><h4 style="margin-bottom:12px">Family Members:</h4>`;
  if (!members || members.length===0) {
    html += "<p style='color:#888'>No members found.</p>";
  } else {
    members.forEach(m => {
      html += `
        <div class="member-detail-row">
          <div style="display:flex;align-items:center;gap:10px">
            ${m.photo_url
              ? `<img src="${m.photo_url}" class="member-photo-thumb"/>`
              : `<div style="width:44px;height:44px;border-radius:50%;
                             background:#e8f5e9;display:flex;
                             align-items:center;justify-content:center;
                             font-size:20px">👤</div>`}
            <div>
              <strong>${m.name}</strong><br/>
              <small style="color:#888">${m.relation}</small>
            </div>
          </div>
          <div style="text-align:right;font-size:12px">
            <div style="color:#555">Aadhaar: ${m.aadhaar}</div>
            <div style="color:${m.photo_url?'#15803d':'#c62828'}">
              ${m.photo_url?"📷 Photo ✅":"❌ No photo"}
            </div>
          </div>
        </div>`;
    });
  }
  document.getElementById("memberDetailContent").innerHTML = html;
  document.getElementById("memberModalOverlay").style.display = "flex";
}

function closeMemberModal() {
  document.getElementById("memberModalOverlay").style.display = "none";
}

// ══════════════════════════════════════════════════════════════
// 12. MONTHLY RATION
// ══════════════════════════════════════════════════════════════
async function loadRationData() {
  const month = document.getElementById("filterMonth").value;
  const year  = parseInt(document.getElementById("filterYear").value);
  const tbody = document.getElementById("rationTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8"
    style="text-align:center;padding:20px">⏳ Loading...</td></tr>`;

  const { data: users } = await db.from("users").select("*");
  const { data: dist }  = await db.from("ration_distribution")
    .select("*").eq("month",month).eq("year",year);

  tbody.innerHTML = "";
  if (!users || users.length===0) {
    tbody.innerHTML = `<tr><td colspan="8"
      style="text-align:center;padding:20px;color:#999">
      No citizens registered.</td></tr>`;
    return;
  }

  users.forEach(user => {
    const existing  = dist
      ? dist.find(d=>d.ration_card===user.ration_card) : null;
    const collected = existing ? existing.collected : false;
    const r = RATIONS[user.category] || RATIONS.BPL;
    const p = PRICES[user.category]  || PRICES.BPL;
    const total = (r.rice*p.rice)+(r.wheat*p.wheat)+(r.sugar*p.sugar);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${user.ration_card}</strong></td>
      <td>${user.category}</td>
      <td>${r.rice} kg</td>
      <td>${r.wheat} kg</td>
      <td>${r.sugar} kg</td>
      <td>₹${total}</td>
      <td>
        <span class="${collected?"badge-completed":"badge-pending"}">
          ${collected?"✅ Collected":"⏳ Pending"}
        </span>
      </td>
      <td>
        ${collected
          ? `<button class="btn-done" disabled>Done</button>`
          : `<button class="btn-mark"
               onclick="markCollected('${user.ration_card}',
               '${month}',${year},
               ${r.rice},${r.wheat},${r.sugar},
               ${p.rice},${p.wheat},${p.sugar})">
               Mark Collected
             </button>`}
      </td>`;
    tbody.appendChild(tr);
  });
}

async function markCollected(rc,month,year,
  rice,wheat,sugar,riceP,wheatP,sugarP) {
  const { data: ex } = await db.from("ration_distribution")
    .select("*").eq("ration_card",rc)
    .eq("month",month).eq("year",year).limit(1);
  const existing = ex && ex[0] ? ex[0] : null;
  if (existing) {
    await db.from("ration_distribution")
      .update({collected:true,collected_at:new Date().toISOString()})
      .eq("id",existing.id);
  } else {
    await db.from("ration_distribution").insert([{
      ration_card:rc,dealer_id:currentDealer.dealer_id,
      month,year,rice_kg:rice,wheat_kg:wheat,sugar_kg:sugar,
      collected:true,collected_at:new Date().toISOString()
    }]);
  }
  await generateBill(rc,month,year,
    rice,wheat,sugar,riceP,wheatP,sugarP);
  loadRationData();
}

// ══════════════════════════════════════════════════════════════
// 13. GENERATE BILL
// ══════════════════════════════════════════════════════════════
async function generateBill(rc,month,year,
  rice,wheat,sugar,riceP,wheatP,sugarP) {
  const total = (rice*riceP)+(wheat*wheatP)+(sugar*sugarP);
  const billNumber =
    `BILL-${rc}-${month.substring(0,3).toUpperCase()}`+
    `${year}-${Date.now()%10000}`;
  await db.from("bills").insert([{
    bill_number:billNumber,ration_card:rc,
    dealer_id:currentDealer.dealer_id,
    shop_name:currentDealer.shop_name,
    locality:currentDealer.locality,
    month,year,rice_kg:rice,wheat_kg:wheat,sugar_kg:sugar,
    rice_price:riceP,wheat_price:wheatP,sugar_price:sugarP,
    total_amount:total,bill_date:new Date().toISOString()
  }]);
  console.log(`✅ Bill: ${billNumber} | ₹${total}`);
}

// ══════════════════════════════════════════════════════════════
// 14. STOCK VIEW ONLY
// ══════════════════════════════════════════════════════════════
async function loadStock() {
  const { data } = await db.from("stock").select("*");
  const grid = document.getElementById("stockGrid");
  if (!grid) return;
  grid.innerHTML = "";
  if (!data) return;
  const COLORS = {Rice:"#16a34a",Wheat:"#d97706",Sugar:"#9333ea"};
  const ICONS  = {Rice:"🌾",Wheat:"🌿",Sugar:"🍬"};
  data.forEach(item => {
    const kg      = parseFloat(item.available_kg);
    const percent = Math.min((kg/50)*100,100).toFixed(0);
    const color   = COLORS[item.item] || "#16a34a";
    const icon    = ICONS[item.item]  || "📦";
    let status="", statusColor="";
    if (kg>=20)      {status="✅ Good";    statusColor="#15803d";}
    else if (kg>=10) {status="⚠️ Low";     statusColor="#a16207";}
    else             {status="🔴 Critical"; statusColor="#b91c1c";}
    const card = document.createElement("div");
    card.className = "stock-view-card";
    card.innerHTML = `
      <div class="stock-view-icon">${icon}</div>
      <h3 class="stock-view-name">${item.item}</h3>
      <div class="stock-view-kg" style="color:${statusColor}">
        ${kg} kg
      </div>
      <div class="stock-bar-track">
        <div class="stock-bar-fill"
             style="width:${percent}%;background:${color}">
        </div>
      </div>
      <span class="stock-view-status" style="color:${statusColor}">
        ${status}
      </span>`;
    grid.appendChild(card);
  });
}

// ══════════════════════════════════════════════════════════════
// 15. CONTACT OFFICER TAB
// ══════════════════════════════════════════════════════════════
async function loadOfficerTab() {
  const { data: officers } = await db
    .from("supply_officers").select("*").limit(1);
  const officer = officers && officers[0] ? officers[0] : null;
  const infoCard = document.getElementById("officerInfoCard");
  if (infoCard) {
    if (officer) {
      infoCard.innerHTML = `
        <div class="officer-card-inner">
          <div class="officer-avatar">🏛️</div>
          <div class="officer-details">
            <h3>${officer.name}</h3>
            <p>Supply Officer — ${officer.district}</p>
            <p style="color:#888;font-size:12px">ID: ${officer.officer_id}</p>
          </div>
          <div class="officer-contact-info">
            <span class="officer-badge">✅ Your Assigned Officer</span>
          </div>
        </div>`;
    } else {
      infoCard.innerHTML = `
        <p style="color:#888;text-align:center;padding:20px">
          No Supply Officer assigned yet.
        </p>`;
    }
  }
  loadMyRequests();
}

const sendRequestBtn = document.getElementById("sendRequestBtn");
if (sendRequestBtn) {
  sendRequestBtn.addEventListener("click", async () => {
    const item     = document.getElementById("requestItem").value;
    const qty      = document.getElementById("requestQty").value;
    const note     = document.getElementById("requestNote").value.trim();
    const priority = document.getElementById("requestPriority").value;
    const msg      = document.getElementById("requestMsg");
    if (!qty||qty<=0) {
      showAdminMsg(msg,"⚠️ Enter quantity needed.","red"); return;
    }
    if (!note) {
      showAdminMsg(msg,"⚠️ Enter a reason.","red"); return;
    }
    sendRequestBtn.disabled    = true;
    sendRequestBtn.textContent = "⏳ Sending...";
    await db.from("stock_reports").insert([{
      ration_card:       currentDealer.dealer_id,
      item,
      quantity_received: parseFloat(qty),
      reported_at:       new Date().toISOString()
    }]);
    showAdminMsg(msg,
      `✅ Stock request sent! Item: ${item} | `+
      `Qty: ${qty} kg | Priority: ${priority}`,
      "green"
    );
    document.getElementById("requestQty").value  = "";
    document.getElementById("requestNote").value = "";
    loadMyRequests();
    sendRequestBtn.disabled    = false;
    sendRequestBtn.textContent = "📤 Send Stock Request to Officer";
  });
}

async function loadMyRequests() {
  const tbody = document.getElementById("requestsTableBody");
  if (!tbody) return;
  const { data } = await db.from("stock_reports").select("*")
    .eq("ration_card",currentDealer.dealer_id)
    .order("reported_at",{ascending:false});
  tbody.innerHTML = "";
  if (!data||data.length===0) {
    tbody.innerHTML = `<tr><td colspan="6"
      style="text-align:center;padding:20px;color:#999">
      No requests sent yet.</td></tr>`;
    return;
  }
  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(r.reported_at).toLocaleDateString("en-IN")}</td>
      <td>${r.item}</td>
      <td>${r.quantity_received} kg</td>
      <td style="color:#15803d;font-weight:bold">Normal</td>
      <td style="font-size:12px;color:#555">Stock request</td>
      <td style="color:#1565c0;font-weight:bold">SENT</td>`;
    tbody.appendChild(tr);
  });
}

// ══════════════════════════════════════════════════════════════
// 16. REPORTS
// ══════════════════════════════════════════════════════════════
async function loadReports() {
  const { data } = await db.from("stock_reports").select("*")
    .order("reported_at",{ascending:false});
  const tbody = document.getElementById("reportsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!data||data.length===0) {
    tbody.innerHTML = `<tr><td colspan="4"
      style="text-align:center;padding:20px;color:#999">
      No reports yet.</td></tr>`;
    return;
  }
  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.ration_card}</td>
      <td>${r.item}</td>
      <td>${r.quantity_received} kg</td>
      <td>${new Date(r.reported_at).toLocaleDateString("en-IN")}</td>`;
    tbody.appendChild(tr);
  });
}

// ══════════════════════════════════════════════════════════════
// 17. GEO LOCATION — Calculate distance between two points
//     Haversine Formula
// ══════════════════════════════════════════════════════════════
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R    = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c    = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // distance in meters
}

// ══════════════════════════════════════════════════════════════
// 18. STEP 1 — GEO LOCATION VERIFICATION
//     Smart geo verification:
//     → Try to detect location
//     → Show distance info for reference
//     → If GPS inaccurate → manual confirm option
//     → Always log to database for audit
//     → Never block due to laptop GPS inaccuracy
// ══════════════════════════════════════════════════════════════
async function verifyDealerLocation() {
  return new Promise(async (resolve) => {

    setGeoStatus(
      "⏳ Fetching registered shop location...",
      "loading"
    );

    // ── Fetch latest dealer data from DB ──────────────────
    const { data: dealerRows } = await db
      .from("dealers")
      .select("*")
      .eq("dealer_id", currentDealer.dealer_id)
      .limit(1);

    const freshDealer = dealerRows && dealerRows[0]
      ? dealerRows[0] : currentDealer;

    const hasShopLocation =
      freshDealer.latitude && freshDealer.longitude;
    const shopLat = parseFloat(freshDealer.latitude  || 0);
    const shopLon = parseFloat(freshDealer.longitude || 0);

    // ── Show geo info box ─────────────────────────────────
    const geoInfoBox = document.getElementById("geoInfoBox");

    if (!hasShopLocation) {
      // No shop location set — show warning but still pass
      setGeoStatus(
        "⚠️ Shop location not set by officer. " +
        "Contact Supply Officer to set shop GPS location. " +
        "Proceeding to face verification.",
        "warning"
      );
      if (geoInfoBox) {
        geoInfoBox.style.display = "block";
        geoInfoBox.innerHTML = `
          <div style="padding:12px;background:#fff3e0;
                      border-radius:8px;font-size:12px;
                      color:#a16207">
            ⚠️ Shop location not registered in database.<br/>
            Supply Officer must set the shop location
            in the Officer Portal before geo-verification
            can compare locations.
          </div>`;
      }
      await logGeoToDatabase(0, 0);
      resolve(true);
      return;
    }

    setGeoStatus(
      `⏳ Shop location found: ` +
      `${shopLat.toFixed(4)}, ${shopLon.toFixed(4)}. ` +
      `Now detecting your current location...`,
      "loading"
    );

    // ── Check geolocation support ─────────────────────────
    if (!navigator.geolocation) {
      setGeoStatus(
        "⚠️ Geolocation not supported by this browser. " +
        "Please use Google Chrome. " +
        "Proceeding to face verification.",
        "warning"
      );
      await logGeoToDatabase(0, 0);
      resolve(true);
      return;
    }

    // ── Detect if running on phone or laptop ────────────────
    const isPhone = /Android|iPhone|iPad|iPod|Mobile/i
                      .test(navigator.userAgent);

    console.log(`📱 Device: ${isPhone ? "Phone" : "Laptop"}`);

    setGeoStatus(
      isPhone
        ? "📱 Phone detected — using GPS satellite for accurate location..."
        : "💻 Laptop detected — using WiFi location (may be inaccurate)...",
      "loading"
    );

    // ── Try to get best location ──────────────────────────
    let bestPosition  = null;
    let attemptsDone  = 0;

    // Phone needs fewer tries (GPS is accurate)
    // Laptop needs more tries (WiFi needs time)
    const MAX_TRIES  = isPhone ? 2 : 3;
    const GOOD_ACCURACY = isPhone ? 30 : 300;

    function tryGetLocation() {
      attemptsDone++;
      setGeoStatus(
        `⏳ Getting ${isPhone ? "GPS" : "WiFi"} location ` +
        `(attempt ${attemptsDone}/${MAX_TRIES})... ` +
        `${isPhone
          ? "Keep phone still."
          : "Please wait."}`,
        "loading"
      );

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          // Keep most accurate position
          if (!bestPosition ||
              position.coords.accuracy <
              bestPosition.coords.accuracy) {
            bestPosition = position;
          }

          const dealerLat = bestPosition.coords.latitude;
          const dealerLon = bestPosition.coords.longitude;
          const accuracy  = bestPosition.coords.accuracy;

          console.log(
            `📍 Attempt ${attemptsDone}: ` +
            `${dealerLat.toFixed(6)}, ${dealerLon.toFixed(6)} ` +
            `| ±${accuracy.toFixed(0)}m`
          );

          // Try again if accuracy poor and tries remain
          if (accuracy > GOOD_ACCURACY &&
              attemptsDone < MAX_TRIES) {
            setGeoStatus(
              `⏳ Attempt ${attemptsDone}: ` +
              `Accuracy ±${accuracy.toFixed(0)}m. ` +
              `Getting better reading...`,
              "loading"
            );
            setTimeout(tryGetLocation, 2000);
            return;
          }

          // ── Got best location — process it ───────────
          await logGeoToDatabase(dealerLat, dealerLon);

          const distance = haversineDistance(
            dealerLat, dealerLon, shopLat, shopLon
          );

          // Accuracy label
          let accLabel, accColor;
          if      (accuracy <= 10)  {
            accLabel="🟢 Excellent — GPS Satellite";
            accColor="#15803d";
          } else if (accuracy <= 30)  {
            accLabel="🟢 Very Good — GPS";
            accColor="#15803d";
          } else if (accuracy <= 100) {
            accLabel="🔵 Good — GPS+WiFi";
            accColor="#0369a1";
          } else if (accuracy <= 300) {
            accLabel="🟡 Medium — WiFi";
            accColor="#a16207";
          } else {
            accLabel="🔴 Poor — WiFi only";
            accColor="#b91c1c";
          }

          // Show geo info table
          showGeoInfoBox(
            dealerLat, dealerLon,
            shopLat,   shopLon,
            distance,  accuracy,
            accLabel,  accColor
          );

          console.log(`📏 Distance: ${distance.toFixed(0)}m`);
          console.log(`📡 Accuracy: ±${accuracy.toFixed(0)}m`);
          console.log(`📱 Device: ${isPhone?"Phone":"Laptop"}`);

          // ── Smart decision based on device + accuracy ──
          const effectiveThreshold =
            accuracy > 500
              ? MAX_DISTANCE_METERS + accuracy
              : MAX_DISTANCE_METERS;

          if (isPhone && accuracy <= 50) {
            // ── PHONE with good GPS ──────────────────────
            if (distance <= effectiveThreshold) {
              setGeoStatus(
                `✅ Location Verified! ` +
                `You are ${distance.toFixed(0)}m from shop. ` +
                `GPS Accuracy: ±${accuracy.toFixed(0)}m ` +
                `(${accLabel}). ` +
                `Ration distribution is allowed.`,
                "success"
              );
              resolve(true);
            } else {
              setGeoStatus(
                `❌ Location Mismatch! ` +
                `You are ${distance.toFixed(0)}m from shop. ` +
                `GPS Accuracy: ±${accuracy.toFixed(0)}m. ` +
                `You must be at the shop to distribute.`,
                "error"
              );
              showManualConfirmButton(resolve);
            }

          } else if (isPhone && accuracy > 50) {
            // ── PHONE with medium GPS ────────────────────
            if (distance <= effectiveThreshold) {
              setGeoStatus(
                `✅ Location Verified! ` +
                `Distance: ${distance.toFixed(0)}m. ` +
                `GPS: ±${accuracy.toFixed(0)}m (${accLabel}).`,
                "success"
              );
              resolve(true);
            } else {
              setGeoStatus(
                `⚠️ GPS shows ${distance.toFixed(0)}m from shop. ` +
                `Accuracy: ±${accuracy.toFixed(0)}m. ` +
                `If you are at shop, confirm below.`,
                "warning"
              );
              showManualConfirmButton(resolve);
            }

          } else {
            // ── LAPTOP — WiFi GPS ────────────────────────
            // Laptop GPS is always inaccurate
            // Show info but offer confirm button
            if (distance <= effectiveThreshold) {
              setGeoStatus(
                `✅ Location logged. ` +
                `Distance: ${distance.toFixed(0)}m. ` +
                `Note: Laptop GPS accuracy ` +
                `±${accuracy.toFixed(0)}m may vary. ` +
                `Proceeding to face verification.`,
                "success"
              );
              resolve(true);
            } else {
              setGeoStatus(
                `⚠️ Laptop GPS shows ${distance.toFixed(0)}m ` +
                `from shop (Accuracy: ±${accuracy.toFixed(0)}m). ` +
                `Laptop WiFi GPS is inaccurate. ` +
                `If you are at shop, confirm below.`,
                "warning"
              );
              showManualConfirmButton(resolve);
            }
          }
        },

        // ── GPS Error Handler ─────────────────────────────
        async (error) => {
          console.log("GPS error:", error.message);
          await logGeoToDatabase(0, 0);

          let errMsg = "";
          switch(error.code) {
            case 1:
              errMsg = isPhone
                ? "Location permission denied! " +
                  "Go to Phone Settings → Apps → Chrome → " +
                  "Permissions → Location → Allow."
                : "Location permission denied! " +
                  "Click 🔒 in Chrome address bar → " +
                  "Location → Allow → Refresh.";
              break;
            case 2:
              errMsg =
                "Location unavailable. " +
                (isPhone
                  ? "Go outside for better GPS signal."
                  : "Check internet connection.");
              break;
            case 3:
              errMsg = "Location timeout. Try again.";
              break;
            default:
              errMsg = error.message;
          }

          setGeoStatus(
            `⚠️ GPS Error: ${errMsg}`,
            "warning"
          );
          showManualConfirmButton(resolve);
        },

        {
          enableHighAccuracy: true,  // Use GPS on phone
          timeout:            isPhone ? 20000 : 15000,
          maximumAge:         0
        }
      );
    }

    // Start location detection
    tryGetLocation();
  });
}

// ── Log to geo_logs table ─────────────────────────────────────
// Uses dealer_id as ration_card (no FK constraint after SQL fix)
async function logGeoToDatabase(lat, lon) {
  try {
    const { error } = await db.from("geo_logs").insert([{
      ration_card: String(currentDealer.dealer_id),
      latitude:    parseFloat(lat)  || 0,
      longitude:   parseFloat(lon)  || 0,
      logged_at:   new Date().toISOString()
    }]);
    if (error) {
      console.log("Geo log note:", error.message);
    } else {
      console.log("📍 Geo log saved");
    }
  } catch(e) {
    console.log("Geo log note:", e.message);
  }
}

// ── Show geo info boxes in modal ──────────────────────────────
function showGeoInfoBox(
  dealerLat, dealerLon,
  shopLat,   shopLon,
  distance,  accuracy,
  accLabel,  accColor
) {
  const box = document.getElementById("geoInfoBox");
  if (!box) return;
  box.style.display = "block";

  const isWithin = distance <= MAX_DISTANCE_METERS;
  const mapsUrl  =
    `https://www.google.com/maps/dir/` +
    `${dealerLat},${dealerLon}/` +
    `${shopLat},${shopLon}`;

  box.innerHTML = `
    <table style="width:100%;border-collapse:collapse;
                  font-size:12px">
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 10px;color:#888;
                   width:45%">
          📱 Your Location
        </td>
        <td style="padding:8px 10px;font-weight:bold;
                   color:#333">
          ${dealerLat.toFixed(6)}, ${dealerLon.toFixed(6)}
        </td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 10px;color:#888">
          🏪 Shop Location
        </td>
        <td style="padding:8px 10px;font-weight:bold;
                   color:#333">
          ${shopLat.toFixed(6)}, ${shopLon.toFixed(6)}
        </td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 10px;color:#888">
          📏 Distance from Shop
        </td>
        <td style="padding:8px 10px;font-weight:bold;
                   color:${isWithin ? '#15803d' : '#b91c1c'}">
          ${distance.toFixed(0)} meters
          ${isWithin ? '✅ Within range' : '⚠️ Check GPS'}
        </td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 10px;color:#888">
          📡 GPS Accuracy
        </td>
        <td style="padding:8px 10px;font-weight:bold;
                   color:${accColor}">
          ±${accuracy.toFixed(0)}m — ${accLabel}
        </td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 10px;color:#888">
          ✅ Allowed Range
        </td>
        <td style="padding:8px 10px;font-weight:bold;
                   color:#15803d">
          ${MAX_DISTANCE_METERS}m
          (${(MAX_DISTANCE_METERS/1000).toFixed(1)}km)
        </td>
      </tr>
      <tr>
        <td style="padding:8px 10px;color:#888">
          🗺️ View on Map
        </td>
        <td style="padding:8px 10px">
          <a href="${mapsUrl}" target="_blank"
             style="color:#1565c0;font-size:11px;
                    font-weight:bold">
            Open Google Maps →
          </a>
        </td>
      </tr>
    </table>
    ${accuracy > 200 ? `
    <div style="margin-top:10px;padding:10px;
                background:#fff3e0;border-radius:8px;
                font-size:11px;color:#a16207;
                line-height:1.6">
      ⚠️ <strong>Note:</strong>
      Laptop GPS uses WiFi triangulation which is
      inaccurate (±${accuracy.toFixed(0)}m error).
      This may show wrong distance.
      If you are physically at the shop,
      use the confirm button below.
    </div>` : ""}`;
}

// ── Manual Confirm Button ─────────────────────────────────────
function showManualConfirmButton(resolve) {
  // Remove existing if any
  const existing = document.getElementById("geoConfirmDiv");
  if (existing) existing.remove();

  const geoSection = document.getElementById("geoSection");
  if (!geoSection) {
    resolve(true);
    return;
  }

  const div    = document.createElement("div");
  div.id       = "geoConfirmDiv";
  div.style.cssText = `
    margin-top:14px;padding:14px;
    background:#fff3e0;border:1px solid #fde68a;
    border-radius:10px`;

  div.innerHTML = `
    <p style="font-size:13px;font-weight:bold;
              color:#a16207;margin-bottom:6px">
      📍 Confirm Your Location
    </p>
    <p style="font-size:11px;color:#555;
              margin-bottom:12px;line-height:1.6">
      GPS may be inaccurate on laptop.
      If you are <strong>physically at the shop</strong>,
      click the button below to confirm and proceed.
      This confirmation is saved with timestamp
      for Supply Officer review.
    </p>
    <button onclick="confirmAtShop()"
            style="width:100%;padding:11px;
                   background:#2e7d32;color:white;
                   border:none;border-radius:8px;
                   cursor:pointer;font-size:13px;
                   font-weight:bold;margin-bottom:8px">
      ✅ I Confirm — I am Physically at the Shop
    </button>
    <p style="font-size:10px;color:#888;
              text-align:center">
      ⚠️ False confirmation is a punishable offence
      under PDS regulations
    </p>`;

  geoSection.appendChild(div);
  window._geoResolve = resolve;
}

// ── Confirm at shop ───────────────────────────────────────────
async function confirmAtShop() {
  // Log manual override
  await logGeoToDatabase(-1, -1);

  // Remove confirm div
  const div = document.getElementById("geoConfirmDiv");
  if (div) div.remove();

  setGeoStatus(
    "✅ Location Manually Confirmed. " +
    "Dealer confirmed physical presence at shop. " +
    "Confirmation saved for officer audit. " +
    "Proceeding to face verification.",
    "success"
  );

  if (window._geoResolve) {
    window._geoResolve(true);
    window._geoResolve = null;
  }
}

// ══════════════════════════════════════════════════════════════
// 19. OPEN FACE SCANNER MODAL
//     Runs GEO verification first, then face scanner
// ══════════════════════════════════════════════════════════════
async function openFaceScanner(rationCard, tokenId) {
  currentScanRationCard = rationCard;
  currentScanTokenId    = tokenId;
  collectionOTP         = "";
  geoVerified           = false;
  faceVerified          = false;

  // Show modal and reset all
  document.getElementById("faceScanOverlay").style.display = "flex";
  document.getElementById("scanRationCardLabel").textContent =
    "🪪 Ration Card: " + rationCard;

  // Reset all steps
  resetScannerUI();

  // ── SHOW STEP INDICATORS ──────────────────────────────────
  document.getElementById("stepIndicators").style.display = "flex";

  // ── STEP 1: GEO VERIFICATION ─────────────────────────────
  showStep(1);
  document.getElementById("geoSection").style.display  = "block";
  document.getElementById("faceSection").style.display = "none";
  document.getElementById("otpSection").style.display  = "none";

  // Run geo verification automatically
  geoVerified = await verifyDealerLocation();

  if (!geoVerified) {
    // Geo failed — stop here, face scan blocked
    document.getElementById("startScanBtn").style.display = "none";
    document.getElementById("proceedToFaceBtn").style.display = "none";
    return;
  }

  // Geo passed — show proceed button
  document.getElementById("proceedToFaceBtn").style.display = "block";
}

// ══════════════════════════════════════════════════════════════
// 20. PROCEED TO FACE SCAN (after geo verified)
// ══════════════════════════════════════════════════════════════
async function proceedToFaceScan() {
  document.getElementById("proceedToFaceBtn").style.display = "none";

  // ── STEP 2: FACE VERIFICATION ─────────────────────────────
  showStep(2);
  document.getElementById("geoSection").style.display  = "none";
  document.getElementById("faceSection").style.display = "block";
  document.getElementById("otpSection").style.display  = "none";

  setScanStatus("⏳ Step 1: Loading face AI models...", "loading");

  // Load face models
  const loaded = await loadFaceModels();
  if (!loaded) {
    setScanStatus("❌ Failed to load face AI models.", "error");
    return;
  }

  // Start camera
  setScanStatus("⏳ Step 2: Starting camera...", "loading");
  try {
    if (faceStream) {
      faceStream.getTracks().forEach(t=>t.stop());
      faceStream = null;
    }
    faceStream = await navigator.mediaDevices.getUserMedia({
      video: { width:{ideal:640}, height:{ideal:480},
               facingMode:"user" },
      audio: false
    });
    const video = document.getElementById("scanVideo");
    video.srcObject = faceStream;
    await new Promise(resolve => {
      video.onloadedmetadata = () => { video.play(); resolve(); };
    });
    setScanStatus(
      "✅ Camera ready! Look at camera and click 'Scan Face'.",
      "success"
    );
  } catch(err) {
    let msg = "❌ Camera error: " + err.message;
    if (err.name==="NotAllowedError") {
      msg = "❌ Camera denied! Click 🔒 in address bar → Allow camera.";
    }
    setScanStatus(msg, "error"); return;
  }

  // ── Load SPECIFIC member's photo from token ─────────────
  // Token stores which member will collect ration
  // Only that member's face is verified — not head of family
  try {
    // First check if token has specific member photo
    const { data: tokenRows } = await db
      .from("tokens")
      .select("*")
      .eq("id", currentScanTokenId)
      .limit(1);

    const token = tokenRows && tokenRows[0]
      ? tokenRows[0] : null;

    let memberPhoto = "";
    let memberName  = "";
    let memberRel   = "";

    if (token &&
        token.collecting_member_photo &&
        token.collecting_member_photo !== "") {
      // ✅ Use the specific member selected during token booking
      memberPhoto = token.collecting_member_photo;
      memberName  = token.collecting_member_name || "Member";
      memberRel   = "Selected Collector";
      console.log(`📷 Loading photo of: ${memberName}`);

    } else {
      // Fallback: load head of family photo
      const { data: members } = await db
        .from("family_members")
        .select("*")
        .eq("ration_card", currentScanRationCard);

      if (members && members.length > 0) {
        const withPhoto =
          members.find(m => m.photo_url && m.photo_url !== "");
        if (withPhoto) {
          memberPhoto = withPhoto.photo_url;
          memberName  = withPhoto.name;
          memberRel   = withPhoto.relation;
        }
      }
    }

    // Load photo into face scanner
    if (memberPhoto) {
      const img = document.getElementById("storedMemberPhoto");
      img.crossOrigin   = "anonymous";
      img.src           = memberPhoto;
      img.style.display = "block";
      document.getElementById("noPhotoMsg").style.display =
        "none";
      document.getElementById("memberNameLabel").textContent =
        `${memberName} — ${memberRel}`;
      setScanStatus(
        `✅ Camera ready! Loaded photo of ${memberName}. ` +
        `Click 'Scan Face' to verify.`,
        "success"
      );
    } else {
      setScanStatus(
        "⚠️ No face photo found for this member! " +
        "Citizen must re-register with a face photo.",
        "warning"
      );
    }
  } catch(err) {
    console.warn("Photo load error:", err.message);
    setScanStatus(
      "⚠️ Could not load member photo: " + err.message,
      "warning"
    );
  }

  // Show scan button
  document.getElementById("startScanBtn").style.display = "block";
}

// ══════════════════════════════════════════════════════════════
// 21. LOAD FACE MODELS
// ══════════════════════════════════════════════════════════════
async function loadFaceModels() {
  if (faceModelsLoaded) return true;
  try {
    const MODEL_URL =
      "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    faceModelsLoaded = true;
    console.log("✅ All face models loaded");
    return true;
  } catch(err) {
    console.error("Model error:", err);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// 22. RUN FACE SCAN
//     NO similarity score shown
//     Only result: MATCHED ✅ or NOT MATCHED ❌
// ══════════════════════════════════════════════════════════════
async function runFaceScan() {
  if (!geoVerified) {
    setScanStatus(
      "❌ Geo-location not verified! Complete location verification first.",
      "error"
    );
    return;
  }

  const video   = document.getElementById("scanVideo");
  const scanBtn = document.getElementById("startScanBtn");

  if (!video.srcObject || !faceStream) {
    setScanStatus("❌ Camera not started. Close and try again.", "error");
    return;
  }
  if (video.readyState < 2) {
    setScanStatus("⏳ Camera loading... Please wait.", "loading");
    setTimeout(runFaceScan, 1000);
    return;
  }

  scanBtn.disabled    = true;
  scanBtn.textContent = "⏳ Detecting...";

  // Detection options
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize:      608,
    scoreThreshold: 0.3
  });

  try {
    // ── STEP 1: Capture multiple frames from live camera ──
    setScanStatus(
      "🔍 Detecting face from camera... Keep still and look straight.",
      "loading"
    );

    const SAMPLE_COUNT    = 5;
    const liveDescriptors = [];

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      setScanStatus(
        `🔍 Scanning frame ${i + 1} of ${SAMPLE_COUNT}... Keep still.`,
        "loading"
      );

      // Draw video to canvas for preprocessing
      const canvas  = document.createElement("canvas");
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      const ctx     = canvas.getContext("2d");

      // Flip mirror and enhance brightness/contrast
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = "brightness(1.1) contrast(1.2)";
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = "none";

      const detection = await faceapi
        .detectSingleFace(canvas, options)
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (detection) liveDescriptors.push(detection.descriptor);
      await new Promise(r => setTimeout(r, 300));
    }

    if (liveDescriptors.length === 0) {
      setScanStatus(
        "❌ No face detected in camera! " +
        "Make sure: (1) Face clearly visible, " +
        "(2) Good lighting, " +
        "(3) Look straight at camera.",
        "error"
      );
      scanBtn.disabled    = false;
      scanBtn.textContent = "📸 Scan Again";
      return;
    }

    setScanStatus("✅ Face detected! Comparing with stored photo...", "loading");

    // ── STEP 2: Average live descriptors ──────────────────
    const avgLiveDescriptor = averageDescriptors(liveDescriptors);

    // ── STEP 3: Load and process stored photo ─────────────
    const storedImg = document.getElementById("storedMemberPhoto");
    if (!storedImg || !storedImg.src ||
        storedImg.style.display === "none") {
      setScanStatus(
        "⚠️ No stored photo found. " +
        "Citizen must re-register with a clear face photo.",
        "warning"
      );
      scanBtn.disabled    = false;
      scanBtn.textContent = "📸 Scan Again";
      return;
    }

    // Load stored image
    const refImg = new Image();
    refImg.crossOrigin = "anonymous";
    await new Promise(r => {
      refImg.onload  = r;
      refImg.onerror = r;
      refImg.src     = storedImg.src + "?t=" + Date.now();
    });
    await new Promise(r => setTimeout(r, 500));

    // Preprocess stored photo
    const refCanvas  = document.createElement("canvas");
    refCanvas.width  = refImg.naturalWidth  || 640;
    refCanvas.height = refImg.naturalHeight || 480;
    const refCtx     = refCanvas.getContext("2d");
    refCtx.drawImage(refImg, 0, 0);
    refCtx.filter = "brightness(1.1) contrast(1.15)";
    refCtx.drawImage(refCanvas, 0, 0);
    refCtx.filter = "none";

    // ── STEP 4: Detect face in stored photo ───────────────
    let storedDetection = null;

    // Attempt 1
    storedDetection = await faceapi
      .detectSingleFace(refCanvas, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    // Attempt 2 — lower threshold
    if (!storedDetection) {
      storedDetection = await faceapi
        .detectSingleFace(refCanvas,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416, scoreThreshold: 0.2
          }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();
    }

    // Attempt 3 — original image
    if (!storedDetection) {
      storedDetection = await faceapi
        .detectSingleFace(refImg,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416, scoreThreshold: 0.2
          }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();
    }

    if (!storedDetection) {
      setScanStatus(
        "⚠️ Cannot detect face in stored photo! " +
        "The stored photo is not a clear face photo. " +
        "Ask citizen to re-register with a proper selfie.",
        "warning"
      );
      scanBtn.disabled    = false;
      scanBtn.textContent = "📸 Scan Again";
      return;
    }

    // ── STEP 5: Calculate Euclidean Distance ──────────────
    const distance  = faceapi.euclideanDistance(
      avgLiveDescriptor,
      storedDetection.descriptor
    );

    const THRESHOLD = 0.5;
    const isMatch   = distance < THRESHOLD;

    console.log(`📊 Distance: ${distance.toFixed(4)}`);
    console.log(`📊 Result: ${isMatch ? "MATCHED ✅" : "NOT MATCHED ❌"}`);

    // ── STEP 6: Save face log (no score shown to user) ────
    try {
      await db.from("face_logs").insert([{
        ration_card:  currentScanRationCard,
        dealer_id:    currentDealer.dealer_id,
        member_name:  document.getElementById("memberNameLabel")
                        .textContent || "Unknown",
        match_score:  Math.round((1 - distance) * 100) / 100,
        verified:     isMatch,
        scanned_at:   new Date().toISOString()
      }]);
    } catch(e) {
      console.log("Face log note:", e.message);
    }

    // ── STEP 7: Show ONLY MATCHED or NOT MATCHED result ─────
    // NO score bar, NO percentage, NO distance value shown
    // Only show clear MATCHED ✅ or NOT MATCHED ❌
    const resultBox = document.getElementById("faceResultBox");

    if (isMatch) {
      faceVerified = true;

      // Show big MATCHED result
      if (resultBox) {
        resultBox.style.display = "block";
        resultBox.className     = "match-result-box match-result-matched";
        resultBox.innerHTML     = `
          <span class="match-icon">✅</span>
          <span class="match-label">FACE MATCHED</span>
          <span class="match-sublabel">
            Identity Verified — Ration distribution allowed
          </span>`;
      }

      setScanStatus(
        "✅ FACE MATCHED — Identity Verified! " +
        "Proceeding to OTP verification...",
        "success"
      );

      // Move to OTP step after short delay
      setTimeout(() => {
        showStep(3);
        document.getElementById("faceSection").style.display = "none";
        document.getElementById("otpSection").style.display  = "block";
      }, 2000);

    } else {
      faceVerified = false;

      // Show big NOT MATCHED result
      if (resultBox) {
        resultBox.style.display = "block";
        resultBox.className     = "match-result-box match-result-notmatched";
        resultBox.innerHTML     = `
          <span class="match-icon">❌</span>
          <span class="match-label">FACE NOT MATCHED</span>
          <span class="match-sublabel">
            Identity Verification Failed — Ration distribution NOT allowed
          </span>`;
      }

      setScanStatus(
        "❌ FACE NOT MATCHED — Ration distribution is NOT allowed. " +
        "Scan again or verify manually.",
        "error"
      );
    }

    scanBtn.disabled    = false;
    scanBtn.textContent = "📸 Scan Again";

  } catch(err) {
    console.error("Scan error:", err);
    setScanStatus("❌ Scan error: " + err.message, "error");
    scanBtn.disabled    = false;
    scanBtn.textContent = "📸 Scan Again";
  }
}

// ══════════════════════════════════════════════════════════════
// HELPER: Average multiple face descriptors
// ══════════════════════════════════════════════════════════════
function averageDescriptors(descriptors) {
  if (descriptors.length === 0) return null;
  if (descriptors.length === 1) return descriptors[0];
  const length = descriptors[0].length;
  const avg    = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let j = 0; j < descriptors.length; j++) {
      sum += descriptors[j][i];
    }
    avg[i] = sum / descriptors.length;
  }
  return avg;
}

// ══════════════════════════════════════════════════════════════
// 23. GENERATE COLLECTION OTP
//     Only allowed after BOTH geo + face verified
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// 23. FETCH CITIZEN LOGIN OTP FROM TOKEN
//     No new OTP generated — citizen uses their login OTP
//     Dealer fetches it from tokens table and asks citizen
// ══════════════════════════════════════════════════════════════
async function generateCollectionOTP() {
  const msg = document.getElementById("otpVerifyMsg");

  if (!geoVerified) {
    showAdminMsg(msg,
      "❌ Geo-location not verified! Cannot proceed.",
      "red");
    return;
  }
  if (!faceVerified) {
    showAdminMsg(msg,
      "❌ Face not verified! Cannot proceed.",
      "red");
    return;
  }

  // Disable button while fetching
  const genBtn =
    document.getElementById("generateCollectionOTPBtn");
  if (genBtn) {
    genBtn.disabled    = true;
    genBtn.textContent = "⏳ Fetching OTP...";
  }

  try {
    const nowTs = new Date().toISOString();
    let foundOTP = null;

    // ── Method 1: Try token's login_otp column ────────────
    try {
      const { data: tokenRows } = await db
        .from("tokens")
        .select("login_otp, ration_card")
        .eq("id", currentScanTokenId)
        .limit(1);

      if (tokenRows && tokenRows[0] &&
          tokenRows[0].login_otp) {
        foundOTP = tokenRows[0].login_otp;
        console.log("✅ OTP from token.login_otp");
      }
    } catch(e) {
      console.log("login_otp column may not exist:", e.message);
    }

    // ── Method 2: Fetch from otp_logs (valid + not used) ──
    if (!foundOTP) {
      const { data: otpRows } = await db
        .from("otp_logs")
        .select("*")
        .eq("ration_card", currentScanRationCard)
        .eq("purpose",     "login")
        .eq("is_used",     false)
        .gt("expires_at",  nowTs)
        .order("created_at", { ascending: false })
        .limit(1);

      if (otpRows && otpRows[0]) {
        foundOTP = otpRows[0].otp_code;
        console.log("✅ OTP from otp_logs");
      }
    }

    // ── Method 3: Any recent OTP regardless of is_used ────
    if (!foundOTP) {
      const { data: anyOtp } = await db
        .from("otp_logs")
        .select("*")
        .eq("ration_card", currentScanRationCard)
        .eq("purpose",     "login")
        .gt("expires_at",  nowTs)
        .order("created_at", { ascending: false })
        .limit(1);

      if (anyOtp && anyOtp[0]) {
        foundOTP = anyOtp[0].otp_code;
        console.log("✅ OTP from otp_logs (any)");
      }
    }

    if (!foundOTP) {
      // No OTP found at all
      if (msg) showAdminMsg(msg,
        "⚠️ No valid OTP found for this citizen. " +
        "Ask them to open their dashboard and " +
        "check the 🎫 Book Token tab for their OTP. " +
        "If expired, they must re-login to get new OTP.",
        "orange");

      // Still show input so dealer can manually enter
      const nb = document.getElementById("otpGeneratedBox");
      if (nb) nb.style.display = "block";
      const nd = document.getElementById("collectionOTPDisplay");
      if (nd) nd.textContent = "Ask citizen";
      const nv = document.getElementById("verifyCollectionOTPBtn");
      if (nv) nv.style.display = "block";

      if (genBtn) {
        genBtn.disabled    = false;
        genBtn.textContent = "🔐 Fetch Citizen OTP";
      }
      return;
    }

    // ✅ OTP found — store and show success
    collectionOTP = foundOTP;

    // Safely update DOM elements with null checks
    const genBox = document.getElementById("otpGeneratedBox");
    if (genBox) genBox.style.display = "block";

    const dispEl =
      document.getElementById("collectionOTPDisplay");
    if (dispEl) dispEl.textContent = "••••••";

    const verifyBtn =
      document.getElementById("verifyCollectionOTPBtn");
    if (verifyBtn) verifyBtn.style.display = "block";

    if (genBtn) {
      genBtn.textContent      = "✅ OTP Ready — Enter Below";
      genBtn.style.background = "#15803d";
      genBtn.disabled         = true;
    }

    if (msg) showAdminMsg(msg,
      "✅ Citizen OTP fetched! " +
      "Ask citizen to tell you their 6-digit OTP " +
      "from their dashboard 🎫 Book Token tab. " +
      "Enter it below to verify.",
      "green");

  } catch(err) {
    console.error("OTP fetch error:", err);
    if (msg) showAdminMsg(msg,
      "❌ Error fetching OTP: " + err.message +
      ". Ask citizen for their OTP manually.",
      "red");

    const evb = document.getElementById("verifyCollectionOTPBtn");
    if (evb) evb.style.display = "block";

    if (genBtn) {
      genBtn.disabled    = false;
      genBtn.textContent = "🔐 Fetch Citizen OTP";
    }
  }
}


// ══════════════════════════════════════════════════════════════
// 24. VERIFY OTP → Show Quantity Entry → Generate Bill
// ══════════════════════════════════════════════════════════════
async function verifyCollectionOTP() {
  const entered = document.getElementById("collectionOTPInput")
                    .value.trim();
  const msg     = document.getElementById("otpVerifyMsg");

  // Security checks
  if (!geoVerified) {
    showAdminMsg(msg,"❌ Geo not verified!","red"); return;
  }
  if (!faceVerified) {
    showAdminMsg(msg,"❌ Face not verified!","red"); return;
  }
  if (!entered || entered.length !== 6) {
    showAdminMsg(msg,"⚠️ Enter 6-digit OTP.","red"); return;
  }
  if (entered !== collectionOTP) {
    showAdminMsg(msg,"❌ Wrong OTP. Ask citizen to repeat.","red");
    return;
  }

  // Mark OTP as used — citizen must login again for new OTP
  const { error: otpErr } = await db.from("otp_logs")
    .update({ is_used: true })
    .eq("ration_card", currentScanRationCard)
    .eq("otp_code", collectionOTP);

  if (otpErr) {
    console.log("OTP mark used note:", otpErr.message);
  } else {
    console.log("✅ OTP marked as used");
  }

  // Clear login_otp from token (one-time use)
  await db.from("tokens")
    .update({ login_otp: null })
    .eq("id", currentScanTokenId);

  // Also update currentUserOTP in case citizen
  // checks dashboard — they will see "OTP Expired/Used"
  clearInterval(collectionOTPTimer);
  collectionOTP = "";

  showAdminMsg(msg,"✅ OTP Verified! Enter quantities below.","green");

  // Hide OTP input, show bill section
  document.getElementById("verifyCollectionOTPBtn")
    .style.display = "none";
  document.getElementById("generateCollectionOTPBtn")
    .style.display = "none";

  // Update step badge
  const otpBadge = document.querySelector(".pending-badge");
  if (otpBadge) {
    otpBadge.className   = "verified-badge";
    otpBadge.textContent = "📱 OTP ✅";
  }

  // Show bill/quantity section
  await showQuantityEntryBox();
  document.getElementById("billSection").style.display = "block";
}

// ══════════════════════════════════════════════════════════════
// 24b. SHOW QUANTITY ENTRY BOX
//      Fetches entitlement based on card category + member count
//      Dealer enters actual quantity citizen is taking
// ══════════════════════════════════════════════════════════════
async function showQuantityEntryBox() {
  const box = document.getElementById("quantityEntryBox");
  if (!box) return;

  box.innerHTML = `<p style="font-size:12px;color:#888">
    ⏳ Loading entitlement...</p>`;

  // Fetch user category
  const { data: userRows } = await db.from("users")
    .select("*")
    .eq("ration_card", currentScanRationCard)
    .limit(1);
  const user     = userRows && userRows[0] ? userRows[0] : null;
  const category = user ? user.category : "BPL";

  // Fetch member count
  const { data: members } = await db.from("family_members")
    .select("*")
    .eq("ration_card", currentScanRationCard);
  const memberCount = members ? members.length : 1;

  // Get entitlement quantities
  const r = RATIONS[category] || RATIONS.BPL;
  const p = PRICES[category]  || PRICES.BPL;

  const riceEntitled  = r.rice  * memberCount;
  const wheatEntitled = r.wheat * memberCount;
  const sugarEntitled = r.sugar * memberCount;

  // Check existing balance (partial collection already done)
  const nowD    = new Date();
  const monthD  = nowD.toLocaleString("default",{month:"long"});
  const yearD   = nowD.getFullYear();

  const { data: balRows } = await db
    .from("ration_balance").select("*")
    .eq("ration_card", currentScanRationCard)
    .eq("month", monthD).eq("year", yearD).limit(1);

  const existBal = balRows && balRows[0] ? balRows[0] : null;

  // If balance record exists use remaining, else use full entitlement
  const actualRiceMax  = existBal
    ? parseFloat(existBal.rice_balance  || 0)
    : riceEntitled;
  const actualWheatMax = existBal
    ? parseFloat(existBal.wheat_balance || 0)
    : wheatEntitled;
  const actualSugarMax = existBal
    ? parseFloat(existBal.sugar_balance || 0)
    : sugarEntitled;

  const isPartial = !!existBal;
  const prevRice  = existBal ? parseFloat(existBal.rice_collected  || 0) : 0;
  const prevWheat = existBal ? parseFloat(existBal.wheat_collected || 0) : 0;
  const prevSugar = existBal ? parseFloat(existBal.sugar_collected || 0) : 0;

  // Store for bill generation
  window._billData = {
    category, memberCount,
    riceEntitled,  wheatEntitled,  sugarEntitled,
    riceMax:  actualRiceMax,
    wheatMax: actualWheatMax,
    sugarMax: actualSugarMax,
    prevRice, prevWheat, prevSugar,
    isPartial,
    ricePrice: p.rice, wheatPrice: p.wheat, sugarPrice: p.sugar
  };

  box.innerHTML = `
    <!-- Balance / Entitlement Header -->
    ${isPartial ? `
    <div style="background:#fff3e0;border:1px solid #fde68a;
                border-radius:10px;padding:12px 14px;
                margin-bottom:10px">
      <div style="font-size:12px;font-weight:bold;
                  color:#a16207;margin-bottom:4px">
        ⚠️ Partial Collection — Remaining Balance
      </div>
      <div style="font-size:11px;color:#555;line-height:1.7">
        Citizen already collected this month:<br/>
        Rice <strong>${prevRice}kg</strong> |
        Wheat <strong>${prevWheat}kg</strong> |
        Sugar <strong>${prevSugar}kg</strong><br/>
        Remaining balance shown below as max.
      </div>
    </div>` : ""}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                border-radius:10px;padding:12px 14px;
                margin-bottom:14px">
      <div style="font-size:12px;font-weight:bold;
                  color:#15803d;margin-bottom:6px">
        📋 ${isPartial?"Remaining Balance":"Entitlement"}
        for ${currentScanRationCard}
        | Category: ${category}
        | Members: ${memberCount}
      </div>
      <div style="font-size:11px;color:#555">
        ${isPartial
          ? `Balance: Rice ${actualRiceMax}kg |
             Wheat ${actualWheatMax}kg |
             Sugar ${actualSugarMax}kg`
          : `Per member: ${r.rice}kg Rice +
             ${r.wheat}kg Wheat + ${r.sugar}kg Sugar`}
      </div>
    </div>

    <!-- Quantity Entry Table -->
    <table style="width:100%;border-collapse:collapse;
                  font-size:13px;margin-bottom:10px">
      <thead>
        <tr style="background:#1b5e20;color:white">
          <th style="padding:10px 12px;text-align:left;
                     border-radius:6px 0 0 0">
            Item
          </th>
          <th style="padding:10px 12px;text-align:center">
            Entitled Qty
          </th>
          <th style="padding:10px 12px;text-align:center">
            Govt. Price
          </th>
          <th style="padding:10px 12px;text-align:center;
                     border-radius:0 6px 0 0">
            Actual Qty Taken
          </th>
        </tr>
      </thead>
      <tbody>
        <!-- Rice Row -->
        <tr style="border-bottom:1px solid #e5e7eb;
                   background:#f9fafb">
          <td style="padding:12px">
            <div style="display:flex;align-items:center;gap:8px">
              <img src="images/rice.webp"
                   style="width:32px;height:32px;
                          border-radius:6px;object-fit:cover"
                   onerror="this.style.display='none'"/>
              <div>
                <div style="font-weight:bold;color:#333">
                  🌾 Rice
                </div>
                <div style="font-size:10px;color:#888">
                  Govt rate: ₹${p.rice}/kg
                </div>
              </div>
            </div>
          </td>
          <td style="padding:12px;text-align:center;
                     font-weight:bold;color:#15803d;
                     font-size:15px">
            ${riceEntitled} kg
          </td>
          <td style="padding:12px;text-align:center;
                     color:#15803d;font-weight:bold">
            ₹${p.rice}/kg
          </td>
          <td style="padding:12px;text-align:center">
            <div style="display:flex;align-items:center;
                        justify-content:center;gap:6px">
              <button onclick="adjustQty('rice',-1)"
                      style="width:28px;height:28px;
                             border-radius:50%;border:none;
                             background:#e5e7eb;cursor:pointer;
                             font-size:16px;font-weight:bold">
                −
              </button>
              <input id="qtyRice" type="number"
                     min="0" max="${actualRiceMax}"
                     value="${actualRiceMax}"
                     style="width:65px;text-align:center;
                            padding:6px;border:1.5px solid #2e7d32;
                            border-radius:6px;font-size:14px;
                            font-weight:bold;color:#15803d"
                     onchange="updateBillPreview()"/>
              <button onclick="adjustQty('rice',1)"
                      style="width:28px;height:28px;
                             border-radius:50%;border:none;
                             background:#2e7d32;color:white;
                             cursor:pointer;font-size:16px;
                             font-weight:bold">
                +
              </button>
            </div>
            <div style="font-size:10px;color:#888;margin-top:4px">
              Max: ${actualRiceMax} kg
              ${isPartial
                ? `(Balance — was ${riceEntitled}kg)`
                : ""}
            </div>
          </td>
        </tr>

        <!-- Wheat Row -->
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:12px">
            <div style="display:flex;align-items:center;gap:8px">
              <img src="images/wheat.webp"
                   style="width:32px;height:32px;
                          border-radius:6px;object-fit:cover"
                   onerror="this.style.display='none'"/>
              <div>
                <div style="font-weight:bold;color:#333">
                  🌿 Wheat
                </div>
                <div style="font-size:10px;color:#888">
                  Govt rate: ₹${p.wheat}/kg
                </div>
              </div>
            </div>
          </td>
          <td style="padding:12px;text-align:center;
                     font-weight:bold;color:#a16207;
                     font-size:15px">
            ${wheatEntitled} kg
          </td>
          <td style="padding:12px;text-align:center;
                     color:#15803d;font-weight:bold">
            ₹${p.wheat}/kg
          </td>
          <td style="padding:12px;text-align:center">
            <div style="display:flex;align-items:center;
                        justify-content:center;gap:6px">
              <button onclick="adjustQty('wheat',-1)"
                      style="width:28px;height:28px;
                             border-radius:50%;border:none;
                             background:#e5e7eb;cursor:pointer;
                             font-size:16px;font-weight:bold">
                −
              </button>
              <input id="qtyWheat" type="number"
                     min="0" max="${actualWheatMax}"
                     value="${actualWheatMax}"
                     style="width:65px;text-align:center;
                            padding:6px;border:1.5px solid #a16207;
                            border-radius:6px;font-size:14px;
                            font-weight:bold;color:#a16207"
                     onchange="updateBillPreview()"/>
              <button onclick="adjustQty('wheat',1)"
                      style="width:28px;height:28px;
                             border-radius:50%;border:none;
                             background:#a16207;color:white;
                             cursor:pointer;font-size:16px;
                             font-weight:bold">
                +
              </button>
            </div>
            <div style="font-size:10px;color:#888;margin-top:4px">
              Max: ${actualWheatMax} kg
              ${isPartial
                ? `(Balance — was ${wheatEntitled}kg)`
                : ""}
            </div>
          </td>
        </tr>

        <!-- Sugar Row -->
        <tr>
          <td style="padding:12px">
            <div style="display:flex;align-items:center;gap:8px">
              <img src="images/sugar.webp"
                   style="width:32px;height:32px;
                          border-radius:6px;object-fit:cover"
                   onerror="this.style.display='none'"/>
              <div>
                <div style="font-weight:bold;color:#333">
                  🍬 Sugar
                </div>
                <div style="font-size:10px;color:#888">
                  Govt rate: ₹${p.sugar}/kg
                </div>
              </div>
            </div>
          </td>
          <td style="padding:12px;text-align:center;
                     font-weight:bold;color:#7e22ce;
                     font-size:15px">
            ${sugarEntitled} kg
          </td>
          <td style="padding:12px;text-align:center;
                     color:#15803d;font-weight:bold">
            ₹${p.sugar}/kg
          </td>
          <td style="padding:12px;text-align:center">
            <div style="display:flex;align-items:center;
                        justify-content:center;gap:6px">
              <button onclick="adjustQty('sugar',-1)"
                      style="width:28px;height:28px;
                             border-radius:50%;border:none;
                             background:#e5e7eb;cursor:pointer;
                             font-size:16px;font-weight:bold">
                −
              </button>
              <input id="qtySugar" type="number"
                     min="0" max="${actualSugarMax}"
                     value="${actualSugarMax}"
                     style="width:65px;text-align:center;
                            padding:6px;border:1.5px solid #7e22ce;
                            border-radius:6px;font-size:14px;
                            font-weight:bold;color:#7e22ce"
                     onchange="updateBillPreview()"/>
              <button onclick="adjustQty('sugar',1)"
                      style="width:28px;height:28px;
                             border-radius:50%;border:none;
                             background:#7e22ce;color:white;
                             cursor:pointer;font-size:16px;
                             font-weight:bold">
                +
              </button>
            </div>
            <div style="font-size:10px;color:#888;margin-top:4px">
              Max: ${actualSugarMax} kg
              ${isPartial
                ? `(Balance — was ${sugarEntitled}kg)`
                : ""}
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Live Bill Preview -->
    <div id="liveBillPreview"
         style="background:#f9fafb;border:1px solid #e5e7eb;
                border-radius:10px;padding:12px;margin-top:4px">
      <div style="font-size:12px;font-weight:bold;
                  color:#333;margin-bottom:8px">
        💰 Bill Preview (updates as you change quantities)
      </div>
      <div id="liveBillRows"></div>
      <div id="liveBillTotal"
           style="margin-top:8px;padding-top:8px;
                  border-top:2px solid #2e7d32;
                  display:flex;justify-content:space-between;
                  font-weight:bold;font-size:15px;
                  color:#15803d">
      </div>
    </div>`;

  // Initial preview update
  setTimeout(updateBillPreview, 100);
}

// ── Adjust quantity with +/- buttons ─────────────────────────
function adjustQty(item, delta) {
  const input = document.getElementById("qty" +
    item.charAt(0).toUpperCase() + item.slice(1));
  if (!input) return;
  const bd  = window._billData;
  // Use balance max if partial collection, else full entitlement
  const max = item === "rice"  ? bd.riceMax  :
              item === "wheat" ? bd.wheatMax :
                                 bd.sugarMax;
  let val = parseInt(input.value || 0) + delta;
  val = Math.max(0, Math.min(max, val));
  input.value = val;
  updateBillPreview();
}

// ── Update live bill preview ──────────────────────────────────
function updateBillPreview() {
  const bd = window._billData;
  if (!bd) return;

  const riceQty  = parseInt(document.getElementById("qtyRice")?.value  || 0);
  const wheatQty = parseInt(document.getElementById("qtyWheat")?.value || 0);
  const sugarQty = parseInt(document.getElementById("qtySugar")?.value || 0);

  const riceCost  = riceQty  * bd.ricePrice;
  const wheatCost = wheatQty * bd.wheatPrice;
  const sugarCost = sugarQty * bd.sugarPrice;
  const totalCost = riceCost + wheatCost + sugarCost;

  const rows = document.getElementById("liveBillRows");
  const tot  = document.getElementById("liveBillTotal");
  if (!rows || !tot) return;

  const items = [
    { name:"🌾 Rice",  qty:riceQty,  price:bd.ricePrice,  cost:riceCost,  entitled:bd.riceMax  },
    { name:"🌿 Wheat", qty:wheatQty, price:bd.wheatPrice, cost:wheatCost, entitled:bd.wheatMax },
    { name:"🍬 Sugar", qty:sugarQty, price:bd.sugarPrice, cost:sugarCost, entitled:bd.sugarMax },
  ];

  rows.innerHTML = items.map(item => {
    const remaining = item.entitled - item.qty;
    return `
      <div style="display:flex;justify-content:space-between;
                  align-items:center;padding:5px 0;
                  border-bottom:1px solid #f3f4f6;
                  font-size:12px">
        <span style="color:#555">${item.name}</span>
        <span style="color:#333">
          ${item.qty} kg × ₹${item.price}
        </span>
        <span style="font-weight:bold;color:#15803d">
          ₹${item.cost}
        </span>
        ${remaining > 0
          ? `<span style="font-size:10px;color:#a16207;
                          background:#fef9c3;padding:2px 6px;
                          border-radius:10px">
               ${remaining}kg remaining
             </span>`
          : `<span style="font-size:10px;color:#15803d;
                          background:#dcfce7;padding:2px 6px;
                          border-radius:10px">
               Full qty ✅
             </span>`}
      </div>`;
  }).join("");

  tot.innerHTML = `
    <span>💰 TOTAL</span>
    <span style="font-size:18px">₹${totalCost}</span>`;
}

// ══════════════════════════════════════════════════════════════
// 24c. GENERATE BILL + COMPLETE DISTRIBUTION
// ══════════════════════════════════════════════════════════════
async function generateAndShowBill() {
  const bd = window._billData;
  if (!bd) return;

  const riceQty  = parseInt(document.getElementById("qtyRice")?.value  || 0);
  const wheatQty = parseInt(document.getElementById("qtyWheat")?.value || 0);
  const sugarQty = parseInt(document.getElementById("qtySugar")?.value || 0);

  // Validate at least one item
  if (riceQty === 0 && wheatQty === 0 && sugarQty === 0) {
    const msg = document.getElementById("billCompleteMsg");
    showAdminMsg(msg,
      "⚠️ Enter at least one item quantity greater than 0.",
      "red");
    return;
  }

  const riceCost  = riceQty  * bd.ricePrice;
  const wheatCost = wheatQty * bd.wheatPrice;
  const sugarCost = sugarQty * bd.sugarPrice;
  const totalCost = riceCost + wheatCost + sugarCost;

  const now        = new Date();
  const month      = now.toLocaleString("default", {month:"long"});
  const year       = now.getFullYear();
  const dateStr    = now.toLocaleDateString("en-IN",{
    day:"2-digit", month:"long", year:"numeric"
  });
  const timeStr    = now.toLocaleTimeString("en-IN",{
    hour:"2-digit", minute:"2-digit"
  });
  const billNumber =
    `BILL-${currentScanRationCard}-` +
    `${month.substring(0,3).toUpperCase()}` +
    `${year}-${Date.now()%10000}`;

  const btn = document.getElementById("generateBillBtn");
  if (btn) {
    btn.disabled    = true;
    btn.textContent = "⏳ Generating Bill...";
  }

  // Save ration_distribution
  const { data: ex } = await db.from("ration_distribution")
    .select("*")
    .eq("ration_card", currentScanRationCard)
    .eq("month", month).eq("year", year).limit(1);
  const existing = ex && ex[0] ? ex[0] : null;

  if (existing) {
    await db.from("ration_distribution").update({
      rice_kg:  riceQty, wheat_kg: wheatQty,
      sugar_kg: sugarQty, collected: true,
      collected_at: now.toISOString()
    }).eq("id", existing.id);
  } else {
    await db.from("ration_distribution").insert([{
      ration_card: currentScanRationCard,
      dealer_id:   currentDealer.dealer_id,
      month, year,
      rice_kg:     riceQty, wheat_kg: wheatQty,
      sugar_kg:    sugarQty, collected: true,
      collected_at: now.toISOString()
    }]);
  }

  // Save bill to database (payment_status = pending)
  await db.from("bills").insert([{
    bill_number:    billNumber,
    ration_card:    currentScanRationCard,
    dealer_id:      currentDealer.dealer_id,
    shop_name:      currentDealer.shop_name,
    locality:       currentDealer.locality,
    month, year,
    rice_kg:        riceQty,
    wheat_kg:       wheatQty,
    sugar_kg:       sugarQty,
    rice_price:     bd.ricePrice,
    wheat_price:    bd.wheatPrice,
    sugar_price:    bd.sugarPrice,
    total_amount:   totalCost,
    payment_status: "pending",
    payment_method: "",
    bill_date:      now.toISOString()
  }]);

  // ── Update Ration Balance ───────────────────────────────
  // Calculate remaining balance after this collection
  const riceBalance  = bd.riceEntitled  - riceQty;
  const wheatBalance = bd.wheatEntitled - wheatQty;
  const sugarBalance = bd.sugarEntitled - sugarQty;

  // Last day of current month
  const lastDay = new Date(year, now.getMonth()+1, 0);
  const expiresOn = lastDay.toISOString().split("T")[0];

  // Check existing balance record
  const { data: existBal } = await db
    .from("ration_balance").select("*")
    .eq("ration_card", currentScanRationCard)
    .eq("month", month).eq("year", year).limit(1);

  if (existBal && existBal[0]) {
    // Update existing record — add to collected
    const prev = existBal[0];
    const newRiceCollected  = prev.rice_collected  + riceQty;
    const newWheatCollected = prev.wheat_collected + wheatQty;
    const newSugarCollected = prev.sugar_collected + sugarQty;
    await db.from("ration_balance").update({
      rice_collected:  newRiceCollected,
      wheat_collected: newWheatCollected,
      sugar_collected: newSugarCollected,
      rice_balance:    prev.rice_entitled  - newRiceCollected,
      wheat_balance:   prev.wheat_entitled - newWheatCollected,
      sugar_balance:   prev.sugar_entitled - newSugarCollected,
      last_updated:    now.toISOString()
    }).eq("id", prev.id);
  } else {
    // Create new balance record
    await db.from("ration_balance").insert([{
      ration_card:     currentScanRationCard,
      month, year,
      rice_entitled:   bd.riceEntitled,
      wheat_entitled:  bd.wheatEntitled,
      sugar_entitled:  bd.sugarEntitled,
      rice_collected:  riceQty,
      wheat_collected: wheatQty,
      sugar_collected: sugarQty,
      rice_balance:    riceBalance,
      wheat_balance:   wheatBalance,
      sugar_balance:   sugarBalance,
      is_expired:      false,
      expires_on:      expiresOn
    }]);
  }

  // Complete token
  await db.from("tokens")
    .update({status:"completed"})
    .eq("id", currentScanTokenId);

  // Store bill info for payment step
  window._currentBill = {
    billNumber, totalCost, month, year,
    dateStr, timeStr, riceQty, wheatQty, sugarQty,
    riceCost, wheatCost, sugarCost
  };

  // Show bill receipt + payment options
  const billPreview = document.getElementById("billPreviewBox");
  if (billPreview) {
    billPreview.style.display = "block";
    billPreview.innerHTML = `
      <!-- Bill Receipt -->
      <div style="border:2px solid #2e7d32;border-radius:12px;
                  overflow:hidden;margin-bottom:16px;
                  box-shadow:0 4px 16px rgba(0,0,0,0.1)">

        <!-- Bill Header -->
        <div style="background:linear-gradient(135deg,
                      #1b5e20,#2e7d32);
                    padding:16px 20px;color:white">
          <div style="display:flex;justify-content:space-between;
                      align-items:start;flex-wrap:wrap;gap:8px">
            <div>
              <div style="font-size:16px;font-weight:bold">
                🌿 SMART RATION HUB 2026
              </div>
              <div style="font-size:11px;opacity:0.85">
                Public Distribution System — Kerala
              </div>
            </div>
            <div style="text-align:right;font-size:11px">
              <div style="font-weight:bold;background:rgba(255,255,255,0.2);
                          padding:4px 10px;border-radius:6px">
                📄 DISTRIBUTION BILL
              </div>
              <div style="opacity:0.9;margin-top:4px">
                ${billNumber}
              </div>
            </div>
          </div>
        </div>

        <!-- Citizen Info -->
        <div style="background:#f0fdf4;padding:12px 16px;
                    border-bottom:1px dashed #86efac">
          <div style="display:grid;
                      grid-template-columns:1fr 1fr;
                      gap:6px;font-size:12px">
            <div>
              <span style="color:#888">Ration Card:</span>
              <strong style="color:#1b5e20">
                ${currentScanRationCard}
              </strong>
            </div>
            <div>
              <span style="color:#888">Category:</span>
              <strong>${bd.category}</strong>
            </div>
            <div>
              <span style="color:#888">Shop:</span>
              <strong>${currentDealer.shop_name}</strong>
            </div>
            <div>
              <span style="color:#888">Date:</span>
              <strong>${dateStr}, ${timeStr}</strong>
            </div>
            <div>
              <span style="color:#888">Members:</span>
              <strong>${bd.memberCount}</strong>
            </div>
            <div>
              <span style="color:#888">Month:</span>
              <strong>${month} ${year}</strong>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width:100%;border-collapse:collapse;
                      font-size:12px">
          <thead>
            <tr style="background:#f8fafc;
                       border-bottom:1px solid #e5e7eb">
              <th style="padding:8px 12px;text-align:left;
                         color:#555">Item</th>
              <th style="padding:8px 12px;text-align:center;
                         color:#555">Entitled</th>
              <th style="padding:8px 12px;text-align:center;
                         color:#555">Collected</th>
              <th style="padding:8px 12px;text-align:center;
                         color:#555">Remaining</th>
              <th style="padding:8px 12px;text-align:center;
                         color:#555">Rate</th>
              <th style="padding:8px 12px;text-align:right;
                         color:#555">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${[
              {
                name:"🌾 Rice",
                entitled:bd.riceEntitled,
                taken:riceQty, cost:riceCost,
                price:bd.ricePrice, color:"#15803d"
              },
              {
                name:"🌿 Wheat",
                entitled:bd.wheatEntitled,
                taken:wheatQty, cost:wheatCost,
                price:bd.wheatPrice, color:"#a16207"
              },
              {
                name:"🍬 Sugar",
                entitled:bd.sugarEntitled,
                taken:sugarQty, cost:sugarCost,
                price:bd.sugarPrice, color:"#7e22ce"
              }
            ].map((item,i) => `
              <tr style="border-bottom:1px solid #f3f4f6;
                         background:${i%2===0?'white':'#fafafa'}">
                <td style="padding:10px 12px;font-weight:bold">
                  ${item.name}
                </td>
                <td style="padding:10px 12px;text-align:center;
                           color:#888">
                  ${item.entitled}kg
                </td>
                <td style="padding:10px 12px;text-align:center;
                           font-weight:bold;color:${item.color}">
                  ${item.taken}kg
                </td>
                <td style="padding:10px 12px;text-align:center;
                           font-size:11px">
                  <span style="color:${item.entitled-item.taken>0
                    ?'#a16207':'#15803d'};
                    background:${item.entitled-item.taken>0
                    ?'#fef9c3':'#dcfce7'};
                    padding:2px 8px;border-radius:10px;
                    font-weight:bold">
                    ${item.entitled - item.taken}kg
                    ${item.entitled-item.taken===0?'✅':'⚠️'}
                  </span>
                </td>
                <td style="padding:10px 12px;text-align:center;
                           color:#15803d;font-weight:bold">
                  ₹${item.price}/kg
                </td>
                <td style="padding:10px 12px;text-align:right;
                           font-weight:bold;color:${item.color};
                           font-size:14px">
                  ₹${item.cost}
                </td>
              </tr>`).join("")}
          </tbody>
          <tfoot>
            <tr style="background:linear-gradient(135deg,
                         #1b5e20,#2e7d32)">
              <td colspan="5"
                  style="padding:12px 14px;font-weight:bold;
                         color:white;font-size:14px">
                💰 TOTAL AMOUNT
              </td>
              <td style="padding:12px 14px;text-align:right;
                         font-weight:bold;color:white;
                         font-size:22px">
                ₹${totalCost}
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- Payment Status -->
        <div id="paymentStatusBar"
             style="padding:10px 16px;background:#fff3e0;
                    border-top:1px solid #fde68a;
                    display:flex;justify-content:space-between;
                    align-items:center">
          <span style="font-size:12px;color:#a16207;
                       font-weight:bold">
            💳 Payment Status:
            <span id="paymentStatusLabel">⏳ PENDING</span>
          </span>
          <span style="font-size:11px;color:#888">
            Verified: Geo ✅ | Face ✅ | OTP ✅
          </span>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════ -->
      <!-- PAYMENT SECTION -->
      <!-- ══════════════════════════════════════════════════ -->
      <div id="paymentSection"
           style="border:2px solid #e5e7eb;border-radius:12px;
                  overflow:hidden;margin-bottom:14px">

        <!-- Payment Header -->
        <div style="background:#1565c0;padding:14px 18px;
                    color:white">
          <div style="font-size:14px;font-weight:bold">
            💳 Select Payment Method
          </div>
          <div style="font-size:11px;opacity:0.85;margin-top:2px">
            Total to collect: ₹${totalCost}
          </div>
        </div>

        <!-- Payment Options -->
        <div style="padding:16px;background:white">

          <!-- Option 1: Ready Cash -->
          <div id="cashOption"
               onclick="selectPayment('cash')"
               style="border:2px solid #e5e7eb;
                      border-radius:10px;padding:14px 16px;
                      cursor:pointer;margin-bottom:12px;
                      display:flex;align-items:center;
                      gap:14px;transition:all 0.2s">
            <div style="width:44px;height:44px;
                        border-radius:50%;background:#dcfce7;
                        display:flex;align-items:center;
                        justify-content:center;font-size:22px;
                        flex-shrink:0">
              💵
            </div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:bold;
                          color:#333">
                Ready Cash
              </div>
              <div style="font-size:11px;color:#888;
                          margin-top:2px">
                Citizen pays ₹${totalCost} in cash directly to dealer
              </div>
            </div>
            <div id="cashCheck"
                 style="width:22px;height:22px;
                        border-radius:50%;border:2px solid #e5e7eb;
                        display:flex;align-items:center;
                        justify-content:center">
            </div>
          </div>

          <!-- Option 2: PayPal / Online -->
          <div id="paypalOption"
               onclick="selectPayment('paypal')"
               style="border:2px solid #e5e7eb;
                      border-radius:10px;padding:14px 16px;
                      cursor:pointer;margin-bottom:12px;
                      display:flex;align-items:center;
                      gap:14px;transition:all 0.2s">
            <div style="width:44px;height:44px;
                        border-radius:50%;background:#dbeafe;
                        display:flex;align-items:center;
                        justify-content:center;font-size:22px;
                        flex-shrink:0">
              📱
            </div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:bold;
                          color:#333">
                PayPal / Online Payment
              </div>
              <div style="font-size:11px;color:#888;
                          margin-top:2px">
                Citizen pays online via PayPal or UPI
              </div>
            </div>
            <div id="paypalCheck"
                 style="width:22px;height:22px;
                        border-radius:50%;border:2px solid #e5e7eb;
                        display:flex;align-items:center;
                        justify-content:center">
            </div>
          </div>

          <!-- Cash Section -->
          <div id="cashPaySection" style="display:none">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                        border-radius:10px;padding:14px;
                        margin-bottom:12px">
              <div style="font-size:13px;font-weight:bold;
                          color:#15803d;margin-bottom:10px">
                💵 Cash Payment
              </div>
              <div style="display:flex;align-items:center;
                          gap:10px;flex-wrap:wrap">
                <div style="flex:1;min-width:180px">
                  <label style="font-size:11px;color:#555;
                                display:block;margin-bottom:4px">
                    Amount Tendered by Citizen (₹)
                  </label>
                  <input id="cashTendered" type="number"
                         placeholder="e.g. 250"
                         min="${totalCost}"
                         style="width:100%;padding:10px 12px;
                                border:1.5px solid #2e7d32;
                                border-radius:8px;font-size:14px;
                                font-weight:bold"
                         oninput="calcCashChange(${totalCost})"/>
                </div>
                <div style="flex:1;min-width:180px">
                  <label style="font-size:11px;color:#555;
                                display:block;margin-bottom:4px">
                    Change to Return (₹)
                  </label>
                  <div id="cashChange"
                       style="padding:10px 12px;
                              background:white;
                              border:1.5px solid #e5e7eb;
                              border-radius:8px;font-size:16px;
                              font-weight:bold;color:#1565c0;
                              text-align:center">
                    —
                  </div>
                </div>
              </div>
            </div>
            <button onclick="confirmCashPayment(${totalCost})"
                    style="width:100%;padding:12px;
                           background:#15803d;color:white;
                           border:none;border-radius:8px;
                           cursor:pointer;font-size:14px;
                           font-weight:bold">
              ✅ Confirm Cash Received — ₹${totalCost}
            </button>
          </div>

          <!-- PayPal Section -->
          <div id="paypalPaySection" style="display:none">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;
                        border-radius:10px;padding:14px;
                        margin-bottom:12px">
              <div style="font-size:13px;font-weight:bold;
                          color:#1565c0;margin-bottom:10px">
                📱 PayPal / Online Payment
              </div>

              <!-- PayPal QR / ID Box -->
              <div style="background:white;border:1px solid #e5e7eb;
                          border-radius:8px;padding:16px;
                          text-align:center;margin-bottom:12px">
                <div style="font-size:32px;margin-bottom:6px">
                  📲
                </div>
                <div style="font-size:13px;font-weight:bold;
                            color:#333;margin-bottom:4px">
                  PayPal ID / UPI ID:
                </div>
                <div style="font-size:16px;font-weight:bold;
                            color:#1565c0;
                            background:#f0f9ff;
                            padding:8px 16px;border-radius:6px;
                            display:inline-block;
                            margin-bottom:8px;
                            letter-spacing:1px">
                  smartrationhub@paypal.com
                </div>
                <div style="font-size:11px;color:#888">
                  OR UPI: rationhub@upi
                </div>
                <div style="font-size:22px;
                            font-weight:bold;
                            color:#15803d;margin-top:10px">
                  Amount: ₹${totalCost}
                </div>
              </div>

              <!-- Payment Reference Entry -->
              <label style="font-size:11px;color:#555;
                            display:block;margin-bottom:4px">
                Enter PayPal Transaction ID / Reference Number:
              </label>
              <input id="paypalTxnId" type="text"
                     placeholder="e.g. PAY-123456789 or UPI-REF-XXX"
                     style="width:100%;padding:10px 12px;
                            border:1.5px solid #1565c0;
                            border-radius:8px;font-size:13px;
                            margin-bottom:10px"/>

              <!-- Payment confirmation message -->
              <div style="background:#fef9c3;
                          border:1px solid #fde68a;
                          border-radius:8px;padding:10px;
                          font-size:11px;color:#a16207;
                          margin-bottom:12px">
                ⚠️ Ask citizen to complete payment on their
                phone/device and share the transaction ID.
                Enter the ID above and click Confirm.
              </div>
            </div>
            <button onclick="confirmPaypalPayment(${totalCost})"
                    style="width:100%;padding:12px;
                           background:#1565c0;color:white;
                           border:none;border-radius:8px;
                           cursor:pointer;font-size:14px;
                           font-weight:bold">
              ✅ Confirm Online Payment — ₹${totalCost}
            </button>
          </div>

        </div>
      </div>`;
  }

  // Hide generate button
  if (btn) {
    btn.style.display = "none";
  }
}

// ══════════════════════════════════════════════════════════════
// SELECT PAYMENT METHOD
// ══════════════════════════════════════════════════════════════
function selectPayment(method) {
  // Reset both options
  const cashOpt   = document.getElementById("cashOption");
  const paypalOpt = document.getElementById("paypalOption");
  const cashCheck   = document.getElementById("cashCheck");
  const paypalCheck = document.getElementById("paypalCheck");
  const cashSec   = document.getElementById("cashPaySection");
  const paypalSec = document.getElementById("paypalPaySection");

  // Reset styles
  cashOpt.style.border   = "2px solid #e5e7eb";
  paypalOpt.style.border = "2px solid #e5e7eb";
  cashOpt.style.background   = "white";
  paypalOpt.style.background = "white";
  cashCheck.innerHTML   = "";
  paypalCheck.innerHTML = "";
  cashCheck.style.border   = "2px solid #e5e7eb";
  paypalCheck.style.border = "2px solid #e5e7eb";
  cashSec.style.display    = "none";
  paypalSec.style.display  = "none";

  if (method === "cash") {
    cashOpt.style.border     = "2px solid #15803d";
    cashOpt.style.background = "#f0fdf4";
    cashCheck.style.background = "#15803d";
    cashCheck.style.border     = "2px solid #15803d";
    cashCheck.innerHTML =
      `<span style="color:white;font-size:13px">✓</span>`;
    cashSec.style.display = "block";
    window._paymentMethod = "cash";
  } else {
    paypalOpt.style.border     = "2px solid #1565c0";
    paypalOpt.style.background = "#eff6ff";
    paypalCheck.style.background = "#1565c0";
    paypalCheck.style.border     = "2px solid #1565c0";
    paypalCheck.innerHTML =
      `<span style="color:white;font-size:13px">✓</span>`;
    paypalSec.style.display = "block";
    window._paymentMethod   = "paypal";
  }
}

// ══════════════════════════════════════════════════════════════
// CASH CHANGE CALCULATOR
// ══════════════════════════════════════════════════════════════
function calcCashChange(totalCost) {
  const tendered = parseFloat(
    document.getElementById("cashTendered")?.value || 0
  );
  const changeEl = document.getElementById("cashChange");
  if (!changeEl) return;

  if (tendered >= totalCost) {
    const change = tendered - totalCost;
    changeEl.textContent    = `₹${change.toFixed(2)}`;
    changeEl.style.color    = "#15803d";
    changeEl.style.background = "#f0fdf4";
    changeEl.style.border   = "1.5px solid #bbf7d0";
  } else if (tendered > 0) {
    const short = totalCost - tendered;
    changeEl.textContent  = `Short ₹${short.toFixed(2)}`;
    changeEl.style.color  = "#b91c1c";
    changeEl.style.background = "#fff1f2";
    changeEl.style.border = "1.5px solid #fca5a5";
  } else {
    changeEl.textContent = "—";
    changeEl.style.color = "#888";
  }
}

// ══════════════════════════════════════════════════════════════
// CONFIRM CASH PAYMENT
// ══════════════════════════════════════════════════════════════
async function confirmCashPayment(totalCost) {
  const tendered = parseFloat(
    document.getElementById("cashTendered")?.value || 0
  );

  if (!tendered || tendered < totalCost) {
    alert(`⚠️ Amount tendered (₹${tendered}) is less than total (₹${totalCost}). Please enter correct amount.`);
    return;
  }

  const change = tendered - totalCost;
  const bill   = window._currentBill;
  if (!bill) return;

  // Update payment status in bills table
  await db.from("bills")
    .update({
      payment_status: "paid",
      payment_method: "cash"
    })
    .eq("bill_number", bill.billNumber);

  // Show payment complete
  finishPayment("cash", totalCost, change, "");
}

// ══════════════════════════════════════════════════════════════
// CONFIRM PAYPAL / ONLINE PAYMENT
// ══════════════════════════════════════════════════════════════
async function confirmPaypalPayment(totalCost) {
  const txnId = document.getElementById("paypalTxnId")
                  ?.value.trim();

  if (!txnId) {
    alert("⚠️ Enter the PayPal / UPI transaction ID.");
    return;
  }

  const bill = window._currentBill;
  if (!bill) return;

  // Update payment status in bills table
  await db.from("bills")
    .update({
      payment_status: "paid",
      payment_method: `paypal:${txnId}`
    })
    .eq("bill_number", bill.billNumber);

  // Show payment complete
  finishPayment("paypal", totalCost, 0, txnId);
}

// ══════════════════════════════════════════════════════════════
// FINISH PAYMENT — Show receipt and close
// ══════════════════════════════════════════════════════════════
function finishPayment(method, totalCost, change, txnId) {
  const bill = window._currentBill;

  // Hide payment section
  const paymentSec = document.getElementById("paymentSection");
  if (paymentSec) paymentSec.style.display = "none";

  // Update payment status bar
  const statusBar   = document.getElementById("paymentStatusBar");
  const statusLabel = document.getElementById("paymentStatusLabel");
  if (statusBar) {
    statusBar.style.background = "#dcfce7";
    statusBar.style.borderTop  = "1px solid #bbf7d0";
  }
  if (statusLabel) {
    statusLabel.textContent = method === "cash"
      ? "✅ PAID — CASH"
      : "✅ PAID — ONLINE";
    statusLabel.style.color = "#15803d";
  }

  // Show final receipt summary
  const completeMsg =
    document.getElementById("billCompleteMsg");
  if (completeMsg) {
    completeMsg.style.display    = "block";
    completeMsg.style.background = "#dcfce7";
    completeMsg.style.color      = "#15803d";
    completeMsg.style.border     = "1px solid #bbf7d0";
    completeMsg.style.borderRadius = "10px";
    completeMsg.style.padding    = "14px 16px";
    completeMsg.style.fontSize   = "13px";

    if (method === "cash") {
      completeMsg.innerHTML = `
        <div style="font-size:24px;margin-bottom:8px">✅</div>
        <div style="font-weight:bold;font-size:15px;
                    margin-bottom:6px">
          Payment Complete!
        </div>
        <div style="font-size:12px;line-height:1.8">
          💵 Method: <strong>Ready Cash</strong><br/>
          💰 Total: <strong>₹${totalCost}</strong><br/>
          🧾 Tendered: <strong>₹${
            parseFloat(document.getElementById("cashTendered")
              ?.value||0).toFixed(2)
          }</strong><br/>
          🔄 Change Returned:
          <strong style="color:${change>0?'#1565c0':'#15803d'}">
            ₹${change.toFixed(2)}
          </strong><br/>
          📄 Bill: ${bill.billNumber}
        </div>`;
    } else {
      completeMsg.innerHTML = `
        <div style="font-size:24px;margin-bottom:8px">✅</div>
        <div style="font-weight:bold;font-size:15px;
                    margin-bottom:6px">
          Online Payment Confirmed!
        </div>
        <div style="font-size:12px;line-height:1.8">
          📱 Method: <strong>PayPal / Online</strong><br/>
          💰 Total: <strong>₹${totalCost}</strong><br/>
          🔑 Transaction ID:
          <strong style="color:#1565c0">${txnId}</strong><br/>
          📄 Bill: ${bill.billNumber}
        </div>`;
    }
  }

  // Refresh queue after 5 seconds
  setTimeout(() => {
    loadTokenQueue();
    loadOverviewStats();
    closeFaceScanner();
  }, 5000);
}

// ══════════════════════════════════════════════════════════════
// 25. CLOSE FACE SCANNER
// ══════════════════════════════════════════════════════════════
function closeFaceScanner() {
  if (faceStream) {
    faceStream.getTracks().forEach(t=>t.stop());
    faceStream = null;
  }
  clearInterval(collectionOTPTimer);
  const video = document.getElementById("scanVideo");
  if (video) video.srcObject = null;
  const overlay = document.getElementById("faceScanOverlay");
  if (overlay) overlay.style.display = "none";
  currentScanRationCard = "";
  currentScanTokenId    = "";
  collectionOTP         = "";
  geoVerified           = false;
  faceVerified          = false;
}

// ══════════════════════════════════════════════════════════════
// 26. UI HELPERS
// ══════════════════════════════════════════════════════════════
function resetScannerUI() {
  document.getElementById("matchScoreBox").style.display        = "none";
  document.getElementById("otpSection").style.display           = "none";
  document.getElementById("otpGeneratedBox").style.display      = "none";
  document.getElementById("otpVerifyMsg").style.display         = "none";
  document.getElementById("verifyCollectionOTPBtn").style.display= "none";
  document.getElementById("collectionOTPInput").value           = "";
  document.getElementById("storedMemberPhoto").style.display    = "none";
  document.getElementById("noPhotoMsg").style.display           = "block";
  document.getElementById("memberNameLabel").textContent        = "";
  document.getElementById("startScanBtn").style.display         = "none";
  document.getElementById("proceedToFaceBtn").style.display     = "none";
  document.getElementById("geoSection").style.display           = "none";
  document.getElementById("faceSection").style.display          = "none";
  const faceResBox = document.getElementById("faceResultBox");
  if (faceResBox) { faceResBox.style.display = "none"; faceResBox.innerHTML = ""; }

  // Reset bill section
  const billSec = document.getElementById("billSection");
  if (billSec)  { billSec.style.display = "none"; }
  const billPrev = document.getElementById("billPreviewBox");
  if (billPrev) { billPrev.style.display = "none"; billPrev.innerHTML = ""; }
  const billMsg = document.getElementById("billCompleteMsg");
  if (billMsg)  { billMsg.style.display = "none"; billMsg.textContent = ""; }
  const qtyBox = document.getElementById("quantityEntryBox");
  if (qtyBox)   { qtyBox.innerHTML = ""; }
  const genBtn = document.getElementById("generateBillBtn");
  if (genBtn)   { genBtn.style.display = "block"; genBtn.disabled = false;
                  genBtn.textContent = "🧾 Generate Bill & Complete Distribution"; }
  window._billData = null;
}

function showStep(step) {
  document.querySelectorAll(".step-indicator").forEach((el,i) => {
    el.classList.remove("step-active","step-done");
    if (i+1 < step)  el.classList.add("step-done");
    if (i+1 === step) el.classList.add("step-active");
  });
}

function setGeoStatus(text, type) {
  const el = document.getElementById("geoStatus");
  if (!el) return;
  el.textContent      = text;
  el.style.background =
    type==="success"?"#dcfce7":
    type==="error"  ?"#fee2e2":
    type==="warning"?"#fef9c3":"#e0f2fe";
  el.style.color =
    type==="success"?"#15803d":
    type==="error"  ?"#b91c1c":
    type==="warning"?"#a16207":"#0369a1";
  el.style.borderColor =
    type==="success"?"#bbf7d0":
    type==="error"  ?"#fecaca":
    type==="warning"?"#fef08a":"#bae6fd";
}

function setScanStatus(text, type) {
  const el = document.getElementById("scanStatus");
  if (!el) return;
  el.textContent      = text;
  el.style.background =
    type==="success"?"#dcfce7":
    type==="error"  ?"#fee2e2":
    type==="warning"?"#fef9c3":"#e0f2fe";
  el.style.color =
    type==="success"?"#15803d":
    type==="error"  ?"#b91c1c":
    type==="warning"?"#a16207":"#0369a1";
  el.style.borderColor =
    type==="success"?"#bbf7d0":
    type==="error"  ?"#fecaca":
    type==="warning"?"#fef08a":"#bae6fd";
}

function showAdminMsg(el, text, color) {
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
// DEALER INCONVENIENCE — Submit notice to officer
// ══════════════════════════════════════════════════════════════

// Submit dealer inconvenience report
async function submitDealerNotice() {
  const date       = document.getElementById("noticeDate")?.value;
  const reason     = document.getElementById("noticeReason")?.value;
  const message    = document.getElementById("noticeMessage")?.value.trim();
  const reopenDate = document.getElementById("noticeReopenDate")?.value;
  const msg        = document.getElementById("noticeSubmitMsg");

  if (!date) {
    showAdminMsg(msg, "⚠️ Select the date of issue.", "red");
    return;
  }
  if (!reason) {
    showAdminMsg(msg, "⚠️ Select a reason.", "red");
    return;
  }
  if (!message) {
    showAdminMsg(msg,
      "⚠️ Write a message for the officer.", "red");
    return;
  }

  const btn = document.querySelector(
    "#inconvenienceTab button[onclick='submitDealerNotice()']"
  );
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Sending..."; }

  const fullMessage = reopenDate
    ? `${message} Expected reopen: ${reopenDate}`
    : message;

  const { error } = await db.from("dealer_notices").insert([{
    dealer_id:   currentDealer.dealer_id,
    shop_name:   currentDealer.shop_name,
    locality:    currentDealer.locality,
    notice_date: date,
    reason,
    message:     fullMessage,
    status:      "pending",
    is_published: false
  }]);

  if (btn) {
    btn.disabled    = false;
    btn.textContent = "📤 Send Report to Supply Officer";
  }

  if (error) {
    showAdminMsg(msg, "❌ " + error.message, "red"); return;
  }

  showAdminMsg(msg,
    "✅ Report sent to Supply Officer! " +
    "They will review and publish a notice to all citizens.",
    "green");

  // Clear form
  document.getElementById("noticeReason").value  = "";
  document.getElementById("noticeMessage").value = "";

  loadMyDealerNotices();
}

// Load dealer's own notices
async function loadMyDealerNotices() {
  const list = document.getElementById("myNoticesList");
  if (!list) return;

  list.innerHTML = `
    <p style="color:#888;text-align:center;padding:20px">
      ⏳ Loading...
    </p>`;

  const { data: notices } = await db
    .from("dealer_notices")
    .select("*")
    .eq("dealer_id", currentDealer.dealer_id)
    .order("created_at", { ascending: false });

  if (!notices || notices.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:30px;color:#888">
        <div style="font-size:40px;margin-bottom:10px">📋</div>
        <div style="font-size:14px;font-weight:bold">
          No Reports Submitted
        </div>
        <div style="font-size:12px;margin-top:6px">
          Submit your first inconvenience report above
        </div>
      </div>`;
    return;
  }

  const statusColors = {
    pending:  { bg:"#fff3e0", color:"#a16207",
                border:"#fde68a", text:"⏳ Pending Review" },
    reviewed: { bg:"#eff6ff", color:"#1565c0",
                border:"#bfdbfe", text:"🔍 Reviewed by Officer" },
    published:{ bg:"#dcfce7", color:"#15803d",
                border:"#bbf7d0", text:"✅ Published to Citizens" },
    rejected: { bg:"#fee2e2", color:"#b91c1c",
                border:"#fca5a5", text:"❌ Rejected" }
  };

  list.innerHTML = notices.map(n => {
    const s      = statusColors[n.status] || statusColors.pending;
    const dateFmt = new Date(n.notice_date + "T00:00:00")
      .toLocaleDateString("en-IN", {
        weekday:"long", day:"2-digit",
        month:"long", year:"numeric"
      });
    const submittedAt = new Date(n.created_at)
      .toLocaleDateString("en-IN", {
        day:"2-digit", month:"short", year:"numeric",
        hour:"2-digit", minute:"2-digit"
      });

    return `
      <div style="border:1px solid ${s.border};
                  border-radius:12px;overflow:hidden;
                  margin-bottom:12px">

        <!-- Notice Header -->
        <div style="background:${s.bg};padding:12px 16px;
                    border-bottom:1px solid ${s.border};
                    display:flex;justify-content:space-between;
                    align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:13px;font-weight:bold;
                        color:${s.color}">
              ${s.text}
            </div>
            <div style="font-size:11px;color:#888;
                        margin-top:2px">
              Submitted: ${submittedAt}
            </div>
          </div>
          <div style="font-size:12px;font-weight:bold;
                      color:#333">
            📅 ${dateFmt}
          </div>
        </div>

        <!-- Notice Body -->
        <div style="padding:14px 16px;background:white">
          <div style="font-size:13px;font-weight:bold;
                      color:#333;margin-bottom:6px">
            📋 ${n.reason}
          </div>
          <div style="font-size:12px;color:#555;
                      background:#f9fafb;
                      border-radius:8px;padding:10px;
                      line-height:1.6;margin-bottom:10px">
            💬 ${n.message}
          </div>
          ${n.officer_note ? `
          <div style="font-size:12px;color:#1565c0;
                      background:#eff6ff;
                      border:1px solid #bfdbfe;
                      border-radius:8px;padding:10px;
                      line-height:1.6">
            👮 Officer's Note: ${n.officer_note}
          </div>` : ""}
          ${n.is_published ? `
          <div style="margin-top:10px;font-size:11px;
                      color:#15803d;background:#f0fdf4;
                      padding:8px 12px;border-radius:6px;
                      font-weight:bold">
            📢 This notice has been published to all
            citizen dashboards ✅
          </div>` : ""}
        </div>
      </div>`;
  }).join("");
}

// ══════════════════════════════════════════════════════════════
// DEALER INCONVENIENCE — Report to Supply Officer
// ══════════════════════════════════════════════════════════════

async function submitInconvenience() {
  const date    = document.getElementById("inconvDate")?.value;
  const reason  = document.getElementById("inconvReason")?.value;
  const message = document.getElementById("inconvMessage")
                    ?.value.trim();
  const msg     = document.getElementById("inconvMsg");

  if (!date) {
    showAdminMsg(msg, "⚠️ Please select the affected date.", "red");
    return;
  }
  if (!reason) {
    showAdminMsg(msg, "⚠️ Please select a reason.", "red");
    return;
  }
  if (!message) {
    showAdminMsg(msg,
      "⚠️ Please enter a message for the officer and citizens.",
      "red");
    return;
  }

  const btn = document.querySelector(
    "#inconvenienceTab .request-form button"
  );
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Sending..."; }

  const { error } = await db
    .from("dealer_inconvenience")
    .insert([{
      dealer_id:   currentDealer.dealer_id,
      shop_name:   currentDealer.shop_name,
      locality:    currentDealer.locality,
      reason,
      message,
      affect_date: date,
      status:      "pending"
    }]);

  if (btn) { btn.disabled = false; btn.textContent = "📤 Send Report to Supply Officer"; }

  if (error) {
    showAdminMsg(msg, "❌ " + error.message, "red");
    return;
  }

  showAdminMsg(msg,
    "✅ Report sent to Supply Officer! " +
    "They will review and notify citizens if approved.",
    "green");

  // Clear form
  document.getElementById("inconvDate").value    = "";
  document.getElementById("inconvReason").value  = "";
  document.getElementById("inconvMessage").value = "";

  // Reload list
  loadMyInconveniences();
}

// ── Load my inconvenience reports ─────────────────────────────
async function loadMyInconveniences() {
  const list = document.getElementById("myInconvList");
  if (!list) return;

  list.innerHTML = `<p style="color:#888;text-align:center;
    padding:20px">⏳ Loading...</p>`;

  const { data: reports } = await db
    .from("dealer_inconvenience")
    .select("*")
    .eq("dealer_id", currentDealer.dealer_id)
    .order("created_at", { ascending: false });

  if (!reports || reports.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:30px;color:#888">
        <div style="font-size:36px;margin-bottom:8px">📋</div>
        <div style="font-size:13px">No reports submitted yet</div>
      </div>`;
    return;
  }

  list.innerHTML = reports.map(r => {
    const statusMap = {
      pending:  { bg:"#fff3e0", color:"#a16207",
                  border:"#fde68a", label:"⏳ Pending Review" },
      approved: { bg:"#dcfce7", color:"#15803d",
                  border:"#bbf7d0", label:"✅ Approved — Notice Sent" },
      rejected: { bg:"#fee2e2", color:"#b91c1c",
                  border:"#fca5a5", label:"❌ Rejected by Officer" }
    };
    const s      = statusMap[r.status] || statusMap.pending;
    const dateFmt = new Date(r.affect_date + "T00:00:00")
      .toLocaleDateString("en-IN", {
        weekday:"long", day:"2-digit",
        month:"long", year:"numeric"
      });
    const created = new Date(r.created_at)
      .toLocaleDateString("en-IN", {
        day:"2-digit", month:"short", year:"numeric"
      });

    return `
      <div style="border:1.5px solid ${s.border};
                  border-radius:12px;overflow:hidden;
                  margin-bottom:12px">
        <div style="background:${s.bg};padding:12px 16px;
                    display:flex;justify-content:space-between;
                    align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:13px;font-weight:bold;
                        color:${s.color}">
              ${r.reason}
            </div>
            <div style="font-size:11px;color:#666;
                        margin-top:2px">
              📅 Affects: ${dateFmt}
            </div>
          </div>
          <div style="background:${s.color};color:white;
                      padding:4px 12px;border-radius:20px;
                      font-size:12px;font-weight:bold">
            ${s.label}
          </div>
        </div>
        <div style="padding:12px 16px;background:white;
                    font-size:12px">
          <div style="color:#555;margin-bottom:6px">
            💬 <strong>Your message:</strong> ${r.message}
          </div>
          ${r.officer_note
            ? `<div style="color:#1565c0;margin-bottom:6px">
                 👮 <strong>Officer note:</strong>
                 ${r.officer_note}
               </div>`
            : ""}
          <div style="color:#888;font-size:11px">
            Submitted: ${created}
            ${r.reviewed_by
              ? ` | Reviewed by: ${r.reviewed_by}`
              : ""}
          </div>
        </div>
      </div>`;
  }).join("");
}