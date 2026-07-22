const SITE_CATALOG = [
  { name: "Data Annotation", url: "https://www.dataannotation.tech" },
  { name: "Prolific", url: "https://app.prolific.com" },
  { name: "Cloud Connect", url: "https://www.cloudconnect.com" },
  { name: "PaidViewpoint", url: "https://paidviewpoint.com" },
  { name: "Verasight", url: "https://www.verasight.co" },
  { name: "Clickworker", url: "https://www.clickworker.com" },
  { name: "Cloud Research", url: "https://www.cloudresearch.com" },
  { name: "Mercor", url: "https://work.mercor.com" },
  { name: "Micro1 Jobs", url: "https://jobs.micro1.ai" },
  { name: "Scale / Outlier", url: "https://outlier.ai" },
  { name: "Invisible", url: "https://www.invisible.co" },
  { name: "Alignerr", url: "https://www.alignerr.com" },
  { name: "Dscout", url: "https://dscout.com" },
  { name: "SerpClix", url: "https://serpclix.com" }
];

const SITE_BASELINES = {
  "Data Annotation": { reward: 8.0, minutes: 30 },
  Prolific: { reward: 2.5, minutes: 8 },
  "Cloud Connect": { reward: 4.0, minutes: 15 },
  PaidViewpoint: { reward: 1.5, minutes: 10 },
  Verasight: { reward: 3.0, minutes: 12 },
  Clickworker: { reward: 5.0, minutes: 25 },
  "Cloud Research": { reward: 3.5, minutes: 15 },
  Mercor: { reward: 20.0, minutes: 60 },
  "Micro1 Jobs": { reward: 15.0, minutes: 45 },
  "Scale / Outlier": { reward: 12.0, minutes: 40 },
  Invisible: { reward: 10.0, minutes: 35 },
  Alignerr: { reward: 9.0, minutes: 30 },
  Dscout: { reward: 30.0, minutes: 60 },
  SerpClix: { reward: 0.6, minutes: 3 }
};

const STORAGE_KEY = "surveyAgent.opportunities.v1";
const SETTINGS_KEY = "surveyAgent.settings.v1";

const DEFAULT_SETTINGS = {
  rankingMode: "time-money",
  autoScoutOnLoad: true,
  weightRate: 0.55,
  weightApproval: 30,
  weightPayout: 10,
  weightFriction: 8,
  minimumScore: 20
};

const form = document.getElementById("surveyForm");
const weightsForm = document.getElementById("weightsForm");
const siteSelect = document.getElementById("site");
const tableBody = document.getElementById("rankedTableBody");
const siteRankBody = document.getElementById("siteRankBody");
const cards = document.getElementById("siteCards");
const queue = document.getElementById("agentQueue");
const runAutoScoutBtn = document.getElementById("runAutoScout");
const autoScoutStatus = document.getElementById("autoScoutStatus");
const autoScoutOnLoadCheckbox = document.getElementById("autoScoutOnLoad");
const manualEntryPanel = document.getElementById("manualEntryPanel");
const toggleManualEntryBtn = document.getElementById("toggleManualEntry");
const wgCheck = document.getElementById("wgCheck");
const preflightCard = document.getElementById("preflightCard");
const preflightStatus = document.getElementById("preflightStatus");
const rankingModeSelect = document.getElementById("rankingMode");
const prolificGateStatus = document.getElementById("prolificGateStatus");

const state = {
  opportunities: loadOpportunities(),
  settings: loadSettings()
};

let scoutIsRunning = false;

init();

function init() {
  populateSites();
  hydrateSettingsForm();
  hydrateAutoScoutControls();
  wireUpPreflight();
  wireUpHandlers();
  render();

  if (state.settings.autoScoutOnLoad) {
    void handleAutoScout();
  }
}

function wireUpHandlers() {
  form.addEventListener("submit", handleCreateOpportunity);
  weightsForm.addEventListener("submit", handleSaveSettings);
  runAutoScoutBtn?.addEventListener("click", handleAutoScout);
  autoScoutOnLoadCheckbox?.addEventListener("change", handleAutoScoutOnLoadChange);
  toggleManualEntryBtn?.addEventListener("click", toggleManualEntry);
  document.addEventListener("click", handleOpenSiteClick);
  document.addEventListener("click", handleFallbackLinkGuard, true);
}

function handleAutoScoutOnLoadChange() {
  if (!autoScoutOnLoadCheckbox) {
    return;
  }

  state.settings.autoScoutOnLoad = autoScoutOnLoadCheckbox.checked;
  persistSettings(state.settings);
}

