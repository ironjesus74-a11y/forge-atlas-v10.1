// Fight Club Phase 1 — Browser logic
// Local-only leaderboard. No fake global stats.

const QUICK_BATTLES = [
  { id: "todo-app", prompt: "Build a React todo app with add and delete buttons", category: "Frontend" },
  { id: "api-server", prompt: "Build a Node.js Express API with GET /users and POST /users endpoints", category: "Backend" },
  { id: "calculator", prompt: "Build a JavaScript calculator with add, subtract, multiply, and divide operations", category: "JavaScript" },
  { id: "form-validation", prompt: "Build an HTML form with email, password, and submit validation", category: "Frontend" },
  { id: "landing-hero", prompt: "Build a cinematic landing page hero section with headline, CTA, and feature badges", category: "Website UI" },
  { id: "pricing-table", prompt: "Build a responsive pricing table with three plans and a highlighted recommended plan", category: "SaaS UI" },
  { id: "game-scoreboard", prompt: "Build a simple game scoreboard UI with two players, scores, and reset button", category: "Game UI" },
  { id: "data-card", prompt: "Build a dashboard stat card component with trend indicator and accessible labels", category: "Dashboard" },
  { id: "accessibility-fix", prompt: "Build an accessible modal dialog with keyboard focus handling and close controls", category: "Accessibility" },
  { id: "music-ui", prompt: "Build a music player UI with play button, progress bar, track title, and queue list", category: "Music UI" },
  { id: "image-gallery", prompt: "Build an image gallery layout with filters, captions, and responsive cards", category: "Image UI" }
];

let currentBattle = null;
let leaderboard = {};
let activeCategory = "All";

document.addEventListener("DOMContentLoaded", () => {
  loadLeaderboard();
  renderCategoryFilters();
  renderQuickBattles();
  setupModeSelector();
  setupCustomForm();
  setupVoteButtons();
  setupNewBattleButton();
  setupResetLocalDataButton();
  renderMatchHistory();
});

function byId(id) {
  return document.getElementById(id);
}

function loadLeaderboard() {
  try {
    leaderboard = JSON.parse(localStorage.getItem("fc_leaderboard") || "{}");
  } catch {
    leaderboard = {};
  }
  updateLeaderboardDisplay();
}

function saveLeaderboard() {
  localStorage.setItem("fc_leaderboard", JSON.stringify(leaderboard));
  updateLeaderboardDisplay();
}

function renderCategoryFilters() {
  const bar = byId("categoryFilterBar");
  if (!bar) return;

  const categories = ["All", ...new Set(QUICK_BATTLES.map((battle) => battle.category))];
  bar.textContent = "";

  categories.forEach((category) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = category === activeCategory ? "fc-filter-chip active" : "fc-filter-chip";
    chip.textContent = category;
    chip.addEventListener("click", () => {
      activeCategory = category;
      renderCategoryFilters();
      renderQuickBattles();
    });
    bar.appendChild(chip);
  });
}

function renderQuickBattles() {
  const container = byId("quickBattlesList");
  container.textContent = "";

  const visibleBattles = activeCategory === "All"
    ? QUICK_BATTLES
    : QUICK_BATTLES.filter((battle) => battle.category === activeCategory);

  visibleBattles.forEach((battle) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "fc-quick-item";

    const title = document.createElement("h4");
    title.textContent = battle.category;

    const prompt = document.createElement("p");
    prompt.textContent = battle.prompt;

    const tag = document.createElement("span");
    tag.className = "fc-category";
    tag.textContent = "Quick Battle";

    card.append(title, prompt, tag);
    card.addEventListener("click", () => startBattle(battle.id, false));
    container.appendChild(card);
  });
}

function setupModeSelector() {
  document.querySelectorAll(".fc-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".fc-mode-btn").forEach((b) => b.classList.remove("fc-mode-active"));
      document.querySelectorAll(".fc-mode-view").forEach((v) => v.classList.remove("fc-mode-view-active"));

      btn.classList.add("fc-mode-active");
      byId(`${btn.dataset.mode}-mode`).classList.add("fc-mode-view-active");
    });
  });
}

function setupCustomForm() {
  const textarea = byId("customPrompt");
  textarea.addEventListener("input", () => {
    byId("charCount").textContent = String(textarea.value.length);
  });

  byId("startCustomButton").addEventListener("click", () => {
    const value = textarea.value.trim();
    if (!value) {
      showNotice("Please enter a prompt.");
      return;
    }
    startBattle(null, true);
  });
}

