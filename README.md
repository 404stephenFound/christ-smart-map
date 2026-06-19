# ChristSmart Cabin Finder 🎓

> **Real-Time Teacher Location & Availability Assistant for Christ University**

A full-stack web application that allows students to instantly locate any faculty member's cabin, check their real-time availability status, and browse their class timetable — all through a conversational chatbot interface.

---

## ✨ Features

### 🤖 Student Chatbot Interface
- **Natural Language Search** — Ask questions like *"Where is Dr. Smith?"*, *"Who is in cabin 402?"*, or *"Show me CSE faculty"*
- **Fuzzy Name Matching** — Uses a Levenshtein distance algorithm to match names even with typos or partial input
- **Department Filtering** — Sidebar filter lets students browse all teachers by department
- **Block/Cabin Lookup** — Query by specific block (`"Who is in Devdan Block?"`) or room number
- **Availability Status** — Chatbot reports whether a teacher is Available, In Class, In Meeting, conducting a PhD Viva, or Away
- **Greeting Recognizer** — Smart greeting detection (`hi`, `hello`, `hey`, etc.) returns a friendly welcome
- **Clean, Professional Responses** — All bot replies strip emojis and markdown formatting for a professional look

### 👨‍🏫 Teacher Portal (Authenticated)
- **Secure Registration** — Faculty-only registration enforced by:
  - A **Faculty Signup Passcode** (`REGISTRATION_SECRET`)
  - An **email domain restriction** (only `@christuniversity.in` emails allowed)
  - **Student roll number pattern blocking** (emails starting with digits are rejected)
  - An optional **pre-approved allowlist** (`allowed_teachers` database table)
- **Real-Time Status Updates** — Teachers toggle their current status with a notice message in one click:
  - `AVAILABLE` · `IN_CLASS` · `IN_MEETING` · `PHD_VIVA` · `AWAY`
- **Timetable Upload** — Upload PDF or image timetable files (max 5MB)
- **Smart PDF Parsing** — On PDF upload, the server extracts course codes (e.g. `CS101`, `CIVIL302`) and auto-populates the digital schedule grid
- **Digital Schedule Builder** — Interactive 6×6 grid (Mon–Sat × P1–P6) for manually entering course slots
- **Saturday Half-Day** — Saturday afternoons (P4, P5, P6) are automatically locked as `HALF DAY`
- **Profile Management** — Update name, designation, department, block, and room number

### 🎨 Design System
- **Dark / Light Mode Toggle** — System preference–aware theme with one-click toggle
- **Minimalist Design** — Clean glassmorphism cards, soft gradients, and micro-animations
- **Responsive Layout** — Adapts across all screen sizes
- **Logged-In Teacher Display** — The header always shows which teacher is currently signed in

---

## 🗂️ Project Structure

```
chatbot/
├── backend/                      # Express.js API server
│   ├── middleware/
│   │   └── auth.js               # JWT cookie verification middleware
│   ├── routes/
│   │   ├── auth.js               # Register, login, logout, /me endpoints
│   │   ├── chat.js               # Chatbot query processing engine
│   │   └── teachers.js           # Teacher profile, status, timetable upload
│   ├── uploads/                  # Timetable file uploads (gitignored except .gitkeep)
│   ├── db.js                     # PostgreSQL connection pool + auto-schema init
│   ├── server.js                 # Express app entry point with security middleware
│   ├── package.json
│   └── .env                      # Environment configuration (see setup below)
│
└── frontend/                     # Vite + React frontend
    └── src/
        ├── components/
        │   ├── ChatWindow.jsx    # Student chatbot UI
        │   ├── Login.jsx         # Teacher login & registration form
        │   ├── Navbar.jsx        # Header with theme toggle & teacher info
        │   └── TeacherDashboard.jsx # Teacher portal for status & timetable
        ├── App.jsx               # Root component with routing logic
        ├── App.css               # Component-scoped styles
        └── index.css             # Global design system & CSS variables
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 19 + Vite 8 |
| Frontend Icons | Lucide React |
| Styling | Vanilla CSS (custom design system) |
| Backend Framework | Node.js + Express 4 |
| Database | PostgreSQL (via `pg` connection pool) |
| Authentication | JWT (HttpOnly cookies via `jsonwebtoken`) |
| Password Hashing | `bcryptjs` |
| File Uploads | `multer` (disk storage, 5MB limit) |
| PDF Parsing | `pdf-parse` |
| Security Headers | `helmet` |
| Rate Limiting | `express-rate-limit` |
| CORS | `cors` |
| Cookie Parsing | `cookie-parser` |

---

## 📋 Requirements

### System Requirements
- **Node.js** `>= 18.x`
- **npm** `>= 9.x`
- **PostgreSQL** `>= 14.x` (running locally on default port `5432`)

### Backend npm Packages (`backend/package.json`)
| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.19.2 | HTTP server framework |
| `pg` | ^8.11.5 | PostgreSQL client & connection pool |
| `bcryptjs` | ^2.4.3 | Secure password hashing |
| `jsonwebtoken` | ^9.0.2 | JWT token generation and verification |
| `dotenv` | ^16.4.5 | Environment variable loader |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing headers |
| `helmet` | ^7.1.0 | Security-related HTTP headers |
| `express-rate-limit` | ^7.2.0 | API brute-force protection |
| `cookie-parser` | ^1.4.6 | Parse HttpOnly cookies |
| `multer` | ^1.4.5-lts.1 | Multipart file upload handling |
| `pdf-parse` | ^2.4.5 | Extract text from uploaded PDF timetables |

### Frontend npm Packages (`frontend/package.json`)
| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2.6 | UI component library |
| `react-dom` | ^19.2.6 | React DOM rendering |
| `lucide-react` | ^1.21.0 | Icon library |
| `vite` | ^8.0.12 | Dev server and bundler (devDependency) |
| `@vitejs/plugin-react` | ^6.0.1 | Vite plugin for JSX (devDependency) |

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/404stephenFound/christ-smart-map.git
cd christ-smart-map
```

