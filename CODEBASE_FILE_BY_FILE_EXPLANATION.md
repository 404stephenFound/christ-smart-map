# 📚 Codebase Architecture & File-by-File Detailed Guide

This document breaks down every file and folder in the **ChristSmart Cabin Finder & Email Auto-Notice System**. It is structured to help you explain the architecture clearly to professors, team members, or evaluators.

---

## 🧭 High-Level Architecture Overview

The system is built as a modern, decoupled client-server architecture:
* **Backend**: Node.js + Express + PostgreSQL (Modular Route-Service-Controller architecture)
* **Frontend**: React (SPA) + Vite + Vanilla CSS Design System with dynamic Dark/Light themes
* **Authentication**: JWT stored in secure `HttpOnly` cookies with `SameSite: 'lax'`
* **AI & Parsing Subsystem**: Regex Rule NLP Classifier + `Tesseract.js` OCR + Google Gmail API

---

# 🖥️ Part 1: Backend Files (`backend/`)

The backend handles all business logic, database queries, authentication, and email parsing.

```
backend/
├── server.js               <-- Central Express entry point & middleware pipeline
├── db.js                   <-- PostgreSQL connection pool & self-healing table definitions
├── middleware/
│   └── auth.js             <-- JWT authentication & cookie verification middleware
├── routes/
│   ├── auth.js             <-- Teacher registration, login, logout, & session verification
│   ├── teachers.js         <-- Faculty directory, profile updates, status, & timetable uploads
│   ├── chat.js             <-- Student chatbot NLP query processor & fuzzy teacher matching
│   └── emailNotice.js      <-- Google OAuth2 endpoints, inbox scanning, & mock triggers
├── services/
│   ├── emailScanner.js     <-- Gmail API inbox search, message retrieval, & query compilation
│   ├── eventClassifier.js  <-- NLP rule-based keyword & event role parser
│   └── posterOCR.js        <-- In-memory OCR scanner for flyer attachments via Tesseract.js
├── utils/
│   └── cryptoVault.js      <-- AES-256-GCM symmetric token encryption/decryption
└── uploads/                <-- Storage directory for faculty uploaded timetable files
```

---

### 1. `backend/server.js` (Main Server Entry Point)
* **Role**: Starts the Express web application and configures global middleware.
* **What it does**:
  1. **Security**: Applies `helmet` with `crossOriginResourcePolicy: "cross-origin"` so the frontend can securely preview uploaded timetable PDFs/images.
  2. **CORS**: Configures Cross-Origin Resource Sharing for `http://localhost:5173` and `http://127.0.0.1:5173` with `credentials: true`.
  3. **Parsers**: Parses incoming JSON bodies (`express.json()`) and cookies (`cookieParser()`).
  4. **Rate Limiting**: Protects APIs against DDoS and brute-force password guessing using `express-rate-limit`.
  5. **Static File Serving**: Serves the `uploads/` directory on `/uploads`.
  6. **Route Registration**: Mounts the 4 main routers (`/api/auth`, `/api/teachers`, `/api/chat`, `/api/teachers/email`).
  7. **Startup Database Verification**: Invokes `initializeDatabase()` from `db.js` before calling `app.listen(5000)`.

---

### 2. `backend/db.js` (Database Connection & Self-Healing Schemas)
* **Role**: Manages the PostgreSQL database connection pool using the `pg` library.
* **What it does**:
  1. Creates a connection pool using `DATABASE_URL` from `.env`.
  2. **Self-Healing Initialization (`initializeDatabase`)**:
     * Automatically creates the database `cabin_finder` if it does not exist.
     * Enables `pgcrypto` extension for generating UUID primary keys (`gen_random_uuid()`).
     * Automatically creates/updates the following tables:
       * **`teachers`**: Stores teacher ID, email, password hash, name, designation, department, cabin location, availability status, custom notice, weekly schedule JSON, and encrypted OAuth tokens.
       * **`timetables`**: Stores uploaded timetable metadata (URL, file type, upload timestamp).
       * **`faculty_whitelist`**: Optional table storing pre-approved faculty emails.
       * **`notice_scan_logs`**: Audit log recording every email scan attempt, timestamp, match status, and detected notice.

---

### 3. `backend/middleware/auth.js` (Authentication Middleware)
* **Role**: Protects private faculty routes from unauthorized access.
* **What it does**:
  * Extracts the JWT session token from `req.cookies.token`.
  * Verifies the cryptographic signature using `process.env.JWT_SECRET`.
  * If valid, decodes the token and attaches `req.teacherId` and `req.teacherEmail` to the request object.
  * If missing or invalid, returns HTTP `401 Unauthorized`.

---

