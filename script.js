/* ============================================================
   script.js — everything the page DOES (interactivity).
   You don't need to edit this to add projects; just change
   GITHUB_USER below if your username ever changes.
   ============================================================ */

const GITHUB_USER = "david-leon0217";

/* ---------- 1. BOOT SEQUENCE ----------
   Plays once per browser tab, then never again until they reopen the site. */
function runBoot() {
  const boot = document.getElementById("boot");
  const text = document.getElementById("boot-text");
  const fill = document.getElementById("boot-fill");

  let seen = false;
  try { seen = sessionStorage.getItem("booted") === "1"; } catch (e) {}
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (seen || reduced) { boot.classList.add("done"); return; }

  const lines = ["> INITIALIZING VISOR…", "> LOADING PROFILE: D. LEON", "> SYSTEMS ONLINE"];
  let i = 0;

  const finish = () => {
    clearInterval(timer);
    boot.classList.add("done");
    try { sessionStorage.setItem("booted", "1"); } catch (e) {}
    window.removeEventListener("keydown", finish);
  };

  const timer = setInterval(() => {
    if (i < lines.length) {
      text.textContent = lines[i];
      fill.style.width = ((i + 1) / lines.length) * 100 + "%";
      i++;
    } else {
      finish();
    }
  }, 550);

  boot.addEventListener("click", finish);
  window.addEventListener("keydown", finish);
}

/* ---------- 2. SCROLL REVEAL ----------
   Watches every .reveal section and adds .visible once it scrolls into view. */
function setupReveal() {
  const sections = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    sections.forEach(s => s.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  sections.forEach(s => observer.observe(s));
}

/* ---------- 3. ACTIVE NAV LINK ----------
   Highlights the nav link for whichever section you're looking at. */
function setupActiveNav() {
  const links = document.querySelectorAll(".nav a");
  const targets = [...links].map(a => document.querySelector(a.getAttribute("href")));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id));
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  targets.forEach(t => t && observer.observe(t));
}

/* ---------- 4. LIVE GITHUB REPO FEED ----------
   Asks GitHub's public API for your repos and builds a card for each. */
async function loadRepos() {
  const grid = document.getElementById("repo-grid");
  const filterBox = document.getElementById("repo-filters");

  try {
    const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=50`);
    if (!res.ok) throw new Error("GitHub said " + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Unexpected response shape"); // validate before use
    const repos = data.filter(r => r && !r.fork && r.name !== `${GITHUB_USER}.github.io`);

    if (repos.length === 0) {
      grid.replaceChildren(el("p", "loading", "No public repositories yet. Check back soon."));
      return;
    }

    // Build the cards.
    // SECURITY (see SECURITY-REVIEW.md, finding SR-01): everything from the
    // GitHub API is treated as untrusted input. Nothing from it goes through
    // innerHTML; text goes in with textContent, and links are validated first.
    grid.replaceChildren();
    repos.forEach(repo => {
      const url = safeRepoUrl(repo.html_url);
      if (!url) return; // skip anything that isn't a link to one of your own repos

      const card = el("article", "repo-card");
      card.dataset.lang = String(repo.language || "Other");

      const link = el("a", null, String(repo.name));
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const title = el("h3");
      title.appendChild(link);

      const meta = el("div", "repo-meta");
      meta.append(
        el("span", "lang", String(repo.language || "Other")),
        el("span", null, "Updated " + formatDate(repo.updated_at))
      );

      card.append(title, el("p", "desc", String(repo.description || "No description yet.")), meta);
      grid.appendChild(card);
    });

    // Build one filter button per language, plus "All"
    const langs = ["All", ...new Set(repos.map(r => r.language || "Other"))];
    langs.forEach(lang => {
      const btn = document.createElement("button");
      btn.className = "filter-btn";
      btn.type = "button";
      btn.textContent = lang;
      btn.setAttribute("aria-pressed", lang === "All" ? "true" : "false");
      btn.addEventListener("click", () => {
        filterBox.querySelectorAll(".filter-btn").forEach(b => b.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
        grid.querySelectorAll(".repo-card").forEach(card => {
          card.hidden = !(lang === "All" || card.dataset.lang === lang);
        });
      });
      filterBox.appendChild(btn);
    });
  } catch (err) {
    const link = el("a", null, "github.com/" + GITHUB_USER);
    link.href = "https://github.com/" + GITHUB_USER;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const msg = el("p", "loading", "Couldn't reach GitHub right now. See all repos at ");
    msg.append(link, ".");
    grid.replaceChildren(msg);
  }
}

/* ---------- 4a. SAFE-DOM HELPERS ----------
   Small tools that build page elements without ever parsing a string as HTML. */

// Make an element, optionally with a class and plain text inside it
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// INPUT VALIDATION: only accept https links to a repo under YOUR GitHub account.
// Anything else (javascript:, another domain, another user) returns null.
function safeRepoUrl(value) {
  try {
    const u = new URL(String(value));
    const ownRepo = new RegExp("^/" + GITHUB_USER + "/[A-Za-z0-9._-]+/?$");
    return u.protocol === "https:" && u.hostname === "github.com" && ownRepo.test(u.pathname)
      ? u.href
      : null;
  } catch (e) {
    return null;
  }
}

// Turn GitHub's timestamp into "Oct 2026"; anything unparseable becomes "recently"
function formatDate(value) {
  const d = new Date(value);
  return isNaN(d) ? "recently" : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/* ---------- 4b. MISSION MAP ----------
   Clicking a sector shows its panel; the progress bar counts done/active items. */
function setupMap() {
  const buttons = document.querySelectorAll(".sector-btn");
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.setAttribute("aria-selected", b === btn ? "true" : "false"));
      document.querySelectorAll(".sector-panel").forEach(p => {
        p.hidden = p.id !== "sector-" + btn.dataset.sector;
      });
    });
  });

  // Progress: done = 1 point, in progress = half a point
  const items = document.querySelectorAll(".items li");
  let score = 0;
  items.forEach(li => {
    if (li.dataset.status === "done") score += 1;
    else if (li.dataset.status === "active") score += 0.5;
  });
  const pct = Math.round((score / items.length) * 100);
  document.getElementById("map-pct").textContent = pct + "%";
  // Fill the bar once the section scrolls into view
  const fill = document.getElementById("map-fill");
  const section = document.getElementById("roadmap");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting) { fill.style.width = pct + "%"; obs.disconnect(); }
    }, { threshold: 0.2 }).observe(section);
  } else {
    fill.style.width = pct + "%";
  }
}

/* ---------- 5. START EVERYTHING ---------- */
document.getElementById("year").textContent = new Date().getFullYear();
runBoot();
setupReveal();
setupActiveNav();
setupMap();
loadRepos();
