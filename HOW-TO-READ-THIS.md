# How to read your site's code

Your site is three files that each do one job:

| File | Job | Analogy |
|---|---|---|
| `index.html` | **What's on the page** — text, links, sections | The network topology: what devices exist and how they connect |
| `style.css` | **How it looks** — colors, fonts, spacing, layout | Device configs: same devices, different behavior |
| `script.js` | **What it does** — boot intro, repo feed, filters | Automation scripts that run on top |

---

## 1. Reading HTML

HTML is made of **tags**. Most come in pairs: an opening tag, content, a closing tag.

```html
<h3>Subnet Calculator</h3>
```
`<h3>` opens a heading, `</h3>` closes it. Everything between is the content.

Tags can carry **attributes** — extra settings inside the opening tag:

```html
<a href="https://github.com/david-leon0217" target="_blank">GitHub</a>
```
- `a` = a link
- `href` = where it goes
- `target="_blank"` = open in a new tab

### The tags you'll see in this site

| Tag | Means |
|---|---|
| `<section>` | A big chunk of the page (About, Projects, etc.) |
| `<h1>` `<h2>` `<h3>` | Headings, biggest to smallest |
| `<p>` | A paragraph |
| `<a>` | A link |
| `<ul>` / `<ol>` + `<li>` | A list and its items |
| `<article>` | A self-contained card (each project) |
| `<div>` / `<span>` | Generic boxes with no meaning of their own; used for styling |
| `<!-- ... -->` | A comment. The browser ignores it; it's notes for you |

### `class` vs `id` — the most important thing to understand

```html
<section id="projects">
<article class="project-card">
```
- **`id`** names **one** unique element. Nav links jump to it (`href="#projects"`).
- **`class`** is a label you can put on **many** elements. Every project card shares `class="project-card"`, so they all get the same styling.

Think of `id` as a hostname and `class` as a VLAN tag.

---

## 2. Reading CSS

Every CSS rule has the same shape:

```css
.project-card {
  border: 1px solid var(--line);
  padding: 22px;
}
```
- **Selector** (`.project-card`) — *which* elements this applies to
- **Properties** (`border`, `padding`) — *what* to change
- **Values** (`22px`) — *how much*

### Selectors, decoded

| Selector | Matches |
|---|---|
| `h2` | Every `<h2>` |
| `.project-card` | Everything with `class="project-card"` (dot = class) |
| `#boot` | The one element with `id="boot"` (hash = id) |
| `.project-card h3` | `<h3>`s that are *inside* a project card |
| `.btn:hover` | A button *while the mouse is over it* |

### Things that look scary but aren't

- **`var(--accent)`** — a variable. All colors are defined once at the top of `style.css` in `:root`. Change `--accent` there and every orange thing on the site changes.
- **`::before` / `::after`** — invisible extra elements CSS creates for decoration. The visor scan line on the cards is a `::before`.
- **`@media (max-width: 640px) { ... }`** — rules inside only apply on phone-sized screens.
- **`@keyframes`** — defines an animation (the pulsing dot, the scan sweep).

### Box model in one line
Every element is a box: **content → padding (inside space) → border → margin (outside space)**.

---

## 3. Reading script.js (just enough)

You don't need to write JavaScript. Know these three things:
1. `GITHUB_USER` at the top is your username. The repo feed uses it.
2. `document.getElementById("repo-grid")` = "find the HTML element with `id="repo-grid"`." That's how JS reaches into the page.
3. The repo feed means **any public repo you push shows up automatically**. No edits needed.

---

## 4. Common edits, step by step

### Add a featured project
1. Open `index.html`, find `<!-- ---------- PROJECT CARD`.
2. Copy everything from `<article class="project-card">` to its closing `</article>`.
3. Paste it right below, then change the title, description, tags, and link.
4. Change `SECTOR 01` to the next number.
5. For a project still being built, keep `class="status status-active"` and the text `In progress`. For a finished one, use `class="status"` and the text `Complete`.

### Update the mission map (roadmap)
1. Open `index.html` and find `<!-- ===== 6b. MISSION MAP`.
2. Each item is an `<li data-status="...">`. Change the word to `done`, `active`, or `planned`. The progress bar recalculates on its own.
3. When you move to a new sector, move the word `current` from one `<button class="sector-btn current" ...>` to the next one. Also swap `aria-selected="true"` to that button, and move `hidden` off that sector's panel and onto the old one.
4. Change the small status text (`In progress`, `Next`, `Locked`, `Complete`) inside each button to match.

### Change a color
Edit the `:root` block at the top of `style.css`.

