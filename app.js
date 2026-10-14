// ══════════════════════════════════════════════════════════════
//   SMART RATION HUB 2026 — app.js
//   CITIZEN PORTAL — Complete Fixed Version
//   ALL functions are GLOBAL (outside DOMContentLoaded)
//   So showDashTab can call them from onclick in HTML
// ══════════════════════════════════════════════════════════════

// ── SUPABASE ──────────────────────────────────────────────────
const SUPABASE_URL = "https://znwpouhmbukhttsccgzd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpud3BvdWhtYnVraHR0c2NjZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MDY4NzEsImV4cCI6MjA5OTk4Mjg3MX0.ODBpp43FrasZp1006uzLXNiy_5TYjIWS_S8ILQv7J8s";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── GLOBAL STATE ──────────────────────────────────────────────
let currentRationCard  = "";
let currentUserData    = null;
let currentUserOTP     = ""; // Login OTP reused at dealer collection
let loginOTP           = "";
let loginOTPTimer      = null;
let loginOTPAttempts   = 0;
const MAX_OTP_ATTEMPTS = 3;

// ── RATION DATA ───────────────────────────────────────────────
const RATIONS = {
  APL:{ rice:5,  wheat:3,  sugar:1  },
  BPL:{ rice:10, wheat:7,  sugar:2  },
  AAY:{ rice:15, wheat:10, sugar:3  },
  PHH:{ rice:10, wheat:7,  sugar:2  }
};
const PRICES = {
  APL:{ rice:10, wheat:8,  sugar:15 },
  BPL:{ rice:3,  wheat:2,  sugar:13 },
  AAY:{ rice:2,  wheat:2,  sugar:13 },
  PHH:{ rice:3,  wheat:2,  sugar:13 }
};
const MARKET_PRICES = { rice:45, wheat:40, sugar:50 };
const CATEGORY_INFO = {
  APL:{
    name:"APL — Above Poverty Line",
    color:"#1e40af", bg:"#dbeafe", icon:"🔵",
    desc:"Families above poverty line. Subsidized food grains at reduced government rates."
  },
  BPL:{
    name:"BPL — Below Poverty Line",
    color:"#b91c1c", bg:"#fee2e2", icon:"🔴",
    desc:"Families below poverty line. Higher quantities at heavily subsidized rates."
  },
  AAY:{
    name:"AAY — Antyodaya Anna Yojana",
    color:"#a16207", bg:"#fef9c3", icon:"🟡",
    desc:"Poorest of the poor. Highest quantity at lowest prices under NFSA."
  },
  PHH:{
    name:"PHH — Priority Household",
    color:"#15803d", bg:"#dcfce7", icon:"🟢",
    desc:"Priority household families. Subsidized quantities under government scheme."
  }
};

// ══════════════════════════════════════════════════════════════
// ✅ ALL FUNCTIONS BELOW ARE GLOBAL
//    They are NOT inside DOMContentLoaded
//    So they work when called from onclick and showDashTab
// ══════════════════════════════════════════════════════════════

// ── Show Page ─────────────────────────────────────────────────
function showPage(pageId) {
  ["landingPage","registerPage","loginPage","dashboardPage"]
  .forEach(p => {
    const el = document.getElementById(p);
    if (el) el.style.display = "none";
  });
  const t = document.getElementById(pageId);
  if (t) t.style.display = "block";
}

// ── Show Dashboard Tab ────────────────────────────────────────
function showDashTab(tabId) {
  ["stockTab","membersTab","tokenTab",
   "entitlementTab","billsTab","reportTab"]
  .forEach(t => {
    const el = document.getElementById(t);
    if (el) el.style.display = "none";
  });
  document.querySelectorAll(".dash-tab").forEach(b => {
    b.classList.remove("active");
  });
  const target = document.getElementById(tabId);
  if (target) target.style.display = "block";
  const btn = document.getElementById("tab-"+tabId);
  if (btn) btn.classList.add("active");
  // Load data for each tab
  if (tabId === "stockTab")        loadDashStock();
  if (tabId === "membersTab")      loadDashMembers();
  if (tabId === "tokenTab") {
    checkMyToken();
    loadShops(); // Always refresh to show latest closed status
  }
  if (tabId === "entitlementTab")  loadEntitlement();
}

// ── Photo Preview ─────────────────────────────────────────────
function previewMemberPhoto(input, idx) {
  const preview = document.getElementById("preview_"+idx);
  if (!preview||!input.files||!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.innerHTML = `
      <div style="text-align:center;margin-top:8px">
        <img src="${e.target.result}"
             style="width:80px;height:80px;border-radius:50%;
                    object-fit:cover;border:3px solid #2e7d32"/>
        <p style="font-size:11px;color:#2e7d32;margin-top:4px">
          ✅ Photo selected
        </p>
      </div>`;
  };
  reader.readAsDataURL(input.files[0]);
}