function toggleManualEntry() {
  if (!manualEntryPanel || !toggleManualEntryBtn) {
    return;
  }

  const hidden = manualEntryPanel.hasAttribute("hidden");
  if (hidden) {
    manualEntryPanel.removeAttribute("hidden");
    toggleManualEntryBtn.textContent = "Hide Manual Entry";
    return;
  }

  manualEntryPanel.setAttribute("hidden", "");
  toggleManualEntryBtn.textContent = "Show Manual Entry (Optional)";
}

function hydrateAutoScoutControls() {
  if (autoScoutOnLoadCheckbox) {
    autoScoutOnLoadCheckbox.checked = state.settings.autoScoutOnLoad;
  }
}

async function handleAutoScout() {
  if (scoutIsRunning) {
    return;
  }

  scoutIsRunning = true;
  if (runAutoScoutBtn) {
    runAutoScoutBtn.disabled = true;
  }

  setScoutStatus("Scanning public pages...");

  const found = [];

  for (const site of SITE_CATALOG) {
    setScoutStatus(`Scanning ${site.name}...`);
    const siteItems = await scoutSite(site);
    found.push(...siteItems);
  }

  if (found.length > 0) {
    state.opportunities = mergeOpportunities(state.opportunities, found);
    persistOpportunities(state.opportunities);
    render();
    setScoutStatus(`Scout complete: added ${found.length} opportunities.`);
  } else {
    setScoutStatus("Scout complete: no public payout/time items detected.");
  }

  scoutIsRunning = false;
  if (runAutoScoutBtn) {
    runAutoScoutBtn.disabled = false;
  }
}

function setScoutStatus(message) {
  if (!autoScoutStatus) {
    return;
  }
  autoScoutStatus.textContent = message;
}

