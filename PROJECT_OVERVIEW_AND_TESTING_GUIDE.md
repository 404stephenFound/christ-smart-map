# 🏛️ ChristSmart Cabin Finder & Email Auto-Notice System
### Complete Project Architecture, Feature Breakdown & Testing Guide

---

## 📌 1. Project Overview: What is this project?

The **ChristSmart Cabin Finder** is an intelligent web-based campus assistance platform designed for Christ University. It solves two major daily campus challenges:

1. **For Students & Visitors**: Finding faculty cabin locations, checking their real-time availability status (e.g., *In Cabin*, *In Class*, *In Meeting*, *Conducting PhD Viva*, *Away*), viewing their weekly timetables, and asking questions via an AI-driven Chatbot.
2. **For Faculty Members (Teachers)**: A self-service portal to manage their profile, upload timetables, set availability status, and publish custom return notices.

---

## ⚡ 2. The New Feature: Email-Based Auto-Notice Detection

### 🎯 The Problem it Solves
Faculty members frequently get assigned duties (such as event coordination, seminar conveners, guest lecture hosts, or exam duties) via university emails. Updating their availability status manually on the dashboard every time is easy to forget.

### 💡 The Solution
We built an **automated email reader integration** on the `Email` branch that:
1. Securely links the teacher's institutional Gmail account via Google OAuth 2.0.
2. Scans recent emails and flyer attachments for event coordination assignments.
3. Automatically extracts the event name and role using an intelligent in-memory NLP Rule Classifier and OCR Engine (`Tesseract.js`).
4. Pre-fills the teacher's status notice (e.g., *`Away - Coordinating National Science Exhibition`*).
5. **Confirm-First Workflow**: Keeps the teacher in control. The teacher can review, edit, and click Save to broadcast the notice to the student chatbot.

---

## 🏗️ 3. How the System is Built (Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vite + React)                │
│   • Student Portal & AI Chatbot Interface                  │
│   • Teacher Dashboard & Availability Controls               │
│   • "Connect Google Email" & "Test Mock Scan" Triggers     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON API (Port 5000)
┌──────────────────────────────▼──────────────────────────────┐
│                  BACKEND (Node.js + Express)                │
│   • Auth & Role-Based Middleware (JWT HttpOnly Cookies)     │
│   • AES-256-GCM Token Encryption (utils/cryptoVault.js)     │
│   • Gmail API Inbox Service (services/emailScanner.js)      │
│   • Rule-Based Regex NLP Engine (services/eventClassifier.js)│
│   • Local Poster OCR Scanner (services/posterOCR.js)        │
└──────────────────────────────┬──────────────────────────────┘
                               │ SQL Queries
┌──────────────────────────────▼──────────────────────────────┐
│                    DATABASE (PostgreSQL)                    │
│   • teachers (Profile, Cabin, Status, Encrypted OAuth Token)│
│   • timetables (Class schedules & upload paths)             │
│   • notice_scan_logs (Audit logs of scan matches)           │
└─────────────────────────────────────────────────────────────┘
```

### Key Technical Pillars:
* **Zero Raw Data Persistence**: Email subjects, message bodies, and attachments are processed strictly in memory and immediately discarded. Only the suggested notice string is returned.
* **Token Encryption at Rest**: Google refresh tokens are encrypted using **AES-256-GCM** before saving to PostgreSQL.
* **Self-Healing Database**: The database schema automatically updates missing columns on server startup without requiring manual SQL migrations.

---

## 🧪 4. How to Test the Application

### 🚀 Starting the Servers

Make sure both development servers are running:
1. **Backend Server** (Port 5000):
   ```bash
   cd backend
   npm run dev
   ```
2. **Frontend Server** (Port 5173):
   ```bash
   cd frontend
   npm run dev
   ```

---

### 🧪 Method A: Quick Test using Mock Scan (Recommended for quick demo)
*No Google setup or API keys required.*

1. Open your browser and go to: **[http://localhost:5173/](http://localhost:5173/)**
   > ⚠️ **Important Note**: Always use `http://localhost:5173/` (not `127.0.0.1`) so that authentication cookies match between frontend and backend.