### 2. Configure PostgreSQL

Make sure PostgreSQL is running on your machine. The app will automatically create the database and tables on first startup.

Default PostgreSQL credentials used:
- **User**: `postgres`
- **Password**: `root`
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `cabin_finder` (auto-created if not present)

### 3. Configure the Backend Environment

Create or edit `backend/.env` with the following keys:

```env
# PostgreSQL connection string — adjust username/password/port if needed
DATABASE_URL="postgresql://postgres:root@localhost:5432/cabin_finder?schema=public"

# Secret key used to sign JWT authentication tokens
JWT_SECRET="your-super-secret-jwt-key-here"

# Port the Express server will listen on
PORT=5000

# Faculty registration passcode (shared only with real faculty members)
REGISTRATION_SECRET="CHRIST_FACULTY_2026"

# Only emails ending with this domain can register as teachers
ALLOWED_EMAIL_DOMAIN="@christuniversity.in"
```

> ⚠️ **Never commit your `.env` file.** It is excluded via `.gitignore`.

### 4. Install & Start the Backend

```bash
cd backend
npm install
npm run dev
```

The API server will start at **http://localhost:5000**

On first boot, it will:
1. Connect to your PostgreSQL `postgres` database
2. Auto-create the `cabin_finder` database if it doesn't exist
3. Auto-create three tables: `teachers`, `chat_logs`, `allowed_teachers`

### 5. Install & Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will start at **http://localhost:5173**

---

## 🔐 Security Architecture

### Registration Controls (3 Layers)

| Layer | Check | How |
|---|---|---|
| **1. Faculty Passcode** | `signupKey` must match `REGISTRATION_SECRET` in `.env` | Backend rejects with `403` if passcode is wrong |
| **2. Email Domain** | Email must end with `ALLOWED_EMAIL_DOMAIN` | Backend rejects with `400` for non-faculty domains |
| **3. Roll Number Block** | Email prefix must not be all digits (e.g. `2410234@...`) | Blocks student roll number patterns |
| **4. Allowlist (optional)** | If `allowed_teachers` table has rows, only pre-listed emails can register | Admin can populate this table for strict control |

### Session Security
- JWT tokens are stored in **HttpOnly cookies** — inaccessible to JavaScript (prevents XSS theft)
- `sameSite: 'strict'` prevents CSRF attacks
- Token expiry: **1 day**

### API Rate Limiting
- General API: **200 requests / 15 minutes** per IP
- `/api/auth/login` and `/api/auth/register`: **30 requests / 15 minutes** per IP

### File Upload Security
- Allowed types: `.pdf`, `.png`, `.jpg`, `.jpeg`
- Max file size: **5 MB**
- Filenames are replaced with a random UUID to prevent path traversal attacks
- Old timetable files are deleted when a new one is uploaded

---

## 🧩 API Endpoints

### Auth Routes (`/api/auth`)
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/register` | No | Register a new teacher (with passcode + domain validation) |
| POST | `/login` | No | Login and receive a JWT cookie |
| POST | `/logout` | No | Clear the auth cookie |
| GET | `/me` | ✅ Yes | Fetch the current logged-in teacher's profile |

### Teacher Routes (`/api/teachers`)
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/` | No | List all teachers (public directory) |
| GET | `/:id` | No | Fetch a single teacher by ID |
| PUT | `/status` | ✅ Yes | Update status and optional notice message |
| PUT | `/profile` | ✅ Yes | Update name, designation, department, cabin |
| PUT | `/schedule` | ✅ Yes | Update the digital timetable schedule (JSONB) |
| POST | `/upload-timetable` | ✅ Yes | Upload a PDF/image timetable and auto-parse it |