### 4. `backend/routes/auth.js` (Authentication Controller)
* **Role**: Handles faculty registration, login, logout, and session check.
* **Endpoints**:
  * `POST /register`: Validates institutional email domain (`@christuniversity.in`), verifies the faculty signup key (`CHRIST_FACULTY_2026`), hashes password with `bcrypt`, creates the teacher record in PostgreSQL, generates a JWT token, and sets a secure HttpOnly cookie.
  * `POST /login`: Validates email and password using `bcrypt.compare`, issues a JWT token in an HttpOnly cookie with `SameSite: 'lax'`, and returns profile data.
  * `POST /logout`: Clears the authentication cookie from the browser.
  * `GET /me`: Returns the currently logged-in teacher's session details (omits sensitive password hashes and OAuth keys).

---

### 5. `backend/routes/teachers.js` (Faculty & Dashboard Controller)
* **Role**: Manages faculty directory browsing and profile updates.
* **Endpoints**:
  * `GET /`: Returns the public list of faculty members with search and department filtering.
  * `GET /:id`: Retrieves complete details for a single teacher (cabin number, availability status, custom notice, timetable).
  * `PUT /profile`: Updates teacher name, designation, department, block, and room number.
  * `PUT /status`: Updates real-time availability status (*Available in Cabin*, *In Class*, *In Meeting*, *Conducting PhD Viva*, *Away*) and custom return notices.
  * `POST /timetable`: Handles file uploads (PDF, PNG, JPG) using `multer`, saves them to `uploads/`, and links the URL to the teacher.
  * `PUT /schedule`: Saves the digital weekly timetable matrix (Monday–Friday, Periods 1–6).

---

### 6. `backend/routes/chat.js` (Student AI Assistant Controller)
* **Role**: Natural language processing and fuzzy question answering for students.
* **What it does**:
  * Parses incoming natural language queries from students (e.g., *"Where is Dr. Stephan?"*, *"Is Tony Stark in his cabin right now?"*, *"Show timetable for Dr. John"*).
  * Identifies student intent (Cabin Location, Real-Time Availability, Period Timetable, Department Lookup, Help).
  * Uses a **Fuzzy Similarity Matcher** to find teachers even when students make spelling mistakes.
  * Formats friendly conversational responses displaying cabin room, block, status badges, and active return notices.

---

### 7. `backend/routes/emailNotice.js` (Email Auto-Notice Controller)
* **Role**: Manages Google OAuth 2.0 connection, inbox scanning, and notice generation.
* **Endpoints**:
  * `GET /auth-url`: Generates Google OAuth consent screen URL with read-only Gmail scope.
  * `GET /callback`: Handles Google OAuth redirect, exchanges code for refresh token, encrypts token via `cryptoVault.js`, saves encrypted token to database, and redirects back to dashboard.
  * `POST /scan`: Scans teacher's Gmail inbox for recent coordination emails, parses event notices, logs the scan in `notice_scan_logs`, and returns the suggested notice string. *(Also supports `?mock=true` for instant one-click testing without real Google account)*.
  * `POST /disconnect`: Revokes token, wipes encrypted credentials from database, and disables email scan.

---

### 8. `backend/services/emailScanner.js` (Gmail API Service)
* **Role**: Interfaces with Google Cloud Gmail API.
* **What it does**:
  * Authenticates using the decrypted OAuth refresh token.
  * Compiles Gmail search queries targeting recent emails containing coordination keywords (e.g., *coordinator, convener, seminar, conference, workshop*).
  * Decodes MIME message payloads (plain text & HTML).
  * Extracts image attachments (flyers/posters) and feeds them to `posterOCR.js`.
  * **Zero Raw Data Persistence**: Immediately discards email contents from RAM after extraction.

---

### 9. `backend/services/eventClassifier.js` (NLP Rule-Based Classifier)
* **Role**: Extracts event roles and event names from text.
* **What it does**:
  * Matches coordination roles (*convener, faculty coordinator, in-charge, organizer, organizing secretary, session chair*).
  * Performs proximity parsing on prepositions (e.g., *for the "...", of "...", to coordinate "..."*) to extract clean event titles.
  * Outputs standardized notice strings (e.g., *`Away - Coordinating National Science Exhibition`*).

---

### 10. `backend/services/posterOCR.js` (Optical Character Recognition Engine)
* **Role**: Extracts text from flyer/poster image attachments.
* **What it does**:
  * Uses **`Tesseract.js`** to perform in-memory OCR on image buffers (PNG/JPG).
  * Extracts printed text from event posters without saving temporary image files to disk.
  * Passes extracted text to `eventClassifier.js` to discover event assignments announced via image posters.

---

### 11. `backend/utils/cryptoVault.js` (AES Token Encryption Vault)
* **Role**: Cryptographic security for stored OAuth tokens.
* **What it does**:
  * Uses **AES-256-GCM** authenticated symmetric encryption.
  * Generates a unique 12-byte random Initialization Vector (IV) for every encryption.
  * Decrypts tokens in-memory when scanning the inbox.
  * Protects teacher accounts if the database is ever compromised.