// ── Open Member Detail ────────────────────────────────────────
function openMemberDetails(m) {
  document.getElementById("modalContent").innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      ${m.photo_url
        ? `<img src="${m.photo_url}"
                style="width:110px;height:110px;
                       border-radius:50%;object-fit:cover;
                       border:3px solid #2e7d32"/>`
        : `<div style="width:110px;height:110px;
                       border-radius:50%;background:#e8f5e9;
                       display:flex;align-items:center;
                       justify-content:center;
                       font-size:44px;margin:0 auto">👤</div>`}
    </div>
    <p><strong>Name:</strong> ${m.name}</p>
    <p style="margin-top:8px">
      <strong>Relationship:</strong> ${m.relation}
    </p>
    <p style="margin-top:8px">
      <strong>Aadhaar:</strong> ${m.aadhaar}
    </p>
    <p style="margin-top:8px">
      <strong>Photo Status:</strong>
      ${m.photo_url
        ? `<span style="color:#15803d">
             ✅ Uploaded — Dealer will scan at collection
           </span>`
        : `<span style="color:#c62828">
             ❌ Not uploaded — Face scan may fail
           </span>`}
    </p>`;
  document.getElementById("memberModal").style.display  = "block";
  document.getElementById("modalOverlay").style.display = "block";
}

// ══════════════════════════════════════════════════════════════
// 1. STOCK BOARD
// ══════════════════════════════════════════════════════════════
const STOCK_IMAGES = {
  Rice:"images/rice.webp",
  Wheat:"images/wheat.webp",
  Sugar:"images/sugar.webp"
};
const STOCK_COLORS = {
  Rice:"#16a34a",Wheat:"#d97706",Sugar:"#9333ea"
};
const STOCK_BACKUP = {
  Rice:"https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/White_rice.jpg/320px-White_rice.jpg",
  Wheat:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Wheat_close-up.JPG/320px-Wheat_close-up.JPG",
  Sugar:"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Sugar_2xmacro.jpg/320px-Sugar_2xmacro.jpg"
};

function renderStockCards(data, gridId, updatedId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = "";

  // Filter only active items
  const activeItems = (data || []).filter(
    i => i.is_active !== false
  );

  if (activeItems.length === 0) {
    grid.innerHTML =
      `<p class="stock-loading">No stock data available.</p>`;
    return;
  }

  // ── Icon map for any commodity ──────────────────────────
  const iconMap = {
    rice:"🌾", wheat:"🌿", sugar:"🍬",
    kerosene:"🛢️", oil:"🫙", dal:"🫘",
    pulses:"🫘", salt:"🧂", flour:"🌾",
    maize:"🌽", tea:"🍵", soap:"🧼",
    millets:"🌾", jowar:"🌾", bajra:"🌾"
  };
  function getIcon(name) {
    const lower = (name || "").toLowerCase();
    for (const [k, v] of Object.entries(iconMap)) {
      if (lower.includes(k)) return v;
    }
    return "📦";
  }

  // ── Default images for Rice/Wheat/Sugar ──────────────────
  const DEFAULT_IMGS = {
    Rice:  "images/rice.webp",
    Wheat: "images/wheat.webp",
    Sugar: "images/sugar.webp"
  };
  const BACKUP_IMGS = {
    Rice:  "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/White_rice.jpg/320px-White_rice.jpg",
    Wheat: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Wheat_close-up.JPG/320px-Wheat_close-up.JPG",
    Sugar: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Sugar_2xmacro.jpg/320px-Sugar_2xmacro.jpg"
  };
  const COLORS = {
    Rice:"#16a34a", Wheat:"#d97706", Sugar:"#9333ea"
  };

  activeItems.forEach(item => {
    const name      = item.item || "Unknown";
    const kg        = parseFloat(item.available_kg || 0);
    const unit      = item.unit       || "kg";
    const govtPrice = parseFloat(item.govt_price   || 0);
    const mktPrice  = parseFloat(item.market_price || 0);
    const desc      = item.description || "";
    const icon      = getIcon(name);
    const color     = COLORS[name] || "#16a34a";

    // ── Pick image ──────────────────────────────────────
    // Priority: uploaded photo_url → default image → placeholder
    let imgSrc = "";
    if (item.photo_url && item.photo_url.trim() !== "") {
      imgSrc = item.photo_url.trim();
    } else if (DEFAULT_IMGS[name]) {
      imgSrc = DEFAULT_IMGS[name];
    } else {
      imgSrc = "";  // Will show icon instead
    }

    const backupSrc = BACKUP_IMGS[name] ||
      DEFAULT_IMGS[name] || "";

    // ── Progress bar ────────────────────────────────────
    const maxKg  = Math.max(kg, 50);
    const pct    = Math.min((kg / maxKg) * 100, 100)
                     .toFixed(0);

    // ── Status ──────────────────────────────────────────
    let badge = "", kgColor = "";
    if (kg >= 20) {
      badge   = `<span class="stock-badge badge-green">
                   ✅ Good
                 </span>`;
      kgColor = "#15803d";
    } else if (kg >= 10) {
      badge   = `<span class="stock-badge badge-yellow">
                   ⚠️ Low
                 </span>`;
      kgColor = "#a16207";
    } else {
      badge   = `<span class="stock-badge badge-red">
                   🔴 Critical
                 </span>`;
      kgColor = "#b91c1c";
    }

    // ── Savings ─────────────────────────────────────────
    const savePct = mktPrice > 0 && govtPrice > 0
      ? Math.round(((mktPrice-govtPrice)/mktPrice)*100)
      : 0;

    // ── Build card ──────────────────────────────────────
    const card       = document.createElement("div");
    card.className   = "stock-card";
    card.style.cssText = `
      background: white;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;`;

    // Photo section
    const photoHTML = imgSrc
      ? `<div class="stock-photo"
              style="height:120px;overflow:hidden;
                     background:#f0fdf4;
                     display:flex;align-items:center;
                     justify-content:center">
           <img src="${imgSrc}"
                alt="${name}"
                style="width:100%;height:120px;
                       object-fit:cover;display:block"
                onerror="this.style.display='none';
                  this.parentElement.innerHTML=
                  '<div style=\"font-size:48px;\">
                  ${icon}</div>';"/>
         </div>`
      : `<div style="height:120px;background:#f0fdf4;
                     display:flex;align-items:center;
                     justify-content:center;
                     font-size:52px">
           ${icon}
         </div>`;

    card.innerHTML = `
      ${photoHTML}
      <div class="stock-card-info"
           style="padding:12px;flex:1;
                  display:flex;flex-direction:column;
                  gap:6px">

        <!-- Name -->
        <div class="stock-card-name"
             style="font-size:15px;font-weight:bold;
                    color:#1b5e20">
          ${icon} ${name}
        </div>

        ${desc
          ? `<div style="font-size:11px;color:#888;
                         margin-top:-2px">
               ${desc}
             </div>`
          : ""}

        <!-- Qty -->
        <div class="stock-kg-row"
             style="display:flex;justify-content:space-between;
                    align-items:center">
          <span class="stock-kg-label"
                style="font-size:12px;color:#888">
            Available
          </span>
          <span class="stock-kg-number"
                style="font-size:16px;font-weight:bold;
                       color:${kgColor}">
            ${kg} ${unit}
          </span>
        </div>

        <!-- Progress Bar -->
        <div class="stock-bar-track"
             style="background:#e5e7eb;border-radius:20px;
                    height:8px;overflow:hidden">
          <div class="stock-bar-fill"
               style="width:${pct}%;height:100%;
                      background:${color};
                      border-radius:20px;
                      transition:width 0.5s ease">
          </div>
        </div>

        <!-- Status Badge -->
        ${badge}

        <!-- Price Info -->
        ${govtPrice > 0 ? `
        <div style="display:flex;justify-content:space-between;
                    align-items:center;
                    padding-top:6px;
                    border-top:1px solid #f0f0f0;
                    margin-top:2px">
          <div>
            <span style="color:#15803d;font-weight:bold;
                         font-size:12px">
              ₹${govtPrice}/${unit}
            </span>
            <span style="color:#bbb;font-size:10px;
                         text-decoration:line-through;
                         margin-left:5px">
              ₹${mktPrice}/${unit}
            </span>
          </div>
          ${savePct > 0
            ? `<span style="background:#dcfce7;
                            color:#15803d;
                            padding:2px 8px;
                            border-radius:10px;
                            font-size:10px;
                            font-weight:bold">
                 Save ${savePct}%
               </span>`
            : ""}
        </div>` : ""}
      </div>`;

    grid.appendChild(card);
  });

  // Update timestamp
  const t = document.getElementById(updatedId);
  if (t) t.textContent =
    `🕐 Updated: ${new Date().toLocaleTimeString()}`;
}


async function fetchLiveStockBoard() {
  const grid = document.getElementById("stockGrid");
  if (!grid) return;
  grid.innerHTML =
    `<p class="stock-loading">⏳ Loading stock...</p>`;
  try {
    const { data,error } = await db.from("stock").select("*");
    if (error) throw error;
    renderStockCards(data,"stockGrid","stockUpdated");
  } catch(err) {
    const g = document.getElementById("stockGrid");
    if (g) g.innerHTML =
      `<p class="stock-loading" style="color:red">
         ❌ ${err.message}</p>`;
  }
}

async function loadDashStock() {
  const grid = document.getElementById("dashStockGrid");
  if (!grid) return;
  grid.innerHTML =
    `<p class="stock-loading">⏳ Loading...</p>`;
  try {
    const { data,error } = await db.from("stock").select("*");
    if (error) throw error;
    renderStockCards(data,"dashStockGrid","dashStockUpdated");
  } catch(err) {
    const g = document.getElementById("dashStockGrid");
    if (g) g.innerHTML =
      `<p class="stock-loading" style="color:red">
         ❌ ${err.message}</p>`;
  }
}

// ══════════════════════════════════════════════════════════════
// 2. ENTITLEMENT TAB — VIEW ONLY
//    Shows maximum entitled quantities per category + members
//    Shows clear per-member quantities + total payable amount
//    NO bill here — actual bill generated by dealer at shop
// ══════════════════════════════════════════════════════════════
async function loadEntitlement() {
  if (!currentUserData) return;

  const category  = currentUserData.category || "BPL";
  const r         = RATIONS[category]  || RATIONS.BPL;
  const p         = PRICES[category]   || PRICES.BPL;
  const catInfo   = CATEGORY_INFO[category] || CATEGORY_INFO.BPL;

  // Fetch family members
  const { data: members } = await db
    .from("family_members").select("*")
    .eq("ration_card", currentRationCard);
  const memberCount = members ? members.length : 1;

  // Max quantities
  const riceTotal  = r.rice  * memberCount;
  const wheatTotal = r.wheat * memberCount;
  const sugarTotal = r.sugar * memberCount;
  const totalQty   = riceTotal + wheatTotal + sugarTotal;

  // Max costs
  const riceCost   = riceTotal  * p.rice;
  const wheatCost  = wheatTotal * p.wheat;
  const sugarCost  = sugarTotal * p.sugar;
  const totalCost  = riceCost + wheatCost + sugarCost;

  // Market comparison
  const mRice    = riceTotal  * MARKET_PRICES.rice;
  const mWheat   = wheatTotal * MARKET_PRICES.wheat;
  const mSugar   = sugarTotal * MARKET_PRICES.sugar;
  const mTotal   = mRice + mWheat + mSugar;
  const savings  = mTotal - totalCost;

  // ── 1. Category Banner ─────────────────────────────────────
  const banner = document.getElementById("entitlementCategoryBanner");
  if (banner) {
    banner.innerHTML = `
      <!-- View Only Notice -->
      <div style="background:#fff3e0;border:1px solid #fde68a;
                  border-radius:10px;padding:12px 16px;
                  margin-bottom:14px;
                  display:flex;align-items:center;gap:10px">
        <div style="font-size:22px;flex-shrink:0">ℹ️</div>
        <div>
          <div style="font-size:13px;font-weight:bold;
                      color:#a16207">
            📋 View Only — Your Maximum Entitlement
          </div>
          <div style="font-size:11px;color:#555;
                      margin-top:2px;line-height:1.6">
            These are your <strong>maximum allowed quantities</strong>
            per month based on family size and card category.
            Actual quantities and bill are decided at the shop by the dealer.
            View your actual bills in <strong>📄 My Bills</strong> tab.
          </div>
        </div>
      </div>

      <!-- Category Banner -->
      <div style="background:${catInfo.bg};
                  border:2px solid ${catInfo.color};
                  border-radius:12px;padding:16px 20px;
                  margin-bottom:14px;
                  display:flex;align-items:center;gap:16px">
        <div style="font-size:44px;flex-shrink:0">${catInfo.icon}</div>
        <div>
          <div style="font-size:15px;font-weight:bold;
                      color:${catInfo.color};margin-bottom:4px">
            ${catInfo.name}
          </div>
          <div style="font-size:12px;color:#555;margin-bottom:2px">
            🪪 Ration Card: <strong>${currentRationCard}</strong>
          </div>
          <div style="font-size:11px;color:#666;line-height:1.5">
            ${catInfo.desc}
          </div>
        </div>
      </div>`;
  }

  // ── 2. Stats Row ────────────────────────────────────────────
  const membersBox = document.getElementById("entitlementMembersBox");
  if (membersBox) {
    membersBox.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);
                  gap:10px;margin-bottom:14px">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                    border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:28px;font-weight:bold;
                      color:#15803d">${memberCount}</div>
          <div style="font-size:11px;color:#888;margin-top:3px">
            👥 Family Members
          </div>
        </div>
        <div style="background:${catInfo.bg};
                    border:1px solid ${catInfo.color}44;
                    border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:28px;font-weight:bold;
                      color:${catInfo.color}">${category}</div>
          <div style="font-size:11px;color:#888;margin-top:3px">
            🪪 Card Category
          </div>
        </div>
        <div style="background:#fefce8;border:1px solid #fde68a;
                    border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:28px;font-weight:bold;
                      color:#a16207">${totalQty}kg</div>
          <div style="font-size:11px;color:#888;margin-top:3px">
            📦 Max/Month
          </div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                    border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:28px;font-weight:bold;
                      color:#15803d">₹${totalCost}</div>
          <div style="font-size:11px;color:#888;margin-top:3px">
            💰 Max Payable
          </div>
        </div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                  border-radius:8px;padding:9px 14px;
                  font-size:12px;color:#15803d;
                  margin-bottom:14px;text-align:center">
        📊 Per member:
        <strong>${r.rice}kg Rice</strong> +
        <strong>${r.wheat}kg Wheat</strong> +
        <strong>${r.sugar}kg Sugar</strong>
        × <strong>${memberCount} member(s)</strong>
        = <strong>${totalQty}kg maximum per month</strong>
      </div>`;
  }

  // ── 3. Food Grain Cards ──────────────────────────────────────
  const grainsGrid = document.getElementById("entitlementGrainsGrid");
  if (grainsGrid) {
    const grains = [
      {
        name:"Rice",  icon:"🌾", img:"images/rice.webp",
        perMember:r.rice,  total:riceTotal,
        govtPrice:p.rice,  marketPrice:MARKET_PRICES.rice,
        totalCost:riceCost,
        color:"#15803d", bg:"#f0fdf4", border:"#bbf7d0"
      },
      {
        name:"Wheat", icon:"🌿", img:"images/wheat.webp",
        perMember:r.wheat, total:wheatTotal,
        govtPrice:p.wheat, marketPrice:MARKET_PRICES.wheat,
        totalCost:wheatCost,
        color:"#a16207", bg:"#fefce8", border:"#fde68a"
      },
      {
        name:"Sugar", icon:"🍬", img:"images/sugar.webp",
        perMember:r.sugar, total:sugarTotal,
        govtPrice:p.sugar, marketPrice:MARKET_PRICES.sugar,
        totalCost:sugarCost,
        color:"#7e22ce", bg:"#faf5ff", border:"#e9d5ff"
      }
    ];

    grainsGrid.innerHTML = `
      <h3 style="color:#1b5e20;margin-bottom:12px;font-size:15px;
                 font-weight:bold">
        🌾 Maximum Monthly Entitlement — Per Member & Total
      </h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);
                  gap:14px;margin-bottom:20px">
        ${grains.map(g => {
          const savePct = Math.round(
            ((g.marketPrice - g.govtPrice) / g.marketPrice) * 100
          );
          const savedAmt = (g.marketPrice - g.govtPrice) * g.total;
          return `
            <div style="background:${g.bg};
                        border:2px solid ${g.border};
                        border-radius:14px;overflow:hidden;
                        box-shadow:0 2px 10px rgba(0,0,0,0.07)">

              <!-- Card Header -->
              <div style="padding:12px 14px;background:white;
                          border-bottom:1px solid ${g.border};
                          display:flex;align-items:center;gap:10px">
                <img src="${g.img}" alt="${g.name}"
                     style="width:42px;height:42px;border-radius:8px;
                            object-fit:cover"
                     onerror="this.style.display='none'"/>
                <div style="font-size:16px;font-weight:bold;
                            color:${g.color}">
                  ${g.icon} ${g.name}
                </div>
              </div>

              <!-- Card Body -->
              <div style="padding:12px 14px">

                <!-- Per Member -->
                <div style="display:flex;justify-content:space-between;
                            padding:6px 0;font-size:12px;
                            border-bottom:1px solid ${g.border}">
                  <span style="color:#888">Per Member</span>
                  <strong style="color:#333">${g.perMember} kg</strong>
                </div>

                <!-- Total for Family -->
                <div style="display:flex;justify-content:space-between;
                            padding:6px 0;font-size:14px;
                            border-bottom:1px solid ${g.border}">
                  <span style="color:#888">
                    Max (${memberCount} members)
                  </span>
                  <strong style="color:${g.color};font-size:16px">
                    ${g.total} kg
                  </strong>
                </div>

                <!-- Govt Price -->
                <div style="display:flex;justify-content:space-between;
                            padding:6px 0;font-size:12px;
                            border-bottom:1px solid ${g.border}">
                  <span style="color:#888">Govt. Price</span>
                  <strong style="color:#15803d">
                    ₹${g.govtPrice}/kg
                  </strong>
                </div>

                <!-- Market Price -->
                <div style="display:flex;justify-content:space-between;
                            padding:6px 0;font-size:12px;
                            border-bottom:1px solid ${g.border}">
                  <span style="color:#888">Market Price</span>
                  <strong style="color:#aaa;
                                 text-decoration:line-through">
                    ₹${g.marketPrice}/kg
                  </strong>
                </div>

                <!-- Max Payable -->
                <div style="display:flex;justify-content:space-between;
                            padding:8px 0;font-size:13px;
                            border-bottom:1px solid ${g.border}">
                  <strong style="color:#555">Max You Pay</strong>
                  <strong style="color:${g.color};font-size:18px">
                    ₹${g.totalCost}
                  </strong>
                </div>

                <!-- Market Value -->
                <div style="display:flex;justify-content:space-between;
                            padding:6px 0;font-size:12px">
                  <span style="color:#888">Market Value</span>
                  <strong style="color:#aaa">
                    ₹${g.marketPrice * g.total}
                  </strong>
                </div>

                <!-- Save Badge -->
                <div style="background:${g.color};color:white;
                            font-size:11px;font-weight:bold;
                            padding:7px;border-radius:8px;
                            text-align:center;margin-top:10px">
                  🎉 Save ${savePct}% — ₹${savedAmt} vs Market
                </div>
              </div>
            </div>`;
        }).join("")}
      </div>`;
  }

  // ── 4. Maximum Payable Amount Box ───────────────────────────
  const totalBox = document.getElementById("entitlementTotalBox");
  if (totalBox) {
    totalBox.innerHTML = `

      <!-- Big Summary Box -->
      <div style="border:2px solid #2e7d32;border-radius:14px;
                  overflow:hidden;margin-bottom:14px;
                  box-shadow:0 4px 16px rgba(0,0,0,0.08)">

        <!-- Header -->
        <div style="background:#1b5e20;padding:12px 18px;
                    color:white;display:flex;
                    justify-content:space-between;
                    align-items:center">
          <div style="font-size:14px;font-weight:bold">
            💰 Maximum Payable Amount Summary
          </div>
          <div style="font-size:11px;opacity:0.85">
            ${category} Card | ${memberCount} Member(s)
          </div>
        </div>

        <!-- Per-Member Breakdown Header -->
        <div style="background:#e8f5e9;padding:10px 18px;
                    font-size:12px;color:#1b5e20;font-weight:bold;
                    border-bottom:1px solid #c8e6c9">
          📊 Per Member Entitlement:
          ${r.rice}kg Rice + ${r.wheat}kg Wheat +
          ${r.sugar}kg Sugar =
          ${r.rice + r.wheat + r.sugar}kg/member/month
        </div>

        <!-- Item Rows -->
        <!-- Rice -->
        <div style="padding:14px 18px;
                    border-bottom:1px solid #f0f0f0;
                    display:flex;align-items:center;gap:12px">
          <img src="images/rice.webp"
               style="width:36px;height:36px;border-radius:8px;
                      object-fit:cover;flex-shrink:0"
               onerror="this.style.display='none'"/>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:bold;color:#333">
              🌾 Rice
            </div>
            <div style="font-size:11px;color:#888;margin-top:2px">
              ${r.rice}kg × ${memberCount} members × ₹${p.rice}/kg
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:bold;
                        color:#15803d">
              ₹${riceCost}
            </div>
            <div style="font-size:10px;color:#aaa;
                        text-decoration:line-through">
              Market: ₹${mRice}
            </div>
          </div>
        </div>

        <!-- Wheat -->
        <div style="padding:14px 18px;
                    border-bottom:1px solid #f0f0f0;
                    display:flex;align-items:center;gap:12px;
                    background:#fafafa">
          <img src="images/wheat.webp"
               style="width:36px;height:36px;border-radius:8px;
                      object-fit:cover;flex-shrink:0"
               onerror="this.style.display='none'"/>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:bold;color:#333">
              🌿 Wheat
            </div>
            <div style="font-size:11px;color:#888;margin-top:2px">
              ${r.wheat}kg × ${memberCount} members × ₹${p.wheat}/kg
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:bold;
                        color:#a16207">
              ₹${wheatCost}
            </div>
            <div style="font-size:10px;color:#aaa;
                        text-decoration:line-through">
              Market: ₹${mWheat}
            </div>
          </div>
        </div>

        <!-- Sugar -->
        <div style="padding:14px 18px;
                    border-bottom:2px solid #e5e7eb;
                    display:flex;align-items:center;gap:12px">
          <img src="images/sugar.webp"
               style="width:36px;height:36px;border-radius:8px;
                      object-fit:cover;flex-shrink:0"
               onerror="this.style.display='none'"/>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:bold;color:#333">
              🍬 Sugar
            </div>
            <div style="font-size:11px;color:#888;margin-top:2px">
              ${r.sugar}kg × ${memberCount} members × ₹${p.sugar}/kg
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:bold;
                        color:#7e22ce">
              ₹${sugarCost}
            </div>
            <div style="font-size:10px;color:#aaa;
                        text-decoration:line-through">
              Market: ₹${mSugar}
            </div>
          </div>
        </div>

        <!-- Total Qty -->
        <div style="padding:12px 18px;
                    border-bottom:1px solid #f0f0f0;
                    display:flex;justify-content:space-between;
                    align-items:center;background:#f9fafb">
          <span style="font-size:13px;color:#555">
            📦 Total Quantity
          </span>
          <strong style="color:#1b5e20;font-size:15px">
            ${totalQty} kg / month
          </strong>
        </div>

        <!-- Market Value -->
        <div style="padding:12px 18px;
                    border-bottom:1px solid #f0f0f0;
                    display:flex;justify-content:space-between;
                    align-items:center">
          <span style="font-size:13px;color:#888">
            🏪 Market Value (if bought outside)
          </span>
          <strong style="color:#aaa;font-size:15px;
                         text-decoration:line-through">
            ₹${mTotal} / month
          </strong>
        </div>

        <!-- MAX PAYABLE — BIG ROW -->
        <div style="padding:18px;
                    background:linear-gradient(135deg,
                      #1b5e20,#2e7d32);
                    display:flex;justify-content:space-between;
                    align-items:center">
          <div>
            <div style="font-size:15px;font-weight:bold;
                        color:white">
              💰 Maximum Amount You Pay
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,0.8);
                        margin-top:3px">
              If you collect full entitlement every month
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:30px;font-weight:bold;
                        color:white">
              ₹${totalCost}
            </div>
            <div style="font-size:11px;
                        color:rgba(255,255,255,0.8)">
              per month
            </div>
          </div>
        </div>

        <!-- Savings Row -->
        <div style="padding:14px 18px;background:#dcfce7;
                    display:flex;justify-content:space-between;
                    align-items:center;
                    border-top:1px solid #bbf7d0">
          <div>
            <div style="font-size:13px;font-weight:bold;
                        color:#15803d">
              🎉 Maximum Monthly Savings
            </div>
            <div style="font-size:11px;color:#555;margin-top:2px">
              vs buying at market price
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:24px;font-weight:bold;
                        color:#15803d">
              ₹${savings}
            </div>
            <div style="font-size:11px;color:#555">
              ₹${savings * 12} / year
            </div>
          </div>
        </div>

        <!-- Annual Row -->
        <div style="padding:12px 18px;background:#f0fdf4;
                    display:flex;justify-content:space-between;
                    align-items:center">
          <span style="font-size:12px;color:#555">
            📅 Maximum Annual Cost (12 months)
          </span>
          <strong style="color:#15803d">
            ₹${totalCost * 12} / year
          </strong>
        </div>

      </div>

      <!-- Note Box -->
      <div style="background:#eff6ff;border:1px solid #bfdbfe;
                  border-radius:10px;padding:12px 16px;
                  font-size:12px;color:#1e40af;line-height:1.8">
        💡 <strong>Note:</strong>
        These are <strong>maximum amounts</strong> if you collect
        your full entitlement. Actual bill may be less if you take
        fewer quantities at the shop. Market prices used:
        Rice ₹${MARKET_PRICES.rice}/kg,
        Wheat ₹${MARKET_PRICES.wheat}/kg,
        Sugar ₹${MARKET_PRICES.sugar}/kg.
        <br/>
        📄 Go to <strong>My Bills</strong> tab to see your
        actual bills generated by the dealer after collection.
      </div>`;
  }

  // ── 5. Remaining Balance This Month ─────────────────────
  const billSec =
    document.getElementById("entitlementBillSection");
  if (billSec) {
    await loadRationBalance(
      category, r, memberCount, billSec
    );
  }
}