### Chat Route (`/api/chat`)
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/` | No | Submit a natural language query and get a chatbot response |

---

## 📅 Timetable System

### Period Timings (Mon–Fri)
| Period | Time |
|---|---|
| P1 | 09:00 – 10:00 |
| P2 | 10:00 – 11:00 |
| P3 | 11:00 – 12:00 |
| Lunch | 12:00 – 01:00 |
| P4 | 01:00 – 02:00 |
| P5 | 02:00 – 03:00 |
| P6 | 03:00 – 04:00 |

### Saturday (Half-Day)
- P1, P2, P3 are normal class periods
- P4, P5, P6 are locked as **HALF DAY**

### Smart PDF Parsing
When a PDF is uploaded, the backend:
1. Extracts raw text using `pdf-parse`
2. Scans for course code patterns matching `[A-Za-z]{2,5} + digits` (e.g. `CS101`, `CIVIL302`, `ADSE-204`)
3. Distributes detected courses across the Mon–Sat period grid sequentially
4. Falls back to a department-code–based template if no courses are detected

---

## 🏢 Supported Departments

`CSE` · `ADSE` · `Electronics` · `Electrical` · `Mechanical` · `Robotics & Mechatronics` · `Psychology` · `BBA` · `Sciences & Humanities` · `Civil`

### Supported Building Blocks
`Block 1` · `Block 2` · `Block 3` · `Block 4` · `Block 5` · `Block 6` · `Architecture Block` · `Devdan Block`

---

## 💬 Chatbot Query Examples

```
"Where is Dr. Anjali's cabin?"
"Is anyone available in Block 3?"
"Who is in cabin 402?"
"Show me all CSE teachers"
"What is Prof. Rajan's timetable?"
"Who is in the Devdan Block?"
"List available teachers"
"Is Dr. Priya in her cabin?"
```

---

## 🔄 Application Flow

```
Student Query
    │
    ▼
POST /api/chat
    │
    ├── Greeting Detection
    ├── Block Lookup (e.g. "Block 1")
    ├── Cabin/Room Number Lookup (e.g. "room 402")
    ├── Department Match (e.g. "CSE")
    ├── Availability List (e.g. "who is available")
    └── Fuzzy Name Match (Levenshtein distance)
            │
            ▼
    JSON Response → ChatWindow renders Teacher Cards
```

---

## 🛡️ Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Full PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Secret key for signing JWT tokens |
| `PORT` | No | `5000` | Express server port |
| `REGISTRATION_SECRET` | ✅ | — | Faculty-only passcode for registration |
| `ALLOWED_EMAIL_DOMAIN` | ✅ | — | Email domain suffix restriction (e.g. `@christuniversity.in`) |

---

## 📁 Database Schema

### `teachers`
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated unique teacher ID |
| `email` | VARCHAR(255) UNIQUE | Login email |
| `password_hash` | VARCHAR(255) | bcrypt-hashed password |
| `name` | VARCHAR(255) | Full name including title |
| `designation` | VARCHAR(255) | e.g. Assistant Professor |
| `department` | VARCHAR(255) | e.g. CSE |
| `cabin_number` | VARCHAR(100) | e.g. Block 2 - Room 204 |
| `status` | VARCHAR(50) | AVAILABLE / IN_CLASS / IN_MEETING / PHD_VIVA / AWAY |
| `status_notice` | VARCHAR(255) | Optional notice message |
| `timetable_url` | VARCHAR(255) | Path to uploaded timetable file |
| `schedule_data` | JSONB | Digital timetable as structured JSON |
| `created_at` | TIMESTAMP | Account creation time |
| `updated_at` | TIMESTAMP | Last update time |

### `chat_logs`
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Log entry ID |
| `query` | TEXT | The student's raw query |
| `matched_teacher_id` | UUID (FK) | Teacher matched (if any) |
| `intent` | VARCHAR(100) | Detected intent type |
| `created_at` | TIMESTAMP | Query time |

### `allowed_teachers`
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Entry ID |
| `email` | VARCHAR(255) UNIQUE | Pre-approved faculty email |
| `created_at` | TIMESTAMP | When the entry was added |

---

## 🚧 Known Limitations & Future Improvements

- [ ] `backend/routes/auth.js` is committed as an empty placeholder — the full implementation resides in the running server. Consider adding the complete file to the repository.
- [ ] No admin dashboard for managing the `allowed_teachers` allowlist yet (must be managed via direct DB inserts)
- [ ] No real-time WebSocket notifications when a teacher updates their status
- [ ] PDF parsing is text-based only — scanned image PDFs will fall back to the smart mock template
- [ ] Production deployment would require setting `secure: true` on cookies (requires HTTPS)

---

## 👤 Author

**Stephen Akash J**
Christ University — Engineering Department
GitHub: [@404stephenFound](https://github.com/404stephenFound)

---

## 📄 License

This project is for academic and institutional use within Christ University.
