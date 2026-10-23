# Security Review — david-leon0217.github.io

| | |
|---|---|
| **Target** | Personal portfolio site: `index.html`, `style.css`, `script.js`, `resume.pdf` |
| **Review date** | October 22, 2026 |
| **Reviewer** | David Leon |
| **Method** | Static analysis (SAST), secret scanning, manual code review, and a dynamic proof-of-concept test against a local copy |
| **Result** | 2 findings fixed and verified · 1 open (owner decision) · 4 accepted / informational · 0 secrets found |

## Attack surface

This is a static site with **no forms, no login, no backend and no user input fields**. That makes the attack surface small. The only data the page takes in from outside is the **GitHub REST API response** that feeds the live repo list. That response is treated as untrusted input throughout.

## Tools used (all free)

| Tool | Version | What it checks | Result |
|---|---|---|---|
| [Semgrep](https://semgrep.dev) | 1.182.1 | SAST: rulesets `p/javascript`, `p/xss`, `p/secrets` | 0 findings |
| Semgrep custom rules (`.semgrep/rules.yml`) | — | DOM XSS sink patterns the standard rulesets missed | 2 findings → fixed → 0 |
| [gitleaks](https://github.com/gitleaks/gitleaks) | 8.21.2 | Hard-coded secrets: API keys, tokens, passwords | 0 findings |
| Playwright + headless Chromium | — | Dynamic test: fed a malicious fake API response to the page | Exploit confirmed before fix, blocked after |
| Manual review | — | Privacy, headers, third-party requests | See findings |

**Lesson from this review:** the public rulesets returned zero findings, but manual review found a real, exploitable pattern. Scanners are a floor, not a ceiling. Writing a custom rule (`innerhtml-with-interpolated-data`) turned the manual finding into something the pipeline now catches automatically.

## Findings

### SR-01 — DOM-based XSS via unvalidated API data in `innerHTML` · FIXED
- **Severity:** Medium as a code pattern; Low in practice (exploitation needs a tampered GitHub API response)
- **Category:** CWE-79 (Cross-site Scripting), CWE-20 (Improper Input Validation) · OWASP A03:2021 Injection
- **Where:** `script.js`, `loadRepos()`, original lines 103–109 and 135–136
- **What was wrong:** each repo card was built with a template string assigned to `innerHTML`, and `repo.html_url` from the API was placed inside the `href` with no validation. A value containing `">` could break out of the attribute and inject markup.
- **Proof of concept:** served the original code locally and returned this `html_url` from a mocked API:
  `https://github.com/x"><img src=x onerror=alert("XSS-old-code")>`
  **Result: the injected JavaScript executed** (alert fired).
- **Fix:**
  1. No API data goes through `innerHTML` anymore. Elements are built with `createElement`, and text is set with `textContent`, which the browser never parses as HTML.
  2. **Input validation:** a new `safeRepoUrl()` accepts a link only if it is `https:`, on host `github.com`, and under `/david-leon0217/<repo>`. Anything else is dropped.
  3. The API response is checked to be an array before use, and dates are parsed defensively.
- **Verification:** re-ran the attack plus four more payloads (HTML in the repo name, `<script>` in the description, a `javascript:` URL, a look-alike domain, and another user's repo). **No script executed.** Hostile text rendered as plain text, and the three bad links were skipped. The custom Semgrep rule now reports 0.

### SR-02 — No Content Security Policy · FIXED
- **Severity:** Low (defense in depth)
- **Category:** CWE-693 (Protection Mechanism Failure)
- **What was wrong:** with no CSP, any script that got injected would run with no second line of defense.
- **Fix:** added a CSP `<meta>` tag in `index.html`. Scripts load only from the site itself, styles from the site and Google Fonts, fonts from Google, and data only from `api.github.com`. Plugins, `<base>` hijacking and form submissions are blocked. A `strict-origin-when-cross-origin` referrer policy was added too.
- **Verification:** the site loads with zero CSP violations, and fonts and the repo feed still work.
- **Limitation:** GitHub Pages can't send custom HTTP headers, so the CSP lives in a meta tag. That supports everything above except `frame-ancestors` (see SR-05).

### SR-03 — Personal data in public résumé · OPEN (owner decision)
- **Severity:** Low (privacy)
- **What:** `resume.pdf` on the public site includes a personal phone number. Phone numbers scraped from public résumés feed spam, phishing, and SIM-swap social engineering.
- **Recommendation:** publish a web copy of the résumé without the phone number, and give the full version to recruiters directly. PDF metadata was checked and holds no author name or other personal details.

### SR-04 — No secrets in code · PASS
gitleaks (working tree and git history) and Semgrep `p/secrets` found no API keys, tokens or passwords. The site uses GitHub's **unauthenticated** public API on purpose, so no token ever needs to exist in browser code.

### SR-05 — Clickjacking protection unavailable on GitHub Pages · ACCEPTED
- **Severity:** Informational
- GitHub Pages can't set `X-Frame-Options` or a header-based `frame-ancestors`. The site has no buttons that change state or log in, so there is nothing to trick a visitor into clicking. Risk accepted. Revisit if the site ever moves to a host that allows headers (for example Cloudflare Pages).

### SR-06 — Third-party requests reveal visitor IPs · ACCEPTED
- **Severity:** Informational (privacy)
- Google Fonts and the GitHub API both see each visitor's IP address. Subresource Integrity (SRI) can't be used on Google Fonts' CSS because Google changes it per browser. Optional fix: self-host the three fonts.

### SR-07 — Email address published in plain text · ACCEPTED
- **Severity:** Informational
- The `mailto:` link can be scraped by spam bots. It's accepted because recruiters need a one-click way to reach me.

### SR-08 — GitHub API rate limit · ACCEPTED
- **Severity:** Informational (availability)
- Unauthenticated API calls are limited to 60 per hour per visitor IP. If that limit is hit, the page shows a fallback link to the GitHub profile instead of breaking.

## How to re-run this review

```bash
pip install semgrep
semgrep scan --config .semgrep/rules.yml --config p/javascript --config p/xss --config p/secrets --metrics=off .
gitleaks detect --source . -v
```

These same scans run automatically on every push through `.github/workflows/security.yml`. **The site only deploys if they pass.**
