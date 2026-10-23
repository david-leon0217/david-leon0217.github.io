# Security Review — david-leon0217.github.io

| | |
|---|---|
| **Target** | Personal portfolio site: `index.html`, `style.css`, `script.js`, `resume.pdf` |
| **Review date** | October 22, 2026 |
| **Reviewer** | David Leon |
| **Method** | SAST, secret scanning, DAST (OWASP ZAP), manual code review, and a dynamic proof-of-concept test against a local copy |
| **Result** | 3 findings fixed and verified · 5 accepted (documented below) · 0 secrets found |
| **Last updated** | October 23, 2026 (DAST added, fonts self-hosted, continuous monitoring enabled) |

## Attack surface

This is a static site with **no forms, no login, no backend and no user input fields**. That makes the attack surface small. The only data the page takes in from outside is the **GitHub REST API response** that feeds the live repo list. That response is treated as untrusted input throughout.

## Tools used (all free)

| Tool | Version | What it checks | Result |
|---|---|---|---|
| [Semgrep](https://semgrep.dev) | 1.182.1 | SAST: rulesets `p/javascript`, `p/xss`, `p/secrets` | 0 findings |
| Semgrep custom rules (`.semgrep/rules.yml`) | — | DOM XSS sink patterns the standard rulesets missed | 2 findings → fixed → 0 |
| [gitleaks](https://github.com/gitleaks/gitleaks) | 8.21.2 | Hard-coded secrets: API keys, tokens, passwords | 0 findings |
| Playwright + headless Chromium | — | Dynamic test: fed a malicious fake API response to the page | Exploit confirmed before fix, blocked after |
| [OWASP ZAP](https://www.zaproxy.org) | 2.17.0 | DAST: active + passive scan of a local copy; passive scan of the live site | No exploitable findings; 1 fixed (SR-06), rest are hosting limits |
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

### SR-03 — Personal data in public résumé · ACCEPTED (owner decision)
- **Severity:** Low (privacy)
- **What:** `resume.pdf` on the public site includes a personal phone number. Phone numbers scraped from public résumés feed spam, phishing, and SIM-swap social engineering.
- **Decision:** kept on purpose so recruiters can call directly. Compensating controls: a carrier account PIN/port-out lock against SIM swaps, and treating unexpected calls asking for codes as phishing. PDF metadata was checked and holds no author name or other personal details.

### SR-04 — No secrets in code · PASS
gitleaks (working tree and git history) and Semgrep `p/secrets` found no API keys, tokens or passwords. The site uses GitHub's **unauthenticated** public API on purpose, so no token ever needs to exist in browser code.

### SR-05 — Security headers unavailable on GitHub Pages · ACCEPTED
- **Severity:** Informational
- GitHub Pages can't set `X-Frame-Options` or a header-based `frame-ancestors`. The site has no buttons that change state or log in, so there is nothing to trick a visitor into clicking. Risk accepted. Revisit if the site ever moves to a host that allows headers (for example Cloudflare Pages).
- **Same root cause, found by the first live DAST run in CI (Oct 23, 2026):** `X-Content-Type-Options`, `Permissions-Policy` and `Cross-Origin-Embedder-Policy` are also response headers GitHub Pages won't let site owners set. The site requests no browser features and serves no private data, so the practical risk is negligible. ZAP's live run reported **FAIL: 0, PASS: 58**, with the three new header warnings accepted here.

### SR-06 — Third-party stylesheet without integrity check · FIXED
- **Severity:** Medium (ZAP rating) / Low in practice · ZAP alert 90003, Sub Resource Integrity Attribute Missing
- **What:** the fonts loaded from Google Fonts with no Subresource Integrity hash, and SRI can't be added because Google changes that CSS per browser. If that third party were ever compromised, it could change how the site renders. It also sent every visitor's IP address to Google.
- **Fix:** the three fonts are now self-hosted in `/fonts` (SIL Open Font License; licenses included). The CSP was tightened to `style-src 'self'; font-src 'self'`, so the browser now refuses fonts and styles from anywhere else.
- **Verification:** a ZAP re-scan of the new build no longer reports 90003. The only remaining third party is GitHub's API, for the repo feed.

### SR-07 — Email address published in plain text · ACCEPTED
- **Severity:** Informational
- The `mailto:` link can be scraped by spam bots. It's accepted because recruiters need a one-click way to reach me.

### SR-08 — GitHub API rate limit · ACCEPTED
- **Severity:** Informational (availability)
- Unauthenticated API calls are limited to 60 per hour per visitor IP. If that limit is hit, the page shows a fallback link to the GitHub profile instead of breaking.

### SR-09 — Wildcard CORS header on static files · ACCEPTED
- **Severity:** Informational · ZAP alert 10098, Cross-Domain Misconfiguration
- GitHub Pages sends `Access-Control-Allow-Origin: *` on every file and it can't be changed. The site serves only public, static content with no cookies or private data, so another site reading it gains nothing.

## DAST results (OWASP ZAP 2.17.0)

| Alert | ZAP risk | Where | Status |
|---|---|---|---|
| 90003 Sub Resource Integrity missing | Medium | Google Fonts link | **Fixed** (SR-06) |
| 10020 Missing anti-clickjacking header | Medium | GitHub Pages headers | Accepted (SR-05) |
| 10055 CSP: no `frame-ancestors`; `unsafe-inline` | Medium | Meta-tag limit; GitHub's own 404 page | Accepted (SR-05) |
| 10038 CSP header not set | Medium | CSP ships as a meta tag | Accepted (SR-02) |
| 10098 Cross-domain misconfiguration | Medium | GitHub Pages CORS header | Accepted (SR-09) |
| 10021 X-Content-Type-Options missing | Low | GitHub Pages headers | Accepted (SR-05) |
| 10027 Suspicious comments | Info | Teaching comments in code | Accepted (no secrets, per gitleaks) |
| 10049 Storable and cacheable content | Info | Public static pages | Accepted (SR-05) |
| 10063 Permissions-Policy header not set | Low | GitHub Pages headers | Accepted (SR-05) |
| 90004 Cross-Origin-Embedder-Policy missing | Low | GitHub Pages headers | Accepted (SR-05) |
| 10015 / 10050 Cache notices | Info | GitHub's CDN | Accepted |

The active scan, run against a local copy so no attack traffic hits GitHub's servers, found **no injection, XSS or other exploitable issues**. Every accepted alert is recorded in `.zap/rules.tsv` with its reason. **Any new alert type fails the monitor and triggers an email.**

## Continuous monitoring

| When | What runs |
|---|---|
| Every push | Secret scan (gitleaks) + SAST (Semgrep). The deploy is blocked unless both pass. |
| After every deploy | Live checks: uptime, HTTPS/HSTS, CSP in place, live files match the repo byte for byte (catches tampering), then a ZAP baseline scan |
| Daily, 7:17 AM ET | The same live checks and ZAP baseline, so regressions surface even with no code changes |
| On demand | ZAP full active scan against a local copy (Actions → Live site monitor → Run workflow → `full`) |

Failures are emailed to the site owner. ZAP reports are saved with every run.

## How to re-run this review

```bash
pip install semgrep
semgrep scan --config .semgrep/rules.yml --config p/javascript --config p/xss --config p/secrets --metrics=off .
gitleaks detect --source . -v
```

These same scans run automatically on every push through `.github/workflows/security.yml`, and **the site only deploys if they pass.** DAST and live checks run in `.github/workflows/monitor.yml`.