async function scoutSite(site) {
  let timeoutId;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 2500);
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(site.url)}`;
    const response = await fetch(proxyUrl, {
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const parsed = extractPayoutTimeItems(site, html).slice(0, 5);
    if (parsed.length > 0) {
      return parsed;
    }
    return fallbackFromBaseline(site);
  } catch {
    clearTimeout(timeoutId);
    return fallbackFromBaseline(site);
  }
}

function fallbackFromBaseline(site) {
  const baseline = SITE_BASELINES[site.name];
  if (!baseline) {
    return [];
  }

  return [{
    id: crypto.randomUUID(),
    site: site.name,
    title: "Baseline estimate (replace with live listing after login)",
    reward: baseline.reward,
    minutes: baseline.minutes,
    approval: 65,
    payout: 3,
    friction: 3,
    createdAt: Date.now()
  }];
}

function extractPayoutTimeItems(site, html) {
  const text = stripHtml(html)
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return [];
  }

  const chunks = text
    .split(/(?<=[.!?])\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 20 && value.length <= 220);

  const items = [];

  for (const chunk of chunks) {
    const parsed = parsePayoutAndTime(chunk);
    if (!parsed) {
      continue;
    }

    const { reward, minutes } = parsed;
    if (!Number.isFinite(reward) || !Number.isFinite(minutes)) {
      continue;
    }
    if (reward <= 0 || reward > 500 || minutes <= 0 || minutes > 240) {
      continue;
    }

    const title = chunk.slice(0, 90);
    items.push({
      id: crypto.randomUUID(),
      site: site.name,
      title,
      reward,
      minutes,
      approval: 70,
      payout: 3,
      friction: 3,
      createdAt: Date.now()
    });
  }

  return dedupeByKey(items);
}

function parsePayoutAndTime(chunk) {
  const normalized = chunk.replace(/,/g, "");
  const minutesMatch = normalized.match(/(\d{1,3})\s?(?:min|mins|minute|minutes)\b/i);

  // Matches values like $3.50, USD 3.50, £2.10, EUR 4.00, or ranges like $2-$4.
  const moneyRangeMatch = normalized.match(/(?:\$|usd\s?|eur\s?|gbp\s?|£|€)\s?(\d+(?:\.\d{1,2})?)\s?(?:-|to)\s?(?:\$|usd\s?|eur\s?|gbp\s?|£|€)?\s?(\d+(?:\.\d{1,2})?)/i);
  const moneySingleMatch = normalized.match(/(?:\$|usd\s?|eur\s?|gbp\s?|£|€)\s?(\d+(?:\.\d{1,2})?)/i);
  const hourlyMatch = normalized.match(/(?:\$|usd\s?|eur\s?|gbp\s?|£|€)\s?(\d+(?:\.\d{1,2})?)\s?(?:\/|per\s)(?:hour|hr)\b/i);

  let minutes = minutesMatch ? Number.parseInt(minutesMatch[1], 10) : NaN;
  let reward = NaN;

  if (moneyRangeMatch) {
    const low = Number.parseFloat(moneyRangeMatch[1]);
    const high = Number.parseFloat(moneyRangeMatch[2]);
    reward = (low + high) / 2;
  } else if (moneySingleMatch) {
    reward = Number.parseFloat(moneySingleMatch[1]);
  }

  // If only hourly payout is found, estimate reward using minutes if present.
  if ((!Number.isFinite(reward) || reward <= 0) && hourlyMatch && Number.isFinite(minutes) && minutes > 0) {
    const hourly = Number.parseFloat(hourlyMatch[1]);
    reward = (hourly * minutes) / 60;
  }

  // If reward exists but minutes are missing, use a conservative default survey duration.
  if (!Number.isFinite(minutes) && Number.isFinite(reward) && reward > 0) {
    minutes = 20;
  }

  if (!Number.isFinite(reward) || !Number.isFinite(minutes)) {
    return null;
  }

  return { reward, minutes };
}

function stripHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function mergeOpportunities(existing, incoming) {
  return dedupeByKey([...incoming, ...existing]);
}

function dedupeByKey(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = [
      item.site,
      item.title.trim().toLowerCase(),
      item.reward.toFixed(2),
      String(item.minutes)
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function handleCreateOpportunity(event) {
  event.preventDefault();

  const opportunity = {
    id: crypto.randomUUID(),
    site: document.getElementById("site").value,
    title: document.getElementById("title").value.trim(),
    reward: Number(document.getElementById("reward").value),
    minutes: Number(document.getElementById("minutes").value),
    approval: Number(document.getElementById("approval").value),
    payout: Number(document.getElementById("payout").value),
    friction: Number(document.getElementById("friction").value),
    createdAt: Date.now()
  };

  if (!validateOpportunity(opportunity)) {
    return;
  }

  state.opportunities.push(opportunity);
  persistOpportunities(state.opportunities);
  form.reset();
  render();
}

function handleSaveSettings(event) {
  event.preventDefault();

  state.settings = {
    rankingMode: rankingModeSelect.value,
    weightRate: Number(document.getElementById("weightRate").value),
    weightApproval: Number(document.getElementById("weightApproval").value),
    weightPayout: Number(document.getElementById("weightPayout").value),
    weightFriction: Number(document.getElementById("weightFriction").value),
    minimumScore: Number(document.getElementById("minimumScore").value)
  };

  persistSettings(state.settings);
  render();
}

function handleOpenSiteClick(event) {
  const button = event.target.closest(".open-site");
  if (!button) {
    return;
  }

  const url = button.dataset.url;
  if (!url) {
    return;
  }

  if (!wgCheck.checked) {
    alert("Confirm WireGuard preflight before opening platform links.");
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function handleFallbackLinkGuard(event) {
  const anchor = event.target.closest("a[data-platform-link='1']");
  if (!anchor) {
    return;
  }

  if (!wgCheck.checked) {
    event.preventDefault();
    event.stopPropagation();
    alert("Confirm WireGuard preflight before opening platform links.");
  }
}

function populateSites() {
  SITE_CATALOG.forEach((site) => {
    const option = document.createElement("option");
    option.value = site.name;
    option.textContent = site.name;
    siteSelect.appendChild(option);
  });
}

function hydrateSettingsForm() {
  rankingModeSelect.value = state.settings.rankingMode;
  document.getElementById("weightRate").value = String(state.settings.weightRate);
  document.getElementById("weightApproval").value = String(state.settings.weightApproval);
  document.getElementById("weightPayout").value = String(state.settings.weightPayout);
  document.getElementById("weightFriction").value = String(state.settings.weightFriction);
  document.getElementById("minimumScore").value = String(state.settings.minimumScore);
}

function wireUpPreflight() {
  updatePreflightUi();
  wgCheck.addEventListener("change", () => {
    updatePreflightUi();
    render();
  });
}

function updatePreflightUi() {
  const ready = wgCheck.checked;
  preflightCard.classList.toggle("preflight-ready", ready);
  preflightCard.classList.toggle("preflight-not-ready", !ready);
  preflightStatus.textContent = ready
    ? "Status: Confirmed - site actions enabled"
    : "Status: Not confirmed - site actions locked";
  updateProlificGateStatus(ready);
  applyNavigationLock();
}

function updateProlificGateStatus(ready) {
  if (!prolificGateStatus) {
    return;
  }

  prolificGateStatus.textContent = ready
    ? "Unlocked: Prolific can be opened"
    : "Locked: confirm WireGuard first";
  prolificGateStatus.classList.toggle("prolific-ready", ready);
  prolificGateStatus.classList.toggle("prolific-locked", !ready);
}

function applyNavigationLock() {
  const locked = !wgCheck.checked;
  const actionButtons = document.querySelectorAll(".open-site");

  actionButtons.forEach((button) => {
    button.disabled = locked;
    button.setAttribute("aria-disabled", String(locked));
    button.title = locked
      ? "Enable WireGuard preflight to unlock this action"
      : "Open site";
  });
}

function validateOpportunity(item) {
  if (!item.title) {
    alert("Please enter a title.");
    return false;
  }
  if (item.minutes <= 0 || item.reward < 0) {
    alert("Reward and minutes must be valid numbers.");
    return false;
  }
  return true;
}

function scoreOpportunity(item) {
  const hourlyRate = item.minutes > 0 ? (item.reward / item.minutes) * 60 : 0;
  const approvalFactor = item.approval / 100;
  const payoutFactor = item.payout / 5;
  const frictionPenalty = item.friction / 5;

  const score =
    hourlyRate * state.settings.weightRate +
    approvalFactor * state.settings.weightApproval +
    payoutFactor * state.settings.weightPayout -
    frictionPenalty * state.settings.weightFriction;

  return {
    ...item,
    hourlyRate,
    score: Math.max(score, 0)
  };
}

function timeMoneyRankValue(item) {
  return item.hourlyRate * 1000 + item.reward;
}

function getRankValue(item) {
  return state.settings.rankingMode === "time-money"
    ? timeMoneyRankValue(item)
    : item.score;
}

function getRanked() {
  return state.opportunities
    .map(scoreOpportunity)
    .sort((a, b) => getRankValue(b) - getRankValue(a));
}

function bestPerSite(ranked) {
  const map = new Map();
  ranked.forEach((item) => {
    if (!map.has(item.site)) {
      map.set(item.site, item);
    }
  });
  return map;
}

function buildQueue(siteWinners) {
  const items = Array.from(siteWinners.values())
    .filter((item) => item.score >= state.settings.minimumScore)
    .sort((a, b) => getRankValue(b) - getRankValue(a));

  return items;
}

function render() {
  const ranked = getRanked();
  const siteWinners = bestPerSite(ranked);
  const nextBestQueue = buildQueue(siteWinners);

  renderQueue(nextBestQueue);
  renderSiteLeaderboard(siteWinners);
  renderCards(siteWinners);
  renderTable(ranked);
  applyNavigationLock();
}

function renderSiteLeaderboard(siteWinners) {
  siteRankBody.innerHTML = "";

  const sortedSites = SITE_CATALOG
    .map((site) => ({
      site,
      best: siteWinners.get(site.name) || null
    }))
    .sort((a, b) => {
      const left = a.best ? getRankValue(a.best) : -1;
      const right = b.best ? getRankValue(b.best) : -1;
      return right - left;
    });

  sortedSites.forEach(({ site, best }) => {
    const row = document.createElement("tr");

    if (!best) {
      row.innerHTML = `
        <td>${escapeHtml(site.name)}</td>
        <td>No survey logged yet</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td><button class="open-site" data-url="${escapeHtml(site.url)}">Open Site</button></td>
      `;
      siteRankBody.appendChild(row);
      return;
    }

    row.innerHTML = `
      <td>${escapeHtml(site.name)}</td>
      <td>${escapeHtml(best.title)}</td>
      <td>$${best.reward.toFixed(2)}</td>
      <td>${best.minutes}</td>
      <td>$${best.hourlyRate.toFixed(2)}</td>
      <td>${best.score.toFixed(2)}</td>
      <td><button class="open-site" data-url="${escapeHtml(site.url)}">Open Site</button></td>
    `;

    siteRankBody.appendChild(row);
  });
}

function renderQueue(nextBestQueue) {
  queue.innerHTML = "";

  if (nextBestQueue.length === 0) {
    const empty = document.createElement("p");
    empty.className = "queue-empty";
    empty.textContent = "No opportunities meet your minimum score yet. Add more or lower minimum score.";
    queue.appendChild(empty);
    return;
  }

  nextBestQueue.forEach((item, index) => {
    const wrap = document.createElement("article");
    wrap.className = "queue-item";

    const why = buildReason(item);
    wrap.innerHTML = `
      <div>
        <p class="queue-rank">Priority ${index + 1}</p>
        <h3>${escapeHtml(item.site)}: ${escapeHtml(item.title)}</h3>
        <p>${item.minutes} min · $${item.reward.toFixed(2)} · $${item.hourlyRate.toFixed(2)}/hr</p>
        <p class="queue-why">${escapeHtml(why)}</p>
      </div>
      <div class="queue-actions">
        <p class="score">Score: ${item.score.toFixed(2)}</p>
        <p class="queue-metric">Rank metric: ${renderMetric(item)}</p>
        <button class="open-site" data-url="${escapeHtml(getSiteUrl(item.site))}">Open Site</button>
      </div>
    `;

    queue.appendChild(wrap);
  });
}

function renderMetric(item) {
  if (state.settings.rankingMode === "time-money") {
    return `$${item.hourlyRate.toFixed(2)}/hr`;
  }
  return item.score.toFixed(2);
}

function buildReason(item) {
  const reasons = [];
  if (item.hourlyRate >= 20) {
    reasons.push("strong hourly rate");
  }
  if (item.approval >= 80) {
    reasons.push("high approval odds");
  }
  if (item.payout >= 4) {
    reasons.push("fast payout");
  }
  if (reasons.length === 0) {
    reasons.push("balanced score across criteria");
  }
  return `Why now: ${reasons.join(", ")}.`;
}

function renderCards(siteWinners) {
  cards.innerHTML = "";

  SITE_CATALOG.forEach((site, index) => {
    const winner = siteWinners.get(site.name);
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${index * 28}ms`;

    if (!winner) {
      card.innerHTML = `
        <h3>${escapeHtml(site.name)}</h3>
        <p>No opportunities logged yet.</p>
        <button class="open-site" data-url="${escapeHtml(site.url)}">Open site</button>
      `;
      cards.appendChild(card);
      return;
    }

    card.innerHTML = `
      <h3>${escapeHtml(site.name)}</h3>
      <p><strong>${escapeHtml(winner.title)}</strong></p>
      <p>$${winner.reward.toFixed(2)} in ${winner.minutes} min ($${winner.hourlyRate.toFixed(2)}/hr)</p>
      <p>Approval: ${winner.approval}% | Payout: ${winner.payout}/5 | Friction: ${winner.friction}/5</p>
      <p class="score">Score: ${winner.score.toFixed(2)}</p>
      <button class="open-site" data-url="${escapeHtml(site.url)}">Open site</button>
    `;

    cards.appendChild(card);
  });
}

