# johnvicencio.com CMS Security QA — 2026-11-01

**Scope:** Blazor WASM CMS + Netlify Functions/Blobs (content, contact, logs, vault).  
**Authority:** AgentCode GUIDE §8.2a + `FEAT-WEB-NETLIFY-SECURITY-DEFAULTS` (same pass as mythoslifecare Care CMS).  
**Method:** Static review + Release publish verify + read-only production smoke.  
**Deploy:** Fixes on branch `fix/security-qa-2026-11-01` — **not** deployed to prod in this window.

---

## Summary

| Severity | Count | Status |
|:---|:---|:---|
| HIGH | 2 | Fixed on branch (await deploy) |
| MEDIUM | 3 | Fixed on branch (same PR) |
| Checklist PASS (post-fix) | 9 / 10 themes | See below; vault API remains intentional |

**Prod still exposes** `https://johnvicencio.com/data/users/admin.json` (static vault crypto) and unauthenticated `/.netlify/functions/content?name=messages` (PII) until this branch is merged and deployed. **Recommend rotating the admin vault password after that deploy** (static ciphertext was public).

---

## Findings

### JV-001 — Public static admin vault (HIGH) — FIXED

- **Evidence (prod):** `GET /data/users/admin.json` → 200 with `salt`, `iv`, `cipherText`, `tag`, `iterations`.
- **Issue:** Seed vault shipped in publish `wwwroot`; CDN served offline crack material.
- **Fix:** `johnvicencio.csproj` `CopyToPublishDirectory=Never` for `wwwroot/data/users/**`; `netlify.toml` force-404 `/data/users/*`; `content.ts` local seed fallback for `netlify dev` only.
- **Local verify:** publish → `USERS_STRIPPED_OK` (no `wwwroot/data/users` under publish tree).

### JV-002 — Unauthenticated messages via content API (HIGH) — FIXED

- **Evidence (prod):** `GET /.netlify/functions/content?name=messages` → 200 with name/email/message PII.
- **Issue:** `messages` / `contact-rate-limits` were world-readable through the shared content function.
- **Fix:** `content.ts` requires write token (`hasWriteToken` / timing-safe) for those names. Contact function GET was already 401 (prod PASS).

### JV-003 — CORS `Access-Control-Allow-Origin: *` (MEDIUM) — FIXED

- **Evidence (prod):** content response echoed `access-control-allow-origin: *` even for `Origin: https://evil.example`.
- **Fix:** Shared `netlify/functions/_security.ts` allowlist (johnvicencio.com, www, localhost/127.0.0.1:8889|4001, deploy-preview / branch Netlify hosts). Wired into `content.ts`, `contact.ts`, `logs.ts`.

### JV-004 — Write token in `localStorage` (MEDIUM) — FIXED

- **Evidence:** `DataStore` / `LogService` / `ContactMessageController` / Admin Settings & Reset Password used `window.localStorage` for `jv_content_token`.
- **Fix:** `DataStore.GetContentTokenAsync` / `SetContentTokenAsync` — `sessionStorage` + one-time migrate-off `localStorage` (Care / mythoslife pattern).

### JV-005 — CSP `unsafe-eval` + thin security headers (MEDIUM) — FIXED

- **Evidence (prod):** site headers had nosniff / SAMEORIGIN / referrer only; meta CSP used `'unsafe-eval'`.
- **Fix:** `netlify.toml` + `index.html` CSP use `'wasm-unsafe-eval'` (Blazor WASM); add COOP, CORP, Permissions-Policy, HSTS. Residual: `'unsafe-inline'` for boot/loader scripts (same class as Care until hashed).

---

## Checklist results

| Item | Prod (pre-deploy) | Branch fix |
|:---|:---|:---|
| Unauth / wrong-token PUT | — | timingSafeEqual gate in `_security.ts` |
| Messages via content GET | **FAIL** (200 PII) | Auth-gated |
| Contact GET unauth | PASS (401) | Unchanged + CORS allowlist |
| Contact honeypot / too-fast | PASS (400) | Unchanged |
| CORS foreign Origin | **FAIL** (`*`) | Allowlist; no ACAO for evil |
| Settings password scrub | PASS (code path) | Unchanged |
| sessionStorage write token | **FAIL** (localStorage) | Migrate-off |
| Admin / login noindex | Partial | AdminPageLayout + Login + Reset |
| Static vault seed | **FAIL** (200 crypto) | Exclude + force-404 |
| Vault via content API | 200 (login needs ciphertext) | Residual — password is secret |

---

## Residual / operator notes

1. **Deploy** `fix/security-qa-2026-11-01` when ready, then **rotate admin vault password** (old static ciphertext was public).
2. Client-side vault login still loads `/.netlify/functions/content?name=users/admin` without a token — ciphertext is public API material; passphrase remains the secret. Server-side login (Care `admin-auth`) would scrub this further if desired later.
3. Write token in `sessionStorage` remains XSS-stealable in-tab — documented residual per `FEAT-WEB-NETLIFY-SECURITY-DEFAULTS` (not elevated to HIGH).
4. Netlify build strips AppleDouble `._*` before `dotnet publish` (JV4TB/pCloud remount hygiene).

---

## AgentCode

Changelog not bumped this window (no `.agent-code` commit). Align with GUIDE §8.2a when merging.