function setupVoteButtons() {
  document.querySelectorAll(".fc-vote-btn").forEach((btn) => {
    btn.addEventListener("click", () => recordVote(btn.dataset.vote));
  });
}

function setupNewBattleButton() {
  byId("newBattleButton").addEventListener("click", () => {
    hideBattle();
    byId("customPrompt").value = "";
    byId("charCount").textContent = "0";
  });
}

async function startBattle(battleId, isCustom) {
  const lastBattle = Number(localStorage.getItem("fc_last_battle_time") || "0");
  if (lastBattle && Date.now() - lastBattle < 30000) {
    showNotice("Wait 30 seconds between battles.");
    return;
  }

  let prompt = "";
  let battleMeta = {};

  if (isCustom) {
    prompt = byId("customPrompt").value.trim();

    if (prompt.length > 500) {
      showNotice("Prompt too long. Max 500 characters.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const lastCustomDay = localStorage.getItem("fc_custom_day");
    let customCount = Number(localStorage.getItem("fc_custom_count") || "0");

    if (lastCustomDay !== today) {
      customCount = 0;
      localStorage.setItem("fc_custom_day", today);
    }

    if (customCount >= 5) {
      showNotice("Daily custom battle quota reached in this browser. Try Quick Battles.");
      return;
    }

    battleMeta = { prompt, category: "Custom", isCustom: true };
  } else {
    const battle = QUICK_BATTLES.find((b) => b.id === battleId);
    if (!battle) return;
    prompt = battle.prompt;
    battleMeta = { ...battle, isCustom: false };
  }

  currentBattle = {
    ...battleMeta,
    status: "pending",
    votable: false,
    label: "PENDING"
  };

  showBattle(prompt);

  try {
    const response = await fetch("/api/fight-club", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "code-battle",
        prompt,
        custom: isCustom,
        fighterA: "fighter-a",
        fighterB: "fighter-b"
      })
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json().catch(() => ({
          status: "error",
          label: "ERROR",
          error: "Invalid API JSON response."
        }))
      : {
          status: "error",
          label: "ERROR",
          error: "Local static server cannot run /api/fight-club. UI test passed; LIVE AI requires Cloudflare Pages/Wrangler Functions."
        };

    if (!response.ok || data.status !== "success" || data.label !== "LIVE AI") {
      currentBattle = {
        ...currentBattle,
        status: data.status || "error",
        votable: false,
        label: data.label || "ERROR"
      };
      showError(data.error || "Battle unavailable. No vote was counted.");
      setBattleLabel(currentBattle.label);
      disableVotes(true);
      return;
    }

    byId("codeA").textContent = data.model1_response || "// No response returned.";
    byId("codeB").textContent = data.model2_response || "// No response returned.";
    byId("labelA").textContent = data.fighterA || "Fighter A";
    byId("labelB").textContent = data.fighterB || "Fighter B";

    currentBattle = {
      ...currentBattle,
      status: "success",
      votable: true,
      label: "LIVE AI",
      fighterA: data.fighterA || "Fighter A",
      fighterB: data.fighterB || "Fighter B"
    };

    if (isCustom) {
      const count = Number(localStorage.getItem("fc_custom_count") || "0");
      localStorage.setItem("fc_custom_count", String(count + 1));
    }

    localStorage.setItem("fc_last_battle_time", String(Date.now()));
    setBattleLabel("LIVE AI");
    byId("battleLoading").style.display = "none";
    byId("battleDisplay").style.display = "grid";
    disableVotes(false);
  } catch {
    currentBattle = {
      ...currentBattle,
      status: "error",
      votable: false,
      label: "ERROR"
    };
    showError("Could not reach Fight Club API. No vote was counted.");
    setBattleLabel("ERROR");
    disableVotes(true);
  }
}

function recordVote(vote) {
  if (!currentBattle || !currentBattle.votable || currentBattle.label !== "LIVE AI") {
    showNotice("Voting is only enabled for successful LIVE AI battles.");
    return;
  }

  const winner = vote === "a" ? currentBattle.fighterA : currentBattle.fighterB;
  leaderboard[winner] = (leaderboard[winner] || 0) + 1;

  const history = JSON.parse(localStorage.getItem("fc_match_history") || "[]");
  history.unshift({
    winner,
    prompt: currentBattle.prompt,
    label: "LIVE AI",
    time: new Date().toISOString()
  });
  localStorage.setItem("fc_match_history", JSON.stringify(history.slice(0, 20)));

  currentBattle.votable = false;
  disableVotes(true);
  saveLeaderboard();
  renderMatchHistory();
  showNotice(`${winner} wins this local browser round.`);
  byId("newBattleButton").style.display = "block";
}

function showBattle(prompt) {
  byId("battleArena").classList.remove("hidden");
  byId("battleTitle").textContent = prompt.length > 70 ? `${prompt.slice(0, 70)}...` : prompt;
  byId("battleLoading").style.display = "block";
  byId("battleDisplay").style.display = "none";
  byId("battleError").style.display = "none";
  byId("battleError").textContent = "";
  byId("newBattleButton").style.display = "none";
  setBattleLabel("PENDING");
  disableVotes(true);
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function hideBattle() {
  byId("battleArena").classList.add("hidden");
  currentBattle = null;
}

function showError(message) {
  byId("battleLoading").style.display = "none";
  byId("battleDisplay").style.display = "none";
  byId("battleError").style.display = "block";
  byId("battleError").textContent = message;
  byId("newBattleButton").style.display = "block";
}

function showNotice(message) {
  alert(message);
}

function setBattleLabel(label) {
  const el = byId("battleLabel");
  el.textContent = label;
  el.className = "fc-battle-label";

  if (label === "ERROR") el.classList.add("error");
  if (label === "RATE LIMITED") el.classList.add("rate");
  if (label.includes("DEMO")) el.classList.add("demo");
}

function disableVotes(disabled) {
  document.querySelectorAll(".fc-vote-btn").forEach((btn) => {
    btn.disabled = disabled;
  });
}

function updateLeaderboardDisplay() {
  const container = byId("leaderboardContent");
  container.textContent = "";

  const entries = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "fc-empty";
    empty.textContent = "No LIVE AI battles voted on this browser yet.";
    container.appendChild(empty);
    return;
  }

  entries.forEach(([name, score]) => {
    const row = document.createElement("div");
    row.className = "fc-leaderboard-row";

    const left = document.createElement("span");
    left.className = "fc-leaderboard-name";
    left.textContent = name;

    const right = document.createElement("span");
    right.className = "fc-leaderboard-score";
    right.textContent = `${score} local wins`;

    row.append(left, right);
    container.appendChild(row);
  });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}


function renderMatchHistory() {
  const container = byId("matchHistoryContent");
  if (!container) return;

  let history = [];
  try {
    history = JSON.parse(localStorage.getItem("fc_match_history") || "[]");
  } catch {
    history = [];
  }

  container.textContent = "";

  if (history.length === 0) {
    const empty = document.createElement("p");
    empty.className = "fc-empty";
    empty.textContent = "No successful LIVE AI match votes saved in this browser yet.";
    container.appendChild(empty);
    return;
  }

  history.slice(0, 10).forEach((match) => {
    const row = document.createElement("div");
    row.className = "fc-history-row";

    const top = document.createElement("strong");
    top.textContent = `${match.winner} won`;

    const prompt = document.createElement("span");
    prompt.textContent = match.prompt || "Untitled battle";

    const meta = document.createElement("small");
    const when = match.time ? new Date(match.time).toLocaleString() : "Local time unknown";
    meta.textContent = `${match.label || "LIVE AI"} · ${when}`;

    row.append(top, prompt, meta);
    container.appendChild(row);
  });
}

function setupResetLocalDataButton() {
  const button = byId("resetLocalDataButton");
  if (!button) return;

  button.addEventListener("click", () => {
    const ok = confirm("Reset local Fight Club leaderboard, match history, and browser cooldown data?");
    if (!ok) return;

    localStorage.removeItem("fc_leaderboard");
    localStorage.removeItem("fc_match_history");
    localStorage.removeItem("fc_last_battle_time");
    localStorage.removeItem("fc_custom_day");
    localStorage.removeItem("fc_custom_count");

    leaderboard = {};
    currentBattle = null;

    updateLeaderboardDisplay();
    renderMatchHistory();
    hideBattle();
    showNotice("Local Fight Club data reset.");
  });
}