// ── Load Ration Balance ───────────────────────────────────────
async function loadRationBalance(category, r, memberCount, container) {
  const now    = new Date();
  const month  = now.toLocaleString("default",{month:"long"});
  const year   = now.getFullYear();

  // Last day of current month
  const lastDay  = new Date(year, now.getMonth()+1, 0);
  const lastDate = lastDay.toLocaleDateString("en-IN",{
    day:"2-digit", month:"long", year:"numeric"
  });
  const daysLeft = Math.ceil(
    (lastDay - now) / (1000 * 60 * 60 * 24)
  );

  // Expire old balances
  await expireOldBalances();

  // Fetch this month's balance
  const { data: balRows } = await db
    .from("ration_balance").select("*")
    .eq("ration_card", currentRationCard)
    .eq("month", month).eq("year", year)
    .limit(1);

  const bal = balRows && balRows[0] ? balRows[0] : null;

  if (!bal) {
    // No collection yet this month
    container.innerHTML = `
      <div style="background:#f0fdf4;
                  border:2px solid #2e7d32;
                  border-radius:14px;overflow:hidden;
                  margin-bottom:14px">
        <div style="background:#1b5e20;padding:12px 18px;
                    color:white;display:flex;
                    justify-content:space-between;
                    align-items:center">
          <div style="font-size:14px;font-weight:bold">
            📊 This Month's Balance — ${month} ${year}
          </div>
          <div style="font-size:11px;opacity:0.85">
            Expires: ${lastDate}
          </div>
        </div>
        <div style="padding:20px;text-align:center">
          <div style="font-size:36px;margin-bottom:8px">🌾</div>
          <div style="font-size:14px;font-weight:bold;
                      color:#1b5e20;margin-bottom:4px">
            Full Entitlement Available
          </div>
          <div style="font-size:12px;color:#555;
                      margin-bottom:16px">
            You have not collected any ration this month yet.
            Book a token to collect your ration.
          </div>
          <div style="display:grid;
                      grid-template-columns:repeat(3,1fr);
                      gap:10px">
            ${[
              {name:"🌾 Rice", kg: r.rice * memberCount,
               color:"#15803d",bg:"#dcfce7"},
              {name:"🌿 Wheat",kg: r.wheat * memberCount,
               color:"#a16207",bg:"#fef9c3"},
              {name:"🍬 Sugar",kg: r.sugar * memberCount,
               color:"#7e22ce",bg:"#ede9fe"}
            ].map(i=>`
              <div style="background:${i.bg};
                          border-radius:10px;padding:12px;
                          text-align:center">
                <div style="font-size:12px;font-weight:bold;
                            color:${i.color}">${i.name}</div>
                <div style="font-size:22px;font-weight:bold;
                            color:${i.color};margin:4px 0">
                  ${i.kg} kg
                </div>
                <div style="font-size:10px;color:#888">
                  Full balance
                </div>
              </div>`).join("")}
          </div>
          <div style="margin-top:12px;font-size:11px;
                      color:#888;background:#f9fafb;
                      padding:8px 12px;border-radius:8px">
            ⏰ Balance expires on <strong>${lastDate}</strong>
            (${daysLeft} days left)
          </div>
        </div>
      </div>`;
    return;
  }

  // Has collected — show remaining balance
  const riceRem  = parseFloat(bal.rice_balance  || 0);
  const wheatRem = parseFloat(bal.wheat_balance || 0);
  const sugarRem = parseFloat(bal.sugar_balance || 0);
  const isExpired = bal.is_expired;

  const totalRem     = riceRem + wheatRem + sugarRem;
  const totalCollect =
    parseFloat(bal.rice_collected  || 0) +
    parseFloat(bal.wheat_collected || 0) +
    parseFloat(bal.sugar_collected || 0);

  const p = PRICES[category] || PRICES.BPL;
  const remainingCost =
    (riceRem * p.rice) +
    (wheatRem * p.wheat) +
    (sugarRem * p.sugar);

  container.innerHTML = `
    <div style="border:2px solid ${isExpired?'#e5e7eb':'#1565c0'};
                border-radius:14px;overflow:hidden;
                margin-bottom:14px;
                box-shadow:0 4px 16px rgba(0,0,0,0.08)">

      <!-- Balance Header -->
      <div style="background:${isExpired
        ? '#9e9e9e'
        : totalRem > 0 ? '#1565c0' : '#15803d'};
                  padding:14px 18px;color:white">
        <div style="display:flex;justify-content:space-between;
                    align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:15px;font-weight:bold">
              ${isExpired
                ? '⏰ Balance Expired'
                : totalRem > 0
                  ? '📊 Remaining Balance This Month'
                  : '✅ Fully Collected This Month'}
            </div>
            <div style="font-size:11px;opacity:0.85;
                        margin-top:2px">
              ${month} ${year}
              ${isExpired
                ? ' — Balance has expired'
                : ` — Expires: ${lastDate}`}
            </div>
          </div>
          ${!isExpired && totalRem > 0 ? `
          <div style="background:rgba(255,255,255,0.2);
                      padding:6px 14px;border-radius:20px;
                      font-size:12px;font-weight:bold">
            ⏰ ${daysLeft} days left
          </div>` : ""}
        </div>
      </div>

      <!-- Expired Warning -->
      ${isExpired ? `
      <div style="background:#fff3e0;padding:12px 18px;
                  border-bottom:1px solid #fde68a;
                  font-size:13px;color:#a16207;
                  font-weight:bold;text-align:center">
        ⚠️ Your remaining balance for ${month} ${year}
        has expired. Fresh entitlement starts next month.
      </div>` : ""}

      <!-- Balance Cards -->
      <div style="padding:16px 18px">
        <div style="display:grid;
                    grid-template-columns:repeat(3,1fr);
                    gap:12px;margin-bottom:14px">
          ${[
            {
              name:"🌾 Rice",
              entitled: parseFloat(bal.rice_entitled  || 0),
              collected:parseFloat(bal.rice_collected || 0),
              balance:  riceRem,
              color:"#15803d", bg:"#f0fdf4",
              border:"#bbf7d0", price:p.rice
            },
            {
              name:"🌿 Wheat",
              entitled: parseFloat(bal.wheat_entitled  || 0),
              collected:parseFloat(bal.wheat_collected || 0),
              balance:  wheatRem,
              color:"#a16207", bg:"#fefce8",
              border:"#fde68a", price:p.wheat
            },
            {
              name:"🍬 Sugar",
              entitled: parseFloat(bal.sugar_entitled  || 0),
              collected:parseFloat(bal.sugar_collected || 0),
              balance:  sugarRem,
              color:"#7e22ce", bg:"#faf5ff",
              border:"#e9d5ff", price:p.sugar
            }
          ].map(item => {
            const pct = item.entitled > 0
              ? Math.round((item.collected/item.entitled)*100)
              : 100;
            const balPct = 100 - pct;
            return `
              <div style="background:${item.bg};
                          border:2px solid ${item.border};
                          border-radius:12px;overflow:hidden">
                <!-- Item Header -->
                <div style="padding:10px 14px;
                            border-bottom:1px solid ${item.border};
                            font-size:13px;font-weight:bold;
                            color:${item.color}">
                  ${item.name}
                </div>
                <!-- Item Body -->
                <div style="padding:12px 14px">
                  <!-- Entitled -->
                  <div style="display:flex;
                              justify-content:space-between;
                              font-size:11px;color:#888;
                              margin-bottom:4px">
                    <span>Entitled</span>
                    <strong style="color:#333">
                      ${item.entitled} kg
                    </strong>
                  </div>
                  <!-- Collected -->
                  <div style="display:flex;
                              justify-content:space-between;
                              font-size:11px;color:#888;
                              margin-bottom:6px">
                    <span>Collected</span>
                    <strong style="color:#15803d">
                      ${item.collected} kg
                    </strong>
                  </div>
                  <!-- Progress Bar -->
                  <div style="background:#e5e7eb;
                              border-radius:10px;height:6px;
                              overflow:hidden;margin-bottom:8px">
                    <div style="background:${item.color};
                                width:${pct}%;height:100%;
                                border-radius:10px;
                                transition:width 0.5s ease">
                    </div>
                  </div>
                  <!-- Balance -->
                  <div style="background:${isExpired
                      ?'#f5f5f5':item.bg};
                              border:1px solid ${item.border};
                              border-radius:8px;padding:8px;
                              text-align:center">
                    <div style="font-size:10px;color:#888;
                                margin-bottom:2px">
                      ${isExpired?'Expired':'Remaining'}
                    </div>
                    <div style="font-size:20px;font-weight:bold;
                                color:${isExpired
                                  ?'#9e9e9e':item.color}">
                      ${isExpired?'—':item.balance+' kg'}
                    </div>
                    ${!isExpired && item.balance > 0 ? `
                    <div style="font-size:10px;color:#888;
                                margin-top:2px">
                      ≈ ₹${item.balance * item.price} payable
                    </div>` : ""}
                  </div>
                </div>
              </div>`;
          }).join("")}
        </div>

        <!-- Summary Row -->
        ${!isExpired && totalRem > 0 ? `
        <div style="background:#eff6ff;
                    border:1px solid #bfdbfe;
                    border-radius:10px;padding:14px 16px;
                    margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;
                      align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-size:13px;font-weight:bold;
                          color:#1565c0">
                📦 Total Remaining Balance
              </div>
              <div style="font-size:11px;color:#555;
                          margin-top:3px">
                You can still collect <strong>${totalRem}kg</strong>
                more from the shop before ${lastDate}
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:22px;font-weight:bold;
                          color:#1565c0">
                ${totalRem} kg
              </div>
              <div style="font-size:11px;color:#555">
                ≈ ₹${remainingCost} payable
              </div>
            </div>
          </div>
        </div>

        <!-- Action Note -->
        <div style="background:#dcfce7;
                    border:1px solid #bbf7d0;
                    border-radius:10px;padding:12px 16px;
                    font-size:12px;color:#15803d;
                    line-height:1.8">
          💡 <strong>How to collect remaining balance:</strong><br/>
          1. Go to <strong>🎫 Book Token</strong> tab<br/>
          2. Book a new token for the same shop<br/>
          3. Visit shop before <strong>${lastDate}</strong><br/>
          4. Dealer will see your remaining balance
             and enter actual quantity you collect<br/>
          ⚠️ After ${lastDate}, unused balance
          <strong>expires and cannot be collected</strong>
        </div>` : ""}

        ${!isExpired && totalRem === 0 ? `
        <div style="background:#dcfce7;
                    border:1px solid #bbf7d0;
                    border-radius:10px;padding:12px 16px;
                    font-size:12px;color:#15803d;
                    font-weight:bold;text-align:center">
          ✅ You have collected your full monthly entitlement!
          Fresh entitlement starts on 1st ${
            new Date(year, now.getMonth()+1, 1)
              .toLocaleString("default",{month:"long"})
          } ${year}
        </div>` : ""}

        <!-- Expiry Warning -->
        ${!isExpired && totalRem > 0 && daysLeft <= 5 ? `
        <div style="background:#fff1f2;
                    border:1px solid #fca5a5;
                    border-radius:10px;padding:12px 16px;
                    font-size:12px;color:#b91c1c;
                    font-weight:bold;margin-top:10px;
                    text-align:center">
          🚨 Only <strong>${daysLeft} days</strong> left!
          Balance expires on ${lastDate}.
          Collect remaining ration soon!
        </div>` : ""}

      </div>
    </div>`;
}

