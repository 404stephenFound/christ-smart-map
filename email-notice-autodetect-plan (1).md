# Feature: Email-Based Auto-Notice Detection for Teacher Cabin Finder

## 1. Problem Statement

Teachers/volunteers currently must **manually type** a status notice (e.g. "Back at 3PM", "Away for PhD Viva") every time they step out for an event, talk, or occasion they're coordinating. This is repetitive and easy to forget.

**Goal:** When a teacher is listed as in-charge/coordinator/POC for an event in their institutional email (as plain text or as a poster/flyer image attachment), the system should detect this and **suggest** an auto-generated notice, so the teacher doesn't have to type it manually. If nothing relevant is found in email, the manual flow works exactly as it does today — **zero change** to existing behavior in that case.

This is an **additive** feature. It does not touch `handleStatusChange`, the `/teachers/status` PUT contract, the status card grid, the timetable system, or the chatbot's existing fuzzy-matching logic. It only adds a new, optional path that can pre-fill the same notice input the teacher already uses.

---

## 2. Important Scoping Decision (read this before building)

Real end-to-end encryption (E2EE) is **not technically compatible** with server-side email content analysis. E2EE means only the two communicating endpoints can ever decrypt the data — but this feature requires the backend to read email content in order to detect event/in-charge language and extract poster text. That necessarily means the server sees plaintext at the moment of analysis.

What we build instead — and what actually delivers on the *intent* behind "no one else should access this" — is:

- **Encrypted credentials at rest** (OAuth tokens encrypted with AES-256-GCM, per-teacher).
- **Zero raw-content retention.** Email bodies/images are pulled into memory, scanned, and immediately discarded. Only the final derived notice string (and a boolean/confidence flag) is ever written to the database — never the original email text or image.
- **Strict per-teacher access control.** The scan can only be triggered by the authenticated teacher's own session (`requireAuth` + `teacherId` match). No admin route, no cross-teacher access, ever.
- **Explicit opt-in.** Nothing scans automatically until a teacher connects their email and enables the feature.

Recommend calling this "Private Email Scan" in the UI rather than "End-to-End Encrypted" to avoid overstating the guarantee — happy to discuss if you want to push back on this.

---

## 3. High-Level Architecture

```
[Teacher opts in: "Connect Email"]
            │
            ▼
  Google OAuth2 Consent Screen (institutional Gmail/Workspace account)
            │
            ▼
  Backend stores ENCRYPTED refresh token (AES-256-GCM), tied to teacher_id
            │
            ▼
[Teacher clicks "Scan for Notice" OR scheduled scan]
            │
            ▼
  Gmail API fetch: last N hours of inbox (subject + body + attachments)
            │
            ▼
  Local Rule-Based Event Classifier (regex/keyword — same style as chat.js)
     ├─ Text emails → keyword/phrase match ("in charge of", "coordinating",
     │                "POC for", "point of contact", event name + date pattern)
     └─ Poster/image attachments → OCR (tesseract.js, local, no external API)
                                   → same keyword/phrase match on extracted text
            │
            ▼
  If match found → generate short notice string
     e.g. "Away — Coordinating [Event Name]"
            │
            ▼
  Return suggestion to frontend (NOT auto-saved)
            │
            ▼
  Teacher reviews in the existing notice input box → clicks existing Save
  button → existing handleNoticeSubmit() → existing PUT /teachers/status
            │
            ▼
  Raw email content discarded from memory. Nothing else stored.
```

**Key design choice: human-in-the-loop, not silent auto-write.**
The scan *pre-fills* the existing notice textbox. It does not call `/teachers/status` on its own. This means:
- Zero risk of a false-positive poster match broadcasting wrong info to students.
- Zero changes needed to `handleStatusChange`, `handleNoticeSubmit`, or the `/teachers/status` route.
- Teacher still has final say, same as today — just less typing.

If you later want fully-automatic (no confirm step), that's a one-line change (auto-submit instead of pre-fill) — but I'd recommend starting confirm-first.

---

## 4. Database Changes (additive only — no existing columns touched)

```sql
-- New columns on teachers table
ALTER TABLE teachers ADD COLUMN email_oauth_refresh_token_enc TEXT;      -- AES-256-GCM encrypted
ALTER TABLE teachers ADD COLUMN email_scan_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE teachers ADD COLUMN last_email_scan_at TIMESTAMP;

-- New table: minimal audit log, NO raw content ever stored
CREATE TABLE notice_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id),
  scanned_at TIMESTAMP DEFAULT now(),
  source_type VARCHAR(10),        -- 'text' or 'poster'
  match_found BOOLEAN,
  suggested_notice VARCHAR(255)   -- only the short derived string, nothing raw
);
```