2. Click on **Teacher Portal** in the top navigation bar.
3. Log in with an existing account:
   * **Email**: `tony.stark@christuniversity.in`
   * **Password**: `password123`
   *(Or click **Register now** to create any new faculty account using passcode `CHRIST_FACULTY_2026`).*

4. On the **Teacher Dashboard**, look at the **Custom Notice / Return Time** section.
5. Click the **`Test Mock Scan`** button with the sparkle icon.
6. **Observe the result**:
   * A success toast notification appears: *"Event notice detected! Please review and click save."*
   * The text input box is automatically pre-filled with:
     👉 **`Away - Coordinating National Science Exhibition`**
7. Click the **Save** icon button to persist the notice.
8. Switch to the **Student Chat** view and ask:
   * *"Where is Dr. Tony Stark?"*
   * The chatbot will respond with the teacher's cabin location and state their current notice: *Away - Coordinating National Science Exhibition*.

---

### 🌐 Method B: Testing with a Real Gmail Account

If you want to test live Gmail scanning:

1. **Configure Google Cloud Credentials**:
   Ensure `backend/.env` contains your Google OAuth Client ID and Secret:
   ```env
   GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your_google_client_secret"
   TOKEN_ENCRYPTION_KEY="your_32_character_encryption_key"
   ```
   *(Ensure `http://localhost:5000/api/teachers/email/callback` is added under Authorized Redirect URIs in Google Cloud Console).*

2. **Connect Account**:
   * On the Teacher Dashboard, click **Connect Google Email**.
   * Sign in with your Google account and grant read-only inbox permission.
   * You will be redirected back to the dashboard with the badge changed to **Google Email Linked**.

3. **Send a Test Email**:
   Send an email from any other account to this connected Gmail address:
   * **Subject**: `Faculty Coordinator Assignment`
   * **Body**: `Dear Professor, you have been designated as the convener for the "National Science Seminar" scheduled for tomorrow.`

4. **Trigger Scan**:
   * Click **Scan Now** on the Teacher Dashboard.
   * The system will scan the inbox, detect the role and event name, and pre-fill:
     👉 **`Away - Coordinating National Science Seminar`**
   * Review and save!

---

## 🔍 5. File Structure Reference

| File Path | Description |
| :--- | :--- |
| `backend/routes/emailNotice.js` | OAuth callback, scan endpoints (`/scan`), and token disconnect |
| `backend/services/emailScanner.js` | Gmail API integration & query compilation |
| `backend/services/eventClassifier.js` | NLP rule-based keyword & event role matcher |
| `backend/services/posterOCR.js` | Local image poster OCR parser using Tesseract.js |
| `backend/utils/cryptoVault.js` | AES-256-GCM symmetric encryption for OAuth tokens |
| `backend/db.js` | Database connection pool & auto-migrating table definitions |
| `frontend/src/components/TeacherDashboard.jsx` | Faculty dashboard with notice pre-fill and email scan UI |
| `frontend/src/components/ChatWindow.jsx` | Student chatbot interface querying teacher status |

---

## 💡 6. Frequently Asked Questions & Troubleshooting

* **Q: Why did I see "Unauthorized: No token provided"?**
  * **A**: Make sure you open the application at `http://localhost:5173/` rather than `http://127.0.0.1:5173/`. Browsers treat `localhost` and `127.0.0.1` as different domains and block cookie sharing.
* **Q: Can the AI change a teacher's status automatically without their permission?**
  * **A**: No. The system strictly follows a **Confirm-First** model. It only suggests the pre-filled text in the input box; the teacher must click Save to publish it.
* **Q: Is any personal email data stored in the database?**
  * **A**: No. Emails are processed in RAM and discarded immediately. Only the final suggested notice string and timestamp are logged for auditing.