// ── Expire old balances automatically ────────────────────────
async function expireOldBalances() {
  const today = new Date().toISOString().split("T")[0];
  try {
    await db.from("ration_balance")
      .update({ is_expired: true })
      .lt("expires_on", today)
      .eq("is_expired", false);
  } catch(e) {
    console.log("Balance expire check:", e.message);
  }
}

// ══════════════════════════════════════════════════════════════
// 3. LOAD MEMBERS IN DASHBOARD
// ══════════════════════════════════════════════════════════════
async function loadDashMembers() {
  if (!currentRationCard) return;
  const { data } = await db.from("family_members")
    .select("*").eq("ration_card",currentRationCard);
  const list = document.getElementById("dashMemberList");
  if (!list) return;
  list.innerHTML = "";
  if (!data||data.length===0) {
    list.innerHTML =
      `<p style="color:#888">No members found.</p>`;
    return;
  }
  data.forEach(m => {
    const div = document.createElement("div");
    div.className = "member-item";
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px">
        ${m.photo_url
          ? `<img src="${m.photo_url}"
                  style="width:54px;height:54px;
                         border-radius:50%;object-fit:cover;
                         border:2px solid #2e7d32"/>`
          : `<div style="width:54px;height:54px;
                         border-radius:50%;background:#e8f5e9;
                         display:flex;align-items:center;
                         justify-content:center;font-size:24px;
                         border:2px dashed #ccc">👤</div>`}
        <div>
          <strong>${m.name}</strong><br/>
          <small style="color:#888">${m.relation}</small><br/>
          <small style="color:${m.photo_url?'#15803d':'#c62828'}">
            ${m.photo_url
              ? "📷 Photo ready ✅"
              : "❌ No photo — upload for face scan"}
          </small>
        </div>
      </div>
      <button onclick='openMemberDetails(${JSON.stringify(m)})'
              style="background:#1565c0;padding:6px 14px;
                     font-size:12px;width:auto">
        👁 View
      </button>`;
    list.appendChild(div);
  });
}

// ══════════════════════════════════════════════════════════════
// 4. GEO LOCATION
// ══════════════════════════════════════════════════════════════
function getGeoLocation(rationCard) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async (pos) => {
    await db.from("geo_logs").insert([{
      ration_card:rationCard,
      latitude:pos.coords.latitude,
      longitude:pos.coords.longitude
    }]);
    console.log("📍 Location logged");
  },(err)=>{console.log("Geo skipped:",err.message);});
}

// ══════════════════════════════════════════════════════════════
// 5. LOAD SHOPS
// ══════════════════════════════════════════════════════════════
async function loadShops() {
  const sel = document.getElementById("shopSelect");
  if (!sel) return;

  sel.innerHTML = `<option value="">-- Loading shops... --</option>`;

  // Fetch all dealers
  const { data: dealers } = await db
    .from("dealers")
    .select("*")
    .eq("role", "dealer");

  // Fetch active inconvenience notices for today
  const today = new Date().toISOString().split("T")[0];
  const { data: closures } = await db
    .from("dealer_inconvenience")
    .select("dealer_id, reason, affect_date")
    .eq("status",      "approved")
    .eq("affect_date", today);

  // Build set of closed dealer IDs for today
  const closedDealerIds = new Set(
    (closures || []).map(c => c.dealer_id)
  );

  // Also check shop_closures table
  const { data: shopClosures } = await db
    .from("shop_closures")
    .select("dealer_id")
    .eq("is_active",    true)
    .eq("closure_date", today);

  (shopClosures || []).forEach(c =>
    closedDealerIds.add(c.dealer_id)
  );

  sel.innerHTML = `<option value="">-- Select Shop --</option>`;

  if (!dealers || dealers.length === 0) {
    sel.innerHTML =
      `<option value="">No shops available</option>`;
    return;
  }

  let openCount  = 0;
  let closedCount = 0;

  dealers.forEach(d => {
    const isClosed = closedDealerIds.has(d.dealer_id);
    const o = document.createElement("option");

    if (isClosed) {
      // Closed shop — disabled
      o.value    = "";
      o.disabled = true;
      o.textContent =
        `🔴 ${d.shop_name} — ${d.locality} (CLOSED TODAY)`;
      o.style.color = "#b91c1c";
      closedCount++;
    } else {
      // Open shop — available
      o.value = d.dealer_id;
      o.textContent =
        `✅ ${d.shop_name} — 📍 ${d.locality}`;
      openCount++;
    }
    sel.appendChild(o);
  });

  // Show notice below dropdown if any shops are closed
  const shopNotice =
    document.getElementById("shopClosureNotice");
  if (shopNotice) {
    if (closedCount > 0) {
      shopNotice.style.display = "block";
      shopNotice.innerHTML = `
        <div style="background:#fff5f5;
                    border:1px solid #fca5a5;
                    border-radius:8px;padding:10px 14px;
                    font-size:12px;color:#b91c1c;
                    margin-top:8px;line-height:1.7">
          🔴 <strong>${closedCount} shop(s) are CLOSED today</strong>
          due to dealer inconvenience or official notice.<br/>
          Please select an available open shop below.
          Closed shops are shown but cannot be selected.
        </div>`;
    } else {
      shopNotice.style.display = "none";
    }
  }
}

// ══════════════════════════════════════════════════════════════
// 5b. LOAD MEMBER SELECT GRID
//     Show all family members as selectable cards
//     Citizen picks who is coming to collect ration
// ══════════════════════════════════════════════════════════════
async function loadMemberSelectGrid() {
  if (!currentRationCard) return;

  const grid = document.getElementById("memberSelectGrid");
  if (!grid) return;

  grid.innerHTML = `
    <p style="color:#888;font-size:12px;grid-column:1/-1">
      ⏳ Loading family members...
    </p>`;

  const { data: members } = await db
    .from("family_members")
    .select("*")
    .eq("ration_card", currentRationCard);

  if (!members || members.length === 0) {
    grid.innerHTML = `
      <p style="color:#c62828;font-size:12px;
                grid-column:1/-1">
        ❌ No family members found.
        Please register members first.
      </p>`;
    return;
  }

  grid.innerHTML = "";

  members.forEach((member, idx) => {
    const card = document.createElement("div");
    card.id    = `memberCard_${member.id}`;
    card.style.cssText = `
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      padding: 12px;
      cursor: pointer;
      background: white;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 10px`;

    card.innerHTML = `
      ${member.photo_url
        ? `<img src="${member.photo_url}"
                style="width:48px;height:48px;
                       border-radius:50%;
                       object-fit:cover;
                       border:2px solid #e5e7eb;
                       flex-shrink:0"/>`
        : `<div style="width:48px;height:48px;
                       border-radius:50%;
                       background:#f3f4f6;
                       display:flex;align-items:center;
                       justify-content:center;
                       font-size:22px;flex-shrink:0;
                       border:2px dashed #ccc">👤</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-weight:bold;font-size:13px;
                    color:#333;white-space:nowrap;
                    overflow:hidden;text-overflow:ellipsis">
          ${member.name}
        </div>
        <div style="font-size:11px;color:#888">
          ${member.relation}
        </div>
        <div style="font-size:10px;margin-top:2px;
                    color:${member.photo_url
                      ? '#15803d' : '#c62828'}">
          ${member.photo_url
            ? '📷 Photo ready ✅'
            : '❌ No photo — face scan may fail'}
        </div>
      </div>`;

    // Click to select this member
    card.onclick = () => selectMember(member, card);

    // Auto select first member
    if (idx === 0) selectMember(member, card);

    grid.appendChild(card);
  });
}

// ── Select a member for collection ───────────────────────────
function selectMember(member, cardEl) {
  // Reset all cards
  document.querySelectorAll("[id^='memberCard_']")
  .forEach(c => {
    c.style.border     = "2px solid #e5e7eb";
    c.style.background = "white";
  });

  // Highlight selected
  cardEl.style.border     = "2px solid #2e7d32";
  cardEl.style.background = "#f0fdf4";

  // Save selected member data
  document.getElementById("selectedMemberId").value =
    member.id;
  document.getElementById("selectedMemberName").value =
    member.name;
  document.getElementById("selectedMemberPhoto").value =
    member.photo_url || "";

  // Show preview
  const preview = document.getElementById(
    "selectedMemberPreview"
  );
  const photoEl = document.getElementById(
    "selectedMemberPhotoPreview"
  );
  const nameEl  = document.getElementById(
    "selectedMemberNameDisplay"
  );
  const relEl   = document.getElementById(
    "selectedMemberRelDisplay"
  );

  if (preview) preview.style.display = "block";

  if (photoEl) {
    if (member.photo_url) {
      photoEl.src           = member.photo_url;
      photoEl.style.display = "block";
    } else {
      photoEl.style.display = "none";
    }
  }
  if (nameEl) nameEl.textContent = member.name;
  if (relEl)  relEl.textContent  = member.relation;
}

// ══════════════════════════════════════════════════════════════
// 6. CHECK MY TOKEN
// ══════════════════════════════════════════════════════════════
// Store current token data globally for change collector
let currentTokenData = null;

async function checkMyToken() {
  if (!currentRationCard) return;
  const today = new Date().toISOString().split("T")[0];
  const { data:rows } = await db.from("tokens").select("*")
    .eq("ration_card", currentRationCard)
    .eq("date", today).limit(1);
  const data  = rows && rows[0] ? rows[0] : null;
  currentTokenData = data; // Store globally

  const bookBox  = document.getElementById("tokenBookingBox");
  const tokenBox = document.getElementById("myTokenBox");
  if (!bookBox || !tokenBox) return;

  if (data) {
    bookBox.style.display  = "none";
    tokenBox.style.display = "block";

    // Token number
    const numEl = document.getElementById("myTokenNumber");
    if (numEl) numEl.textContent =
      `#${String(data.token_number).padStart(3,"0")}`;

    // Shop info
    const shopEl = document.getElementById("myShopName");
    if (shopEl) shopEl.textContent = data.shop_name || "—";

    // Queue position
    const qEl = document.getElementById("myQueuePos");
    if (qEl) qEl.textContent = data.queue_position;

    // Booked at
    const baEl = document.getElementById("myBookedAt");
    if (baEl) baEl.textContent = data.booked_at
      ? new Date(data.booked_at).toLocaleTimeString("en-IN",
          {hour:"2-digit", minute:"2-digit"})
      : "—";

    // Estimated time
    const etEl = document.getElementById("myEstTime");
    if (etEl) etEl.textContent = data.estimated_time || "—";

    // Status badge
    const statusBadge =
      document.getElementById("myTokenStatusBadge");
    if (statusBadge) {
      const statusMap = {
        waiting:   {text:"⏳ WAITING",  bg:"rgba(255,255,255,0.2)"},
        serving:   {text:"🔵 SERVING",  bg:"rgba(21,101,192,0.8)"},
        completed: {text:"✅ COMPLETED", bg:"rgba(21,128,61,0.8)"},
        cancelled: {text:"❌ CANCELLED", bg:"rgba(185,28,28,0.8)"},
      };
      const s = statusMap[data.status] || statusMap.waiting;
      statusBadge.textContent   = s.text;
      statusBadge.style.background = s.bg;
    }

    // Show/hide Change Collector button
    const changeBtn =
      document.getElementById("changeCollectorBtn");
    if (changeBtn) {
      changeBtn.style.display =
        (data.status === "waiting") ? "block" : "none";
    }

    // Show Login OTP in token box — always fetch fresh from DB
    const otpBox = document.getElementById("myTokenOTPBox");
    if (otpBox) {
      if (data.status === "waiting") {
        // Fetch fresh OTP from otp_logs
        const nowTs = new Date().toISOString();
        const { data: otpRows } = await db
          .from("otp_logs")
          .select("*")
          .eq("ration_card", currentRationCard)
          .eq("purpose", "login")
          .eq("is_used", false)
          .gt("expires_at", nowTs)
          .order("created_at", { ascending: false })
          .limit(1);

        const freshOtp = otpRows && otpRows[0]
          ? otpRows[0].otp_code : null;

        if (freshOtp) {
          // Calculate time left
          const expTime  = new Date(otpRows[0].expires_at);
          const diffMs   = expTime - new Date();
          const diffHrs  = Math.floor(diffMs / 3600000);
          const diffMins =
            Math.floor((diffMs % 3600000) / 60000);

          otpBox.style.display = "block";
          otpBox.innerHTML = `
            <div style="background:#f0fdf4;
                        border:2px solid #2e7d32;
                        border-radius:12px;padding:16px;
                        text-align:center;margin-top:12px">
              <div style="font-size:12px;color:#555;
                          font-weight:bold;margin-bottom:6px">
                🔐 Your Collection OTP
              </div>
              <div style="font-size:38px;font-weight:bold;
                          letter-spacing:10px;color:#1b5e20;
                          background:white;
                          border:2px dashed #2e7d32;
                          border-radius:10px;padding:12px;
                          margin-bottom:8px">
                ${freshOtp}
              </div>
              <div style="font-size:11px;color:#888;
                          margin-bottom:8px">
                ⏰ Valid for
                <strong style="color:#15803d">
                  ${diffHrs}h ${diffMins}m
                </strong>
                more
              </div>
              <div style="font-size:11px;color:#555;
                          line-height:1.7">
                📢 <strong>Tell this OTP to the dealer</strong>
                when collecting your ration at the shop.<br/>
                ⚠️ Do not share with anyone else.
              </div>
            </div>`;
        } else {
          // No valid OTP — expired or used
          otpBox.style.display = "block";
          otpBox.innerHTML = `
            <div style="background:#fff3e0;
                        border:1px solid #fde68a;
                        border-radius:10px;padding:12px;
                        text-align:center;margin-top:12px">
              <div style="font-size:13px;font-weight:bold;
                          color:#a16207;margin-bottom:6px">
                ⏰ OTP Expired or Used
              </div>
              <div style="font-size:11px;color:#555;
                          line-height:1.7">
                Your OTP has expired or was already used.<br/>
                Please <strong>logout and login again</strong>
                to get a new OTP.
              </div>
            </div>`;
        }
      } else if (data.status === "completed") {
        otpBox.style.display = "block";
        otpBox.innerHTML = `
          <div style="background:#dcfce7;
                      border:1px solid #bbf7d0;
                      border-radius:10px;padding:12px;
                      text-align:center;margin-top:12px;
                      font-size:13px;color:#15803d;
                      font-weight:bold">
            ✅ Ration Collected — OTP Used
          </div>`;
      } else {
        otpBox.style.display = "none";
      }
    }

    // Collector box
    const collectorBox =
      document.getElementById("myCollectorBox");
    if (collectorBox) {
      if (data.collecting_member_name) {
        collectorBox.innerHTML = `
          <div style="display:flex;align-items:center;
                      gap:12px">
            ${data.collecting_member_photo
              ? `<img src="${data.collecting_member_photo}"
                      style="width:48px;height:48px;
                             border-radius:50%;
                             object-fit:cover;
                             border:2px solid #2e7d32;
                             flex-shrink:0"/>`
              : `<div style="width:48px;height:48px;
                             border-radius:50%;
                             background:#e8f5e9;
                             display:flex;align-items:center;
                             justify-content:center;
                             font-size:22px;flex-shrink:0">
                   👤
                 </div>`}
            <div style="flex:1">
              <div style="font-size:11px;color:#888;
                          margin-bottom:2px">
                Current Collector
              </div>
              <div style="font-size:14px;font-weight:bold;
                          color:#1b5e20">
                ${data.collecting_member_name}
              </div>
              <div style="font-size:11px;color:#555;
                          margin-top:2px">
                📷 Face scan will verify this person at shop
              </div>
              ${data.status === "waiting"
                ? `<div style="font-size:10px;color:#1565c0;
                               margin-top:4px">
                     💡 If they can't come, use
                     <strong>🔄 Change Collector</strong> below
                   </div>`
                : ""}
            </div>
          </div>`;
      } else {
        collectorBox.innerHTML = `
          <div style="font-size:12px;color:#888">
            No collector selected
          </div>`;
      }
    }

  } else {
    bookBox.style.display  = "block";
    tokenBox.style.display = "none";
    loadMemberSelectGrid();
  }
}

// ══════════════════════════════════════════════════════════════
// CHANGE COLLECTOR FUNCTIONS
// ══════════════════════════════════════════════════════════════

// Show change collector panel
async function showChangeCollector() {
  const box = document.getElementById("changeCollectorBox");
  if (box) box.style.display = "block";

  // Scroll to it
  box.scrollIntoView({ behavior:"smooth", block:"nearest" });

  // Load family members for selection
  await loadChangeCollectorGrid();
}

// Hide change collector panel
function hideChangeCollector() {
  const box = document.getElementById("changeCollectorBox");
  if (box) box.style.display = "none";

  // Reset
  document.getElementById("changeReason").value = "";
  document.getElementById("newCollectorPreview")
    .style.display = "none";
  document.getElementById("newMemberId").value    = "";
  document.getElementById("newMemberName").value  = "";
  document.getElementById("newMemberPhotoUrl").value = "";

  const msg = document.getElementById("changeCollectorMsg");
  if (msg) msg.style.display = "none";
}

// Load member grid for change collector
async function loadChangeCollectorGrid() {
  if (!currentRationCard) return;
  const grid =
    document.getElementById("changeCollectorGrid");
  if (!grid) return;

  grid.innerHTML = `
    <p style="color:#888;font-size:12px;grid-column:1/-1">
      ⏳ Loading members...
    </p>`;

  const { data: members } = await db
    .from("family_members")
    .select("*")
    .eq("ration_card", currentRationCard);

  if (!members || members.length === 0) {
    grid.innerHTML = `
      <p style="color:#c62828;font-size:12px;
                grid-column:1/-1">
        ❌ No family members found.
      </p>`;
    return;
  }

  // Filter out current collector
  const currentName =
    currentTokenData?.collecting_member_name || "";

  grid.innerHTML = "";
  members.forEach(m => {
    const isCurrent = m.name === currentName;
    const card      = document.createElement("div");
    card.style.cssText = `
      border: 2px solid ${isCurrent?'#fde68a':'#e5e7eb'};
      border-radius: 10px;
      padding: 10px;
      cursor: ${isCurrent?'not-allowed':'pointer'};
      background: ${isCurrent?'#fefce8':'white'};
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: ${isCurrent?'0.6':'1'}`;

    card.innerHTML = `
      ${m.photo_url
        ? `<img src="${m.photo_url}"
                style="width:42px;height:42px;
                       border-radius:50%;
                       object-fit:cover;
                       border:2px solid #e5e7eb;
                       flex-shrink:0"/>`
        : `<div style="width:42px;height:42px;
                       border-radius:50%;
                       background:#f3f4f6;
                       display:flex;align-items:center;
                       justify-content:center;
                       font-size:20px;flex-shrink:0">
             👤
           </div>`}
      <div style="flex:1;min-width:0">
        <div style="font-weight:bold;font-size:12px;
                    color:#333;white-space:nowrap;
                    overflow:hidden;text-overflow:ellipsis">
          ${m.name}
        </div>
        <div style="font-size:11px;color:#888">
          ${m.relation}
        </div>
        ${isCurrent
          ? `<div style="font-size:10px;color:#a16207;
                         font-weight:bold">
               Current collector
             </div>`
          : `<div style="font-size:10px;color:${
               m.photo_url ? '#15803d' : '#c62828'}">
               ${m.photo_url
                 ? '📷 Photo ready ✅'
                 : '❌ No photo'}
             </div>`}
      </div>`;

    if (!isCurrent) {
      card.onclick = () => selectNewCollector(m, card);
    }

    grid.appendChild(card);
  });
}

// Select new collector
function selectNewCollector(member, cardEl) {
  // Reset all cards
  document.querySelectorAll(
    "#changeCollectorGrid > div"
  ).forEach(c => {
    if (!c.style.cursor.includes("not-allowed")) {
      c.style.border     = "2px solid #e5e7eb";
      c.style.background = "white";
    }
  });

  // Highlight selected
  cardEl.style.border     = "2px solid #1565c0";
  cardEl.style.background = "#eff6ff";

  // Save selected
  document.getElementById("newMemberId").value =
    member.id;
  document.getElementById("newMemberName").value =
    member.name;
  document.getElementById("newMemberPhotoUrl").value =
    member.photo_url || "";

  // Show preview
  const preview =
    document.getElementById("newCollectorPreview");
  const photoEl =
    document.getElementById("newCollectorPhoto");
  const nameEl  =
    document.getElementById("newCollectorName");
  const relEl   =
    document.getElementById("newCollectorRel");

  if (preview) preview.style.display = "block";
  if (photoEl) {
    if (member.photo_url) {
      photoEl.src           = member.photo_url;
      photoEl.style.display = "block";
    } else {
      photoEl.style.display = "none";
    }
  }
  if (nameEl) nameEl.textContent = member.name;
  if (relEl)  relEl.textContent  = member.relation;
}

// Confirm change collector
async function confirmChangeCollector() {
  const newId    =
    document.getElementById("newMemberId")?.value;
  const newName  =
    document.getElementById("newMemberName")?.value;
  const newPhoto =
    document.getElementById("newMemberPhotoUrl")?.value;
  const reason   =
    document.getElementById("changeReason")?.value;
  const msg      =
    document.getElementById("changeCollectorMsg");

  if (!newName) {
    showMsg(msg,
      "⚠️ Please select a new collector first.",
      "red"); return;
  }
  if (!reason) {
    showMsg(msg,
      "⚠️ Please select a reason for the change.",
      "red"); return;
  }
  if (!newPhoto) {
    showMsg(msg,
      `⚠️ ${newName} has no photo! ` +
      `Face scan will fail. ` +
      `Please select a member with a registered photo.`,
      "orange");
    // Still allow — dealer will handle
  }
  if (!currentTokenData) {
    showMsg(msg, "❌ No token found.", "red"); return;
  }

  // Update token with new collector
  const { error } = await db.from("tokens")
    .update({
      collecting_member_id:    newId,
      collecting_member_name:  newName,
      collecting_member_photo: newPhoto
    })
    .eq("id", currentTokenData.id);

  if (error) {
    showMsg(msg, "❌ " + error.message, "red"); return;
  }

  // Log the collector change (silently - don't block)
  try {
    await db.from("geo_logs").insert([{
      ration_card: currentRationCard,
      latitude:    0,
      longitude:   0,
      logged_at:   new Date().toISOString()
    }]);
  } catch(e) {
    console.log("Geo log note:", e.message);
  }

  showMsg(msg,
    `✅ Collector changed to ${newName}! ` +
    `Reason: ${reason}. ` +
    `${newName} should now visit the shop.`,
    "green");

  // Refresh token display after 1.5 sec
  setTimeout(() => {
    hideChangeCollector();
    checkMyToken();
  }, 2000);
}

// ══════════════════════════════════════════════════════════════
// 6b. LOAD MY BILLS — Shows actual bills from dealer
//     Bills are generated by dealer based on actual qty taken
//     Payment status shown (Cash / PayPal / Pending)
// ══════════════════════════════════════════════════════════════
async function loadMyBills() {
  if (!currentRationCard) return;
  const list = document.getElementById("myBillsList");
  if (!list) return;

  list.innerHTML = `
    <p style="color:#888;text-align:center;padding:20px">
      ⏳ Loading your bills...
    </p>`;

  const { data: bills } = await db
    .from("bills")
    .select("*")
    .eq("ration_card", currentRationCard)
    .order("bill_date", { ascending: false });

  if (!bills || bills.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:30px">
        <div style="font-size:40px;margin-bottom:10px">📄</div>
        <div style="font-size:14px;color:#555;font-weight:bold">
          No Bills Yet
        </div>
        <div style="font-size:12px;color:#888;margin-top:6px">
          Bills will appear here after your ration
          is collected at the shop
        </div>
      </div>`;
    return;
  }

  list.innerHTML = bills.map(bill => {
    const date       = bill.bill_date
      ? new Date(bill.bill_date).toLocaleDateString("en-IN",{
          day:"2-digit", month:"long", year:"numeric"
        })
      : "—";
    const isPaid     = bill.payment_status === "paid";
    const isCash     = bill.payment_method === "cash";
    const isPaypal   = (bill.payment_method || "")
                         .startsWith("paypal");
    const txnId      = isPaypal
      ? bill.payment_method.replace("paypal:","")
      : "";

    const payBadge = isPaid
      ? (isCash
          ? `<span style="background:#dcfce7;color:#15803d;
                          padding:3px 10px;border-radius:20px;
                          font-size:11px;font-weight:bold">
               ✅ PAID — CASH
             </span>`
          : `<span style="background:#dbeafe;color:#1565c0;
                          padding:3px 10px;border-radius:20px;
                          font-size:11px;font-weight:bold">
               ✅ PAID — ONLINE
             </span>`)
      : `<span style="background:#fff3e0;color:#a16207;
                      padding:3px 10px;border-radius:20px;
                      font-size:11px;font-weight:bold">
           ⏳ PENDING
         </span>`;

    return `
      <div style="border:1px solid #e5e7eb;border-radius:12px;
                  overflow:hidden;margin-bottom:14px;
                  box-shadow:0 2px 8px rgba(0,0,0,0.05)">

        <!-- Bill Header -->
        <div style="background:linear-gradient(135deg,
                      #1b5e20,#2e7d32);
                    padding:12px 16px;color:white">
          <div style="display:flex;justify-content:space-between;
                      align-items:center;flex-wrap:wrap;gap:6px">
            <div>
              <div style="font-size:13px;font-weight:bold">
                📄 ${bill.bill_number}
              </div>
              <div style="font-size:11px;opacity:0.85;
                          margin-top:2px">
                ${bill.month} ${bill.year} |
                ${bill.shop_name}
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:20px;font-weight:bold">
                ₹${parseFloat(bill.total_amount).toFixed(2)}
              </div>
              <div style="font-size:11px;opacity:0.85">
                ${date}
              </div>
            </div>
          </div>
        </div>

        <!-- Bill Items -->
        <div style="padding:12px 16px;background:white">
          <div style="display:grid;
                      grid-template-columns:repeat(3,1fr);
                      gap:8px;margin-bottom:12px">
            ${[
              {name:"🌾 Rice",  kg:bill.rice_kg,
               price:bill.rice_price,  color:"#15803d"},
              {name:"🌿 Wheat", kg:bill.wheat_kg,
               price:bill.wheat_price, color:"#a16207"},
              {name:"🍬 Sugar", kg:bill.sugar_kg,
               price:bill.sugar_price, color:"#7e22ce"},
            ].map(item => `
              <div style="background:#f9fafb;
                          border:1px solid #e5e7eb;
                          border-radius:8px;padding:10px;
                          text-align:center">
                <div style="font-size:12px;font-weight:bold;
                            color:${item.color}">
                  ${item.name}
                </div>
                <div style="font-size:16px;font-weight:bold;
                            color:#333;margin:4px 0">
                  ${parseFloat(item.kg || 0)} kg
                </div>
                <div style="font-size:11px;color:#15803d;
                            font-weight:bold">
                  ₹${parseFloat(item.price||0) *
                     parseFloat(item.kg||0)}
                </div>
                <div style="font-size:10px;color:#888">
                  @ ₹${parseFloat(item.price||0)}/kg
                </div>
              </div>`).join("")}
          </div>

          <!-- Payment Info -->
          <div style="display:flex;justify-content:space-between;
                      align-items:center;flex-wrap:wrap;gap:8px;
                      padding-top:10px;
                      border-top:1px solid #f3f4f6">
            <div style="display:flex;align-items:center;
                        gap:8px;flex-wrap:wrap">
              ${payBadge}
              ${isPaypal && txnId
                ? `<span style="font-size:10px;color:#888">
                     Txn: ${txnId}
                   </span>`
                : ""}
            </div>
            <div style="font-size:14px;font-weight:bold;
                        color:#1b5e20">
              Total: ₹${parseFloat(bill.total_amount)
                           .toFixed(2)}
            </div>
          </div>
        </div>

      </div>`;
  }).join("");
}

// ══════════════════════════════════════════════════════════════
// 6c. CLEAN EXPIRED OTPs
//     Marks expired OTPs in otp_logs as is_used=true
//     So they don't show up on citizen dashboard
// ══════════════════════════════════════════════════════════════
async function cleanExpiredOTPs() {
  try {
    const now = new Date().toISOString();
    // Mark all expired OTPs as used
    await db.from("otp_logs")
      .update({ is_used: true })
      .eq("is_used", false)
      .lt("expires_at", now);
    console.log("✅ Expired OTPs cleaned");
  } catch(e) {
    console.log("OTP cleanup note:", e.message);
  }
}

// ══════════════════════════════════════════════════════════════
// 7. ENTER DASHBOARD
// ══════════════════════════════════════════════════════════════
function enterDashboard(user) {
  showPage("dashboardPage");
  const welcome = document.getElementById("dashWelcome");
  if (welcome) {
    welcome.innerHTML =
      `🪪 Card: <strong>${user.ration_card}</strong> | `+
      `Category: <strong class="cat-badge cat-${
        user.category.toLowerCase()}">${user.category}</strong>`;
  }
  // Load all tabs data
  loadDashStock();
  loadShops();
  checkMyToken();
  loadEntitlement();
  loadMemberSelectGrid();
  loadMyBills();
  loadClosureNotifications(); // Refresh closure notices on dashboardg
}

// ══════════════════════════════════════════════════════════════
// 8. SHOW MESSAGE HELPER
// ══════════════════════════════════════════════════════════════
function showMsg(el, text, color) {
  if (!el) return;
  el.style.display    = "block";
  el.style.color      =
    color==="green" ?"#1b5e20":
    color==="red"   ?"#b71c1c":
    color==="orange"?"#e65100":
    color==="blue"  ?"#1565c0":"#333";
  el.style.background =
    color==="green" ?"#f0fdf4":
    color==="red"   ?"#fff1f2":
    color==="orange"?"#fff7ed":
    color==="blue"  ?"#eff6ff":"#f9fafb";
  el.style.padding       = "10px 14px";
  el.style.borderRadius  = "8px";
  el.style.marginTop     = "10px";
  el.textContent = text;
}

// ══════════════════════════════════════════════════════════════
// 8b. SHOP CLOSURE NOTIFICATIONS
//     Shows banner on landing page, login page AND dashboard
//     Visible to ALL users before and after login
// ══════════════════════════════════════════════════════════════
async function loadClosureNotifications() {
  const today = new Date().toISOString().split("T")[0];

  // Fetch shop closures
  const { data: closures } = await db
    .from("shop_closures")
    .select("*")
    .eq("is_active", true)
    .gte("closure_date", today)
    .order("closure_date", { ascending: true });

  // Fetch published dealer inconvenience notices
  const { data: dealerNotices } = await db
    .from("dealer_notices")
    .select("*")
    .eq("is_published", true)
    .gte("notice_date", today)
    .order("notice_date", { ascending: true });

  // Combine closures + published dealer notices
  const allNotices = [
    ...(closures || []).map(c => ({...c, type:"closure"})),
    ...(dealerNotices || []).map(d => ({...d, type:"dealer"}))
  ];

  // Global banner (fixed top — visible before login too)
  const globalBanner =
    document.getElementById("globalClosureBanner");

  // Dashboard notice inside citizen dashboard
  const dashNotice =
    document.getElementById("dashClosureNotice");

  if (allNotices.length === 0) {
    if (globalBanner) globalBanner.style.display = "none";
    if (dashNotice)   dashNotice.style.display   = "none";
    return;
  }

  const today2 = new Date().toISOString().split("T")[0];

  // Build banner HTML for ALL notices
  const bannerHTML = allNotices.map(n => {
    const isDealer  = n.type === "dealer";
    const dateField = isDealer ? n.notice_date : n.closure_date;
    const isToday   = dateField === today2;
    const dateFmt   = new Date(dateField + "T00:00:00")
      .toLocaleDateString("en-IN", {
        weekday:"long", day:"2-digit",
        month:"long", year:"numeric"
      });

    // Dealer notice styling (orange)
    if (isDealer) {
      return `
        <div style="background:${isToday?'#b45309':'#1565c0'};
                    color:white;padding:10px 16px;
                    display:flex;align-items:center;
                    gap:12px;flex-wrap:wrap;
                    border-bottom:1px solid rgba(0,0,0,0.1)">
          <div style="font-size:18px;flex-shrink:0">
            🚨
          </div>
          <div style="flex:1;min-width:200px">
            <strong style="font-size:13px">
              🏪 ${n.shop_name} (${n.locality}) —
              ${isToday
                ? "INCONVENIENCE TODAY"
                : `Issue on ${dateFmt}`}
            </strong>
            <div style="font-size:11px;opacity:0.9;
                        margin-top:2px">
              📋 ${n.reason}
              ${n.message ? ` | 💬 ${n.message}` : ""}
              ${n.officer_note
                ? ` | 👮 Officer: ${n.officer_note}`
                : ""}
            </div>
          </div>
          <div style="font-size:11px;opacity:0.8;
                      flex-shrink:0;background:rgba(255,255,255,0.2);
                      padding:3px 10px;border-radius:10px">
            Dealer Notice
          </div>
        </div>`;
    }

    // Shop closure styling (red/blue)
    return `
      <div style="background:${isToday?'#b91c1c':'#1565c0'};
                  color:white;padding:10px 16px;
                  display:flex;align-items:center;
                  gap:12px;flex-wrap:wrap;
                  border-bottom:1px solid rgba(0,0,0,0.1)">
        <div style="font-size:18px;flex-shrink:0">
          ${isToday ? '🔴' : '📅'}
        </div>
        <div style="flex:1;min-width:200px">
          <strong style="font-size:13px">
            ${isToday
              ? `🚨 ${n.shop_name} (${n.locality}) is CLOSED TODAY`
              : `📅 ${n.shop_name} (${n.locality}) will be CLOSED on ${dateFmt}`}
          </strong>
          <div style="font-size:11px;opacity:0.9;margin-top:2px">
            📋 Reason: ${n.reason}
            ${n.message ? ` | 💬 ${n.message}` : ""}
          </div>
        </div>
        <div style="font-size:11px;opacity:0.8;
                    flex-shrink:0">
          ${isToday ? "No distribution today" :
            `Closing: ${n.closure_date}`}
        </div>
      </div>`;
  }).join("");

  if (globalBanner) {
    globalBanner.style.display = "block";
    globalBanner.innerHTML     = bannerHTML;

    // Add padding to body so content not hidden behind banner
    const bannerH = globalBanner.offsetHeight;
    document.body.style.paddingTop = bannerH + "px";
  }

  // Dashboard notice
  if (dashNotice) {
    dashNotice.style.display = "block";
    dashNotice.innerHTML     = `
      <div style="margin-bottom:16px">
        ${closures.map(c => {
          const isToday2 = c.closure_date === today2;
          const dateFmt2 = new Date(c.closure_date + "T00:00:00")
            .toLocaleDateString("en-IN", {
              weekday:"long", day:"2-digit",
              month:"long", year:"numeric"
            });
          return `
            <div style="background:${isToday2
              ?'#fff1f2':'#eff6ff'};
                        border:2px solid ${isToday2
                          ?'#fca5a5':'#bfdbfe'};
                        border-radius:10px;padding:14px 16px;
                        margin-bottom:10px;
                        display:flex;align-items:start;
                        gap:12px">
              <div style="font-size:28px;flex-shrink:0">
                ${isToday2 ? '🔴' : '📅'}
              </div>
              <div>
                <div style="font-size:14px;font-weight:bold;
                            color:${isToday2?'#b91c1c':'#1565c0'}">
                  ${isToday2
                    ? `🚨 ${c.shop_name} is CLOSED TODAY`
                    : `📅 ${c.shop_name} will be CLOSED`}
                </div>
                <div style="font-size:12px;color:#555;
                            margin-top:4px;line-height:1.6">
                  📍 ${c.locality}<br/>
                  📋 Reason: <strong>${c.reason}</strong><br/>
                  📅 Date: <strong>${dateFmt2}</strong>
                  ${c.message
                    ? `<br/>💬 ${c.message}`
                    : ""}
                </div>
                ${isToday2
                  ? `<div style="margin-top:8px;font-size:11px;
                                  color:white;background:#b91c1c;
                                  padding:4px 12px;border-radius:20px;
                                  display:inline-block;
                                  font-weight:bold">
                       No ration distribution today
                     </div>`
                  : `<div style="margin-top:8px;font-size:11px;
                                  color:white;background:#1565c0;
                                  padding:4px 12px;border-radius:20px;
                                  display:inline-block;
                                  font-weight:bold">
                       Plan your visit on another day
                     </div>`}
              </div>
            </div>`;
        }).join("")}
      </div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// 9. DOM READY — Event Listeners only
// ══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", function() {

  // ── Check if running on file:// URL ──────────────────────
  if (window.location.protocol === "file:") {
    const warn = document.createElement("div");
    warn.style.cssText = `
      position:fixed;top:0;left:0;right:0;
      background:#b71c1c;color:white;
      padding:12px 20px;font-size:13px;
      font-weight:bold;z-index:99999;
      text-align:center;line-height:1.6`;
    warn.innerHTML = `
      ❌ ERROR: Running as file:// URL will not work!
      &nbsp;|&nbsp;
      Open with <strong>Live Server</strong> in VS Code
      → Right click index.html → Open with Live Server
      &nbsp;|&nbsp;
      URL must start with <strong>http://127.0.0.1:5500</strong>`;
    document.body.prepend(warn);
    return; // Stop all execution
  }

  // Init stock board
  fetchLiveStockBoard();
  setInterval(fetchLiveStockBoard, 60000);

  // Load closure notifications immediately on page load
  // Visible to ALL users before and after login
  loadClosureNotifications();
  setInterval(loadClosureNotifications, 300000);

  // Cleanup expired OTPs silently on page load
  cleanExpiredOTPs();

  // ── Add Member Button ───────────────────────────────────
  const addMemberBtn = document.getElementById("addMemberBtn");
  if (addMemberBtn) {
    addMemberBtn.addEventListener("click", () => {
      const idx =
        document.querySelectorAll(".member-row").length;
      const row = document.createElement("div");
      row.className = "member-row";
      row.innerHTML = `
        <input type="text" placeholder="Full Name"
               class="memberName"/>
        <select class="memberRelation">
          <option value="">-- Relationship --</option>
          <option value="Head">Head of Family</option>
          <option value="Spouse">Spouse</option>
          <option value="Son">Son</option>
          <option value="Daughter">Daughter</option>
          <option value="Father">Father</option>
          <option value="Mother">Mother</option>
          <option value="Other">Other</option>
        </select>
        <input type="text" placeholder="Aadhaar (12 digits)"
               class="memberAadhaar" maxlength="12"/>
        <div class="photo-upload-box">
          <label class="photo-label">
            📷 Upload Face Photo
          </label>
          <input type="file" class="memberPhoto"
                 accept="image/*"
                 onchange="previewMemberPhoto(this,${idx})"/>
          <div class="photo-preview" id="preview_${idx}">
          </div>
        </div>
        <button onclick="this.parentElement.remove()"
                style="background:#c62828;padding:6px 12px;
                       font-size:12px;width:auto;
                       margin-top:8px">
          ✕ Remove
        </button>`;
      document.getElementById("memberInputs").appendChild(row);
    });
  }

  // ── Register Button ─────────────────────────────────────
  const registerBtn = document.getElementById("registerBtn");
  if (registerBtn) {
    registerBtn.addEventListener("click", async () => {
      const rationCard =
        document.getElementById("regRationCard").value.trim();
      const aadhaar    =
        document.getElementById("regAadhaar").value.trim();
      const category   =
        document.getElementById("regCategory").value;
      const msg        =
        document.getElementById("registerMsg");
      if (!rationCard||!aadhaar||!category) {
        showMsg(msg,"⚠️ Fill all fields.","red"); return;
      }
      if (aadhaar.length!==12||isNaN(aadhaar)) {
        showMsg(msg,"⚠️ Aadhaar must be 12 digits.","red");
        return;
      }
      const rows = document.querySelectorAll(".member-row");
      if (rows.length===0) {
        showMsg(msg,"⚠️ Add at least one member.","red");
        return;
      }
      const {error:userErr} = await db.from("users").insert([{
        ration_card:rationCard, aadhaar, category
      }]);
      if (userErr) {
        showMsg(msg,"❌ "+(
          userErr.message.includes("duplicate")
            ? "Ration card already registered."
            : userErr.message
        ),"red"); return;
      }
      showMsg(msg,"⏳ Uploading photos...","blue");
      let allOk = true;
      for (let i=0;i<rows.length;i++) {
        const row      = rows[i];
        const name     =
          row.querySelector(".memberName").value.trim();
        const relation =
          row.querySelector(".memberRelation").value;
        const mAadh   =
          row.querySelector(".memberAadhaar").value.trim();
        const photoIn  =
          row.querySelector(".memberPhoto");
        if (!name||!relation||!mAadh) {
          showMsg(msg,"⚠️ Fill all member details.","red");
          allOk=false; break;
        }
        let photoUrl = "";
        if (photoIn&&photoIn.files&&photoIn.files[0]) {
          const file     = photoIn.files[0];
          const safeName = name.replace(/\s+/g,"_");
          const fileName =
            `${rationCard}_${safeName}_${Date.now()}.jpg`;
          const filePath = `member-photos/${fileName}`;
          const {error:upErr} = await db.storage
            .from("member-photos")
            .upload(filePath,file,{
              cacheControl:"3600",upsert:true,
              contentType:file.type
            });
          if (!upErr) {
            const {data:urlData} = db.storage
              .from("member-photos").getPublicUrl(filePath);
            photoUrl = urlData.publicUrl||"";
          }
        }
        const {error:memErr} = await db
          .from("family_members").insert([{
            ration_card:rationCard,name,relation,
            aadhaar:mAadh,photo_url:photoUrl
          }]);
        if (memErr) {
          showMsg(msg,"❌ "+memErr.message,"red");
          allOk=false; break;
        }
      }
      if (allOk) {
        showMsg(msg,
          `✅ Registered! Card: ${rationCard} | `+
          `Category: ${category}.`,"green");
      }
    });
  }

  // ── Send OTP Button ─────────────────────────────────────
  const sendOtpBtn = document.getElementById("sendOtpBtn");
  if (sendOtpBtn) {
    sendOtpBtn.addEventListener("click", async () => {
      const card    =
        document.getElementById("loginRationCard").value.trim();
      const aadhaar =
        document.getElementById("loginAadhaar").value.trim();
      const errEl   =
        document.getElementById("loginCredError");

      if (!card || !aadhaar) {
        errEl.style.display = "block";
        errEl.textContent   = "⚠️ Enter both fields.";
        return;
      }

      sendOtpBtn.disabled    = true;
      sendOtpBtn.textContent = "⏳ Verifying...";

      // Step 1: Verify credentials
      const { data: rows } = await db.from("users")
        .select("*")
        .eq("ration_card", card)
        .eq("aadhaar", aadhaar)
        .limit(1);
      const user = rows && rows[0] ? rows[0] : null;

      if (!user) {
        errEl.style.display = "block";
        errEl.textContent =
          "❌ Invalid credentials. Register first.";
        sendOtpBtn.disabled    = false;
        sendOtpBtn.textContent = "📱 Send OTP & Login";
        return;
      }

      currentUserData   = user;
      currentRationCard = user.ration_card;
      errEl.style.display = "none";
      loginOTPAttempts    = 0;

      // Step 2: Check for existing valid OTP in database
      // Valid = is_used is FALSE AND expires_at is in future
      let otpToShow    = null;
      let isReused     = false;
      let remainingSec = 86400;

      try {
        const nowTs = new Date().toISOString();

        const { data: existRows, error: fetchErr } = await db
          .from("otp_logs")
          .select("otp_code, expires_at, is_used, created_at")
          .eq("ration_card", card)
          .eq("purpose",     "login")
          .order("created_at", { ascending: false })
          .limit(10); // Get last 10 — filter in JS

        if (fetchErr) {
          console.log("OTP fetch error:", fetchErr.message);
        }

        console.log("All recent OTPs:", existRows);

        // Filter: not used AND not expired
        const validOtp = existRows
          ? existRows.find(r =>
              r.is_used === false &&
              new Date(r.expires_at) > new Date()
            )
          : null;

        console.log("Valid OTP found:", validOtp);

        if (validOtp) {
          // ✅ Reuse existing OTP
          otpToShow = validOtp.otp_code;
          isReused  = true;

          const diffMs   =
            new Date(validOtp.expires_at) - new Date();
          remainingSec   = Math.floor(diffMs / 1000);
          const diffHrs  = Math.floor(diffMs / 3600000);
          const diffMins =
            Math.floor((diffMs % 3600000) / 60000);

          // Show reuse notice
          const notice =
            document.getElementById("otpReuseNotice");
          if (notice) {
            notice.style.display = "block";
            notice.innerHTML = `
              <div style="background:#f0fdf4;
                          border:1px solid #bbf7d0;
                          border-radius:8px;
                          padding:8px 12px;
                          font-size:11px;
                          color:#15803d;
                          margin-bottom:8px;
                          text-align:center">
                ♻️ <strong>Your existing OTP is reused.</strong>
                Valid for another
                <strong>${diffHrs}h ${diffMins}m</strong>.
                No new OTP generated.
              </div>`;
          }

          console.log(`♻️ Reusing OTP: ${otpToShow}
            (${diffHrs}h ${diffMins}m left)`);

        } else {
          // ✅ No valid OTP — generate fresh one
          otpToShow = Math.floor(
            100000 + Math.random() * 900000
          ).toString();
          isReused  = false;

          const exp = new Date();
          exp.setHours(exp.getHours() + 24);

          const { error: insErr } = await db
            .from("otp_logs")
            .insert([{
              ration_card: card,
              otp_code:    otpToShow,
              purpose:     "login",
              is_used:     false,
              expires_at:  exp.toISOString()
            }]);

          if (insErr) {
            console.log("OTP insert error:", insErr.message);
          }

          // Clear reuse notice
          const notice =
            document.getElementById("otpReuseNotice");
          if (notice) {
            notice.style.display = "block";
            notice.innerHTML = `
              <div style="background:#eff6ff;
                          border:1px solid #bfdbfe;
                          border-radius:8px;
                          padding:8px 12px;
                          font-size:11px;
                          color:#1565c0;
                          margin-bottom:8px;
                          text-align:center">
                🔄 <strong>New OTP generated.</strong>
                Valid for 24 hours.
              </div>`;
          }

          console.log(`🔄 New OTP generated: ${otpToShow}`);
          remainingSec = 86400;
        }

      } catch(e) {
        console.log("OTP check error:", e.message);
        // Fallback: generate new OTP
        otpToShow = Math.floor(
          100000 + Math.random() * 900000
        ).toString();
        remainingSec = 86400;
      }

      // Store OTP globally
      loginOTP = otpToShow;

      // Show OTP on screen
      const otpDisplay =
        document.getElementById("loginOtpDisplay");
      if (otpDisplay) otpDisplay.textContent = loginOTP;

      // Clear input field
      const otpInput =
        document.getElementById("loginOtpInput");
      if (otpInput) otpInput.value = "";

      // Switch to OTP step
      const step1 = document.getElementById("loginStep1");
      const step2 = document.getElementById("loginStep2");
      if (step1) step1.style.display = "none";
      if (step2) step2.style.display = "block";

      // Start countdown timer
      startLoginOTPTimer(remainingSec);

      sendOtpBtn.disabled    = false;
      sendOtpBtn.textContent = "📱 Send OTP & Login";
    })
  }

  // Resend OTP — reuses existing if still valid within 24hrs
  const resendBtn = document.getElementById("resendLoginOtpBtn");
  if (resendBtn) {
    resendBtn.addEventListener("click", async () => {
      loginOTPAttempts = 0;

      const nowTs = new Date().toISOString();
      const { data: existOtp } = await db
        .from("otp_logs")
        .select("*")
        .eq("ration_card", currentRationCard)
        .eq("purpose",     "login")
        .eq("is_used",     false)
        .gt("expires_at",  nowTs)
        .order("created_at", { ascending: false })
        .limit(1);

      if (existOtp && existOtp[0]) {
        // ✅ Reuse existing valid OTP
        loginOTP = existOtp[0].otp_code;

        const diffMs   =
          new Date(existOtp[0].expires_at) - new Date();
        const diffHrs  = Math.floor(diffMs / 3600000);
        const diffMins =
          Math.floor((diffMs % 3600000) / 60000);
        const remainSec = Math.floor(diffMs / 1000);

        const notice =
          document.getElementById("otpReuseNotice");
        if (notice) {
          notice.style.display = "block";
          notice.innerHTML = `
            <div style="background:#f0fdf4;
                        border:1px solid #bbf7d0;
                        border-radius:8px;padding:8px 12px;
                        font-size:11px;color:#15803d;
                        margin-bottom:8px">
              ♻️ Your OTP is still valid for
              <strong>${diffHrs}h ${diffMins}m</strong>.
              Same OTP shown below.
            </div>`;
        }

        startLoginOTPTimer(remainSec);

      } else {
        // Generate new OTP (previous expired)
        loginOTP = Math.floor(
          100000 + Math.random() * 900000
        ).toString();

        const exp = new Date();
        exp.setHours(exp.getHours() + 24);

        await db.from("otp_logs").insert([{
          ration_card: currentRationCard,
          otp_code:    loginOTP,
          purpose:     "login",
          is_used:     false,
          expires_at:  exp.toISOString()
        }]);

        const notice =
          document.getElementById("otpReuseNotice");
        if (notice) {
          notice.style.display = "block";
          notice.innerHTML = `
            <div style="background:#eff6ff;
                        border:1px solid #bfdbfe;
                        border-radius:8px;padding:8px 12px;
                        font-size:11px;color:#1565c0;
                        margin-bottom:8px">
              🔄 New OTP generated. Valid for 24 hours.
            </div>`;
        }

        startLoginOTPTimer(86400);
      }

      document.getElementById("loginOtpDisplay")
        .textContent = loginOTP;
      document.getElementById("loginOtpInput").value = "";
      document.getElementById("loginOtpTimer")
        .style.color = "#e65100";
    });
  }

  // Verify OTP
  const verifyBtn =
    document.getElementById("verifyLoginOtpBtn");
  if (verifyBtn) {
    verifyBtn.addEventListener("click", async () => {
      const entered =
        document.getElementById("loginOtpInput").value.trim();
      const errEl   =
        document.getElementById("loginOtpError");
      if (!entered||entered.length!==6) {
        errEl.style.display="block";
        errEl.textContent="⚠️ Enter 6-digit OTP."; return;
      }
      loginOTPAttempts++;
      if (loginOTPAttempts>MAX_OTP_ATTEMPTS) {
        errEl.style.display="block";
        errEl.textContent="❌ Too many attempts."; return;
      }
      if (entered!==loginOTP) {
        errEl.style.display="block";
        errEl.textContent=`❌ Wrong OTP. `+
          `${MAX_OTP_ATTEMPTS-loginOTPAttempts} left.`;
        return;
      }
      // Save OTP for dealer verification at collection
      // Do NOT mark is_used=true yet — dealer still needs it
      // OTP will be marked used AFTER dealer verifies collection
      currentUserOTP = entered;

      // Do NOT update otp_logs here — keep it valid for dealer
      clearInterval(loginOTPTimer);
      loginOTP = "";
      errEl.style.display = "none";
      getGeoLocation(currentRationCard);
      enterDashboard(currentUserData);
    });
  }

  // ── Book Token ──────────────────────────────────────────
  const bookTokenBtn=document.getElementById("bookTokenBtn");
  if (bookTokenBtn) {
    bookTokenBtn.addEventListener("click", async () => {
      const dealerId =
        document.getElementById("shopSelect").value;
      const msg = document.getElementById("bookingMsg");
      if (!dealerId) {
        showMsg(msg,"⚠️ Select a shop.","red"); return;
      }

      const today = new Date().toISOString().split("T")[0];

      // Block booking if shop is closed today
      const { data: inconvCheck } = await db
        .from("dealer_inconvenience")
        .select("id,reason")
        .eq("dealer_id",  dealerId)
        .eq("status",     "approved")
        .eq("affect_date", today)
        .limit(1);

      const { data: closureCheck } = await db
        .from("shop_closures")
        .select("id,reason")
        .eq("dealer_id",    dealerId)
        .eq("is_active",    true)
        .eq("closure_date", today)
        .limit(1);

      if ((inconvCheck && inconvCheck.length > 0) ||
          (closureCheck && closureCheck.length > 0)) {
        const reason = inconvCheck?.[0]?.reason ||
                       closureCheck?.[0]?.reason ||
                       "Inconvenience / Closure";
        showMsg(msg,
          `🔴 This shop is CLOSED today. Reason: ${reason}. ` +
          `Please select a different open shop.`,
          "red");
        await loadShops();
        return;
      }
      const {data:ex} = await db.from("tokens").select("*")
        .eq("ration_card",currentRationCard)
        .eq("date",today).limit(1);
      if (ex&&ex[0]) {
        showMsg(msg,
          `⚠️ Already booked Token #${ex[0].token_number}!`,
          "orange");
        checkMyToken(); return;
      }
      const {data:dr} = await db.from("dealers").select("*")
        .eq("dealer_id",dealerId).limit(1);
      const dealer = dr&&dr[0] ? dr[0] : null;
      const {data:todayT} = await db.from("tokens").select("*")
        .eq("date",today).eq("dealer_id",dealerId);
      const nextNum = (todayT?todayT.length:0)+1;
      const estTime = new Date();
      estTime.setMinutes(estTime.getMinutes()+(nextNum-1)*10);
      const estStr  = estTime.toLocaleTimeString("en-IN",
        {hour:"2-digit",minute:"2-digit"});
      // Get selected member details
      const selMemberId =
        document.getElementById("selectedMemberId") ?
        document.getElementById("selectedMemberId").value : "";
      const selMemberName =
        document.getElementById("selectedMemberName") ?
        document.getElementById("selectedMemberName").value : "";
      const selMemberPhoto =
        document.getElementById("selectedMemberPhoto") ?
        document.getElementById("selectedMemberPhoto").value : "";

      if (!selMemberName) {
        showMsg(msg,
          "⚠️ Select family member who will collect ration.",
          "red");
        return;
      }

      // Insert token WITH selected member + login OTP
      const {error} = await db.from("tokens").insert([{
        token_number:             nextNum,
        ration_card:              currentRationCard,
        dealer_id:                dealerId,
        queue_position:           nextNum,
        estimated_time:           estStr,
        booked_at:                new Date().toISOString(),
        status:                   "waiting",
        date:                     today,
        shop_name:                dealer ? dealer.shop_name : "",
        locality:                 dealer ? dealer.locality  : "",
        collecting_member_id:     selMemberId,
        collecting_member_name:   selMemberName,
        collecting_member_photo:  selMemberPhoto,
        login_otp:                currentUserOTP // Same OTP used at dealer
      }]);

      if (error) {
        showMsg(msg,"❌ "+error.message,"red"); return;
      }
      showMsg(msg,
        `✅ Token #${String(nextNum).padStart(3,"0")} booked! `+
        `Collector: ${selMemberName} | `+
        `Queue: ${nextNum} | Est: ${estStr}`,"green");
      checkMyToken();
    });
  }

  // ── Cancel Token ────────────────────────────────────────
  const cancelBtn=document.getElementById("cancelTokenBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", async () => {
      const today=new Date().toISOString().split("T")[0];
      const {data:rows}=await db.from("tokens").select("*")
        .eq("ration_card",currentRationCard)
        .eq("date",today).limit(1);
      const data=rows&&rows[0]?rows[0]:null;
      if (!data) return;
      if (data.status==="serving"||
          data.status==="completed") {
        alert("❌ Cannot cancel."); return;
      }
      await db.from("tokens")
        .update({status:"cancelled"}).eq("id",data.id);
      document.getElementById("myTokenBox")
        .style.display="none";
      document.getElementById("tokenBookingBox")
        .style.display="block";
      showMsg(document.getElementById("bookingMsg"),
        "🚫 Token cancelled.","red");
    });
  }

  // ── Stock Report ────────────────────────────────────────
  const reportBtn=document.getElementById("submitReportBtn");
  if (reportBtn) {
    reportBtn.addEventListener("click", async () => {
      const item=document.getElementById("reportItem").value;
      const qty =document.getElementById("reportQty").value;
      const msg =document.getElementById("reportMsg");
      if (!qty||qty<=0) {
        showMsg(msg,"⚠️ Enter valid quantity.","red"); return;
      }
      const {error}=await db.from("stock_reports").insert([{
        ration_card:currentRationCard,item,
        quantity_received:qty
      }]);
      if (error) { showMsg(msg,"❌ "+error.message,"red"); }
      else {
        showMsg(msg,"✅ Report submitted!","green");
        document.getElementById("reportQty").value="";
      }
    });
  }

  // ── Logout ──────────────────────────────────────────────
  const logoutBtn=document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      currentRationCard="";
      currentUserData=null;
      loginOTP="";
      clearInterval(loginOTPTimer);
      const lrc=document.getElementById("loginRationCard");
      const la =document.getElementById("loginAadhaar");
      if (lrc) lrc.value="";
      if (la)  la.value="";
      const s1=document.getElementById("loginStep1");
      const s2=document.getElementById("loginStep2");
      if (s1) s1.style.display="block";
      if (s2) s2.style.display="none";
      showPage("landingPage");
    });
  }

  // ── Modal Close ─────────────────────────────────────────
  const closeModal=document.getElementById("closeModal");
  if (closeModal) {
    closeModal.addEventListener("click",()=>{
      document.getElementById("memberModal")
        .style.display="none";
      document.getElementById("modalOverlay")
        .style.display="none";
    });
  }
  const modalOverlay=document.getElementById("modalOverlay");
  if (modalOverlay) {
    modalOverlay.addEventListener("click",()=>{
      document.getElementById("memberModal")
        .style.display="none";
      document.getElementById("modalOverlay")
        .style.display="none";
    });
  }

}); // END DOMContentLoaded