function renderTable(ranked) {
  tableBody.innerHTML = "";

  if (ranked.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = "<td colspan=\"8\">No opportunities yet. Add one above to start ranking.</td>";
    tableBody.appendChild(row);
    return;
  }

  ranked.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(item.site)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>$${item.reward.toFixed(2)}</td>
      <td>${item.minutes}</td>
      <td>$${item.hourlyRate.toFixed(2)}</td>
      <td>${item.approval}%</td>
      <td>${item.score.toFixed(2)}</td>
    `;
    tableBody.appendChild(row);
  });
}

function getSiteUrl(siteName) {
  const found = SITE_CATALOG.find((site) => site.name === siteName);
  return found ? found.url : "about:blank";
}

function loadOpportunities() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistOpportunities(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(raw);
    return {
      rankingMode: parsed.rankingMode === "balanced" ? "balanced" : "time-money",
      autoScoutOnLoad: parsed.autoScoutOnLoad !== false,
      weightRate: coalesceNumber(parsed.weightRate, DEFAULT_SETTINGS.weightRate),
      weightApproval: coalesceNumber(parsed.weightApproval, DEFAULT_SETTINGS.weightApproval),
      weightPayout: coalesceNumber(parsed.weightPayout, DEFAULT_SETTINGS.weightPayout),
      weightFriction: coalesceNumber(parsed.weightFriction, DEFAULT_SETTINGS.weightFriction),
      minimumScore: coalesceNumber(parsed.minimumScore, DEFAULT_SETTINGS.minimumScore)
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function coalesceNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