### Update your résumé
Drop the PDF into the same folder, named exactly `resume.pdf`.

---

## 5. Deploy (and update) the site

### Your folder should look like this
```
david-leon0217.github.io/
├── index.html
├── style.css
├── script.js
├── resume.pdf
├── HOW-TO-READ-THIS.md
├── SECURITY-REVIEW.md
├── fonts/                    ← self-hosted fonts + their licenses
├── .semgrep/
│   └── rules.yml             ← custom SAST rules
├── .zap/
│   └── rules.tsv             ← DAST: alerts reviewed and accepted, each with its reason
└── .github/
    └── workflows/
        ├── security.yml      ← push: secret scan + SAST, then deploy
        └── monitor.yml       ← after deploy + daily: live checks + DAST
```
Folders starting with a dot are hidden by default. On Windows, turn on View → Hidden items; on Mac, press Cmd+Shift+. in Finder.

### First time
1. Install Git if you don't have it (git-scm.com), and sign in to GitHub.
2. On GitHub, click **New repository**. Name it exactly `david-leon0217.github.io`, set it to **Public**, and don't add a README.
3. Open a terminal in your site folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial portfolio"
   git branch -M main
   git remote add origin https://github.com/david-leon0217/david-leon0217.github.io.git
   git push -u origin main
   ```
4. On GitHub, open the repo, then **Settings → Pages → Build and deployment → Source: GitHub Actions**. (Not "Deploy from a branch". The pipeline handles deploying, so it can scan first.)
5. Open the **Actions** tab. You'll see the pipeline run three jobs: secret scan, SAST, then deploy. All three green means you're live at **https://david-leon0217.github.io**, reachable from any device.

If the first run started before you switched the Pages source, click the run and choose **Re-run all jobs**.

### Every update after that
```bash
git add .
git commit -m "describe what you changed"
git push
```
Every push gets scanned again. **If a scan finds a problem, the deploy job doesn't run and your live site stays on the last safe version.** Click the failed job in the Actions tab to see exactly which line it flagged.

### Preview locally before pushing
Double-click `index.html` to open it in your browser. For the most accurate preview, run a tiny local server in the folder and open http://localhost:8000:
```bash
python -m http.server 8000
```


## 6. Making changes the right way (branch → pull request → merge)

You **can** keep pushing straight to `main`, and every push still gets scanned. But the professional workflow, and the one interviewers expect you to know, uses a branch:

```bash
git checkout main
git pull                          # 1. get the latest from GitHub first
git checkout -b update-bio        # 2. make a branch for this change
# ...edit files, preview locally...
git add .
git commit -m "Update bio and Kokoro section"
git push -u origin update-bio     # 3. push the branch (this does NOT go live)
```

4. On GitHub, a yellow banner offers **Compare & pull request**. Click it, then **Create pull request**.
5. The secret scan and SAST run on the pull request. **Nothing deploys yet.** Green checks mean the change is safe to ship.
6. Click **Merge pull request**. Merging into `main` triggers scan → deploy → live DAST.
7. Back on your computer:
   ```bash
   git checkout main
   git pull                        # your local main now matches the live site
   git branch -d update-bio        # delete the finished branch
   ```

**The rule of thumb:** your laptop is where you edit, GitHub is the source of truth, and `git pull` before you start keeps the two in sync.

## 7. Get alerts by email

GitHub sends the alerts itself, so no passwords or email credentials ever live in this repo.

1. **GitHub → Settings → Emails**: add `davidalanleon@outlook.com` and click the verification link GitHub sends you.
2. **GitHub → Settings → Notifications**:
   - **Default notifications email** → choose `davidalanleon@outlook.com`.
   - Under **System → Actions**, tick **Email** and **Only notify for failed workflows**.
3. Done. You'll get an email if:
   - a push fails the secret scan or SAST (the deploy is blocked),
   - the live site is down, its files don't match the repo, or its CSP is missing,
   - ZAP finds a new kind of issue on the live site (daily, and after every deploy).

Quiet inbox = everything passing. Each run's ZAP report is under **Actions → (run) → Artifacts**.

**Deep scan on demand:** Actions → **Live site monitor (DAST)** → **Run workflow** → choose `full`. It runs a real attack scan against a copy of the site inside GitHub's runner, never against the live servers.

**If ZAP flags something:** read the report and fix it, or, if it's a hosting limit you can't change, add a line to `.zap/rules.tsv` with the alert ID, `IGNORE`, and the reason, then log it in `SECURITY-REVIEW.md`. Never ignore an alert without writing down why.