---

## 5. Backend Components (all new files — nothing existing is modified)

```
backend/
  services/
    emailOAuth.js          -- Google OAuth2 flow, token exchange, refresh
    emailScanner.js         -- fetches recent emails via Gmail API, runs classifier
    posterOCR.js             -- tesseract.js OCR for image/poster attachments
    eventClassifier.js       -- shared rule-based matcher (regex/keyword bank)
    cryptoVault.js            -- AES-256-GCM encrypt/decrypt helper for tokens
  routes/
    emailNotice.js            -- new routes, all gated by requireAuth:
                                   POST /teachers/email/connect   (start OAuth)
                                   GET  /teachers/email/callback   (OAuth redirect)
                                   POST /teachers/email/scan        (trigger scan)
                                   POST /teachers/email/disconnect  (revoke + wipe token)
```

**Route contract for the scan endpoint (this is what the frontend consumes):**
```
POST /teachers/email/scan
→ { matchFound: true, suggestedNotice: "Away — Coordinating Tech Fest 2026", sourceType: "poster" }
   OR
→ { matchFound: false }
```
Nothing is written to `teachers.status_notice` by this route. It only returns a suggestion.

---

## 6. Frontend Changes (additive UI only, existing notice flow untouched)

In the existing "Custom Notice & Return Time" panel, add:
- A small "Connect Email" link/button (only shown if not yet connected).
- Once connected: a "Scan for Notice" button next to the existing input.
- On click → calls `/teachers/email/scan` → if `matchFound`, **pre-fills** the existing `statusNotice` input state (does not submit) → teacher sees it, edits if needed, clicks the **existing** Save icon button → existing `handleNoticeSubmit` runs unchanged.
- If `matchFound: false` → show a small "No relevant emails found — enter manually" hint, input stays as-is.

No changes to `handleStatusChange`, the status card grid, or any other dashboard panel.

---

## 7. Event Classifier Logic (keeps project's "local, no external API cost" philosophy)

Keyword/phrase bank (extendable), consistent with chat.js's existing rule-based approach:
- "in charge of", "coordinating", "coordinator for", "point of contact", "POC for", "organizing committee", "convener", "faculty in-charge"
- Combined with a nearby date/time pattern (regex for dates, "today", "tomorrow", weekday names) to reduce false positives.
- Poster images run through OCR first, then the same phrase bank is applied to the extracted text.
- Confidence gating: require at least one role-keyword + one event-context word (event name capitalization pattern, or "Fest", "Seminar", "Workshop", "Viva", "Talk") before returning `matchFound: true`. This avoids false positives on generic emails.

---

## 8. Privacy/Retention Rules (must be enforced in code, not just policy)

1. Never write raw email subject/body/attachment content to disk or DB.
2. Never log raw content to console/server logs.
3. Only `suggested_notice` (short string) and a boolean go into `notice_scan_logs`.
4. OAuth refresh token stored encrypted; decrypt only in-memory at scan time.
5. `/teachers/email/scan` must verify `req.teacherId` (from JWT) matches the teacher whose inbox is being scanned — no cross-teacher scanning possible, ever.
6. Provide `/teachers/email/disconnect` that revokes the Google token and deletes the encrypted token row — full teacher control to turn this off.

---

## 9. Implementation Phases

| Phase | Deliverable |
|---|---|
| 1 | Google Cloud OAuth2 app setup (client ID/secret), `cryptoVault.js`, DB migration |
| 2 | `emailOAuth.js` + connect/callback routes, encrypted token storage |
| 3 | `emailScanner.js` (Gmail API fetch) + `eventClassifier.js` (text matching) |
| 4 | `posterOCR.js` (tesseract.js integration) wired into scanner for image attachments |
| 5 | `/teachers/email/scan` route wiring it all together, returns suggestion only |
| 6 | Frontend: Connect button + Scan button + pre-fill logic in existing notice panel |
| 7 | Disconnect flow + audit log table + manual QA against existing notice/status flow to confirm zero regressions |

---

## 10. Prompt for the AI Building Agent

Copy-paste this directly to your coding agent (e.g. Claude Code) as the task brief:

> **Task: Add an optional "Email Notice Auto-Detect" feature to the existing Teacher Cabin Finder project. This is strictly additive — do not modify, refactor, or touch any existing file's core logic unless explicitly instructed below.**
>
> **Context:** The project has a working teacher dashboard where teachers manually set a `status` and a free-text `statusNotice`, saved via `PUT /teachers/status`, called from `handleStatusChange` and `handleNoticeSubmit` in the frontend. The chatbot (`backend/routes/chat.js`) reads `status_notice` from the `teachers` table and includes it in responses to students. Do not change any of this existing logic.
>
> **What to build:**
> 1. New DB migration adding columns `email_oauth_refresh_token_enc` (text), `email_scan_enabled` (boolean, default false), `last_email_scan_at` (timestamp) to `teachers`, and a new table `notice_scan_logs` (id, teacher_id FK, scanned_at, source_type, match_found, suggested_notice). Do not alter any existing column.
> 2. `backend/utils/cryptoVault.js`: AES-256-GCM encrypt/decrypt helper functions, key sourced from a new env var `TOKEN_ENCRYPTION_KEY`.
> 3. `backend/services/emailOAuth.js`: Google OAuth2 flow (using `googleapis` npm package) to let a teacher connect their institutional Gmail/Workspace account. Store only the encrypted refresh token via `cryptoVault.js`.
> 4. `backend/services/eventClassifier.js`: a rule-based (regex/keyword, NOT ML/external API) classifier that detects "in-charge/coordinator/POC for an event" language in a block of text, requiring both a role-keyword match AND an event-context word/date pattern nearby to reduce false positives. Return `{ matchFound: boolean, suggestedNotice: string | null }`.
> 5. `backend/services/posterOCR.js`: use `tesseract.js` (local OCR, no external API) to extract text from image attachments (png/jpg), then pass extracted text through `eventClassifier.js`.
> 6. `backend/services/emailScanner.js`: fetch the teacher's recent inbox (last 48 hours, using the decrypted OAuth token) via Gmail API, iterate messages, run text bodies through `eventClassifier.js` and image attachments through `posterOCR.js`, return the first (or highest-confidence) match.
> 7. `backend/routes/emailNotice.js`, gated by the existing `requireAuth` middleware:
>    - `POST /teachers/email/connect` — starts OAuth flow
>    - `GET /teachers/email/callback` — OAuth redirect handler, encrypts and stores refresh token
>    - `POST /teachers/email/scan` — verifies `req.teacherId` matches the target teacher, runs `emailScanner.js`, logs a row to `notice_scan_logs` (metadata only, never raw content), returns `{ matchFound, suggestedNotice, sourceType }` **without writing to `teachers.status_notice`**
>    - `POST /teachers/email/disconnect` — revokes token with Google, deletes the encrypted token row
> 8. Frontend: in the existing notice panel component, add a "Connect Email" button (shown if not connected) and a "Scan for Notice" button (shown if connected). On scan success with `matchFound: true`, set the existing `statusNotice` state to the suggested value (pre-fill only — do not call the save handler automatically). On `matchFound: false`, show a small inline hint that no relevant email was found. Do not modify `handleStatusChange`, `handleNoticeSubmit`, or the status card grid in any way.
> 9. **Critical constraints:**
>    - Never persist raw email subject/body/attachment content anywhere (disk, DB, or logs) — only the derived short `suggestedNotice` string may be stored, and only in `notice_scan_logs`.
>    - The scan route must be scoped so a teacher can only trigger a scan for their own account (verify via JWT `teacherId`, no exceptions).
>    - Do not introduce any new external paid API — Gmail API (free tier, OAuth) and tesseract.js (local OCR) only.
>    - Do not touch `chat.js`, the fuzzy-matching logic, the timetable/PDF parser, or the status card grid.
>    - Add the new env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`) to `.env.example` but do not commit real values.
> 10. After implementation, verify manually that the existing manual notice flow (typing + Save button) still works exactly as before when email scan is disabled or returns no match.

---

## 11. Open Questions for You to Decide Before Build

- Confirm institutional email is Google Workspace (Gmail API) — if it's Outlook/Microsoft 365 instead, the OAuth provider and API calls change (Microsoft Graph API instead of Gmail API); let me know if that's the case.
- Auto-fill-and-confirm (recommended, described above) vs. fully automatic save with no teacher review?
- Scan trigger: manual "Scan Now" button only, or also a scheduled background scan (e.g. every morning)?