---

# 🎨 Part 2: Frontend Files (`frontend/src/`)

The frontend is a single-page React application built with Vite and modern CSS.

```
frontend/src/
├── main.jsx                       <-- React DOM entry point
├── App.jsx                        <-- Root view switcher, theme manager, & session handler
├── App.css / index.css            <-- Global design system, glassmorphic tokens, & responsive layout
└── components/
    ├── Navbar.jsx                 <-- Header navigation, view toggle, & theme switch
    ├── ChatWindow.jsx             <-- Student AI chatbot interface & faculty directory
    ├── Login.jsx                  <-- Faculty login & registration forms
    └── TeacherDashboard.jsx       <-- Teacher profile, availability, notice & email scanner
```

---

### 1. `frontend/src/App.jsx` (Root App Controller)
* **Role**: Global application state, routing, and session restoration.
* **What it does**:
  * Manages active view: `chat` (Student Portal), `auth` (Teacher Login/Register), or `dashboard` (Teacher Dashboard).
  * Restores teacher login session on startup via `GET /api/auth/me`.
  * Manages global **Dark / Light Theme** stored in `localStorage`.
  * Renders global Toast alert notifications.
  * Manages the Timetable preview popup modal.

---

### 2. `frontend/src/components/Navbar.jsx` (Navigation Bar)
* **Role**: Header navigation and user status indicator.
* **What it does**:
  * Displays application logo and name ("ChristSmart Cabin Finder").
  * Switches between Student Chatbot view and Teacher Portal.
  * Theme toggle button (Sun / Moon icon).
  * Shows logged-in teacher avatar and Logout button.

---

### 3. `frontend/src/components/ChatWindow.jsx` (Student Portal & AI Chatbot)
* **Role**: The student-facing campus assistant interface.
* **What it does**:
  * **Chat Stream**: Interactive messaging interface with typing indicators and formatted answers.
  * **Quick Prompt Chips**: One-click suggestion queries (*"Find cabin locations"*, *"Check teacher availability"*, *"Search faculty"*).
  * **Faculty Directory Sidebar**: Live searchable list of teachers with real-time colored status badges (🟢 Available, 🟡 In Class, 🔴 In Meeting, 🟣 PhD Viva).
  * **Timetable Viewer**: Button to view teacher's uploaded timetable schedule.

---

### 4. `frontend/src/components/TeacherDashboard.jsx` (Faculty Management Portal)
* **Role**: Comprehensive control dashboard for teachers.
* **What it does**:
  * **Availability Status Panel**: One-click buttons to change status (*Available in Cabin*, *In Class*, *In Meeting*, *Conducting PhD Viva*, *Away*).
  * **Custom Notice & Email Scanner Panel**:
    * Text box to enter custom return notices.
    * **`Connect Google Email`**: Triggers Google OAuth login.
    * **`Scan Now`**: Scans inbox and pre-fills detected event notice.
    * **`Test Mock Scan`**: One-click demo button that instantly tests notice pre-fill without real credentials.
    * **`Disconnect`**: Unlinks Google account.
  * **Profile Settings**: Form to update Name, Designation, Department, Block, and Room Number.
  * **Timetable File Upload**: Uploads PDF or image timetable files.
  * **Digital Weekly Timetable Grid**: Interactive period-by-period timetable schedule editor (Monday–Friday, Period 1–6).

---

### 5. `frontend/src/components/Login.jsx` (Teacher Authentication Form)
* **Role**: Faculty login and registration portal.
* **What it does**:
  * **Sign In Tab**: Email and password login.
  * **Register Tab**: Registration form with Full Name, Designation, Department dropdown, Block dropdown, Room number, Signup Passcode (`CHRIST_FACULTY_2026`), Institutional Email (`@christuniversity.in`), and Password.

---

### 6. `frontend/src/index.css` & `App.css` (Design System)
* **Role**: Styling and visual aesthetics.
* **What it does**:
  * Defines CSS Custom Properties (variables) for dark and light color palettes.
  * Implements glassmorphism backdrop blur effects, sleek card borders, and smooth hover micro-animations.
  * Fully responsive on mobile, tablet, and desktop screens.

---

## 💡 Summary Cheat-Sheet

* **Where is the AI Chatbot logic?** -> `backend/routes/chat.js`
* **Where is the Google Email Scanner logic?** -> `backend/services/emailScanner.js` & `backend/routes/emailNotice.js`
* **Where is the NLP Event Role Extractor?** -> `backend/services/eventClassifier.js`
* **Where is the Poster OCR Reader?** -> `backend/services/posterOCR.js`
* **Where is the AES Encryption Vault?** -> `backend/utils/cryptoVault.js`
* **Where is the Teacher Dashboard UI?** -> `frontend/src/components/TeacherDashboard.jsx`
* **Where is the Student Chatbot UI?** -> `frontend/src/components/ChatWindow.jsx`
