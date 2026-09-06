# 🎨 Intelligent Poster, Flyer & Circular Auto-Notice Detection Plan

## Overview
In a university environment (like Christ University), official notices, seminars, conferences, fests, and workshops are rarely communicated through simple plain text emails. Instead, **90%+ of event emails consist of attached image posters (PNG/JPG), embedded flyers, or PDF circulars**. 

Furthermore, the teacher receiving or scanning the email might not be the author of the email; rather, their name (e.g. `Dr. Stephen Akash` or `Prof. Stephen`) is printed **inside the poster graphic** under sections such as:
* `Faculty Coordinator(s): Dr. Stephen Akash, Dr. Jane Doe`
* `Convener: Dr. John Smith | Co-Convener: Dr. Stephen Akash`
* `Organizing Committee / Faculty In-Charge: Prof. Stephen`
* `Resource Person / Speaker / Session Chair: Dr. Stephen Akash`

This document details the multi-modal pipeline to reliably extract event context, match the logged-in teacher's identity with proximity-based role extraction, and generate precise status notices.

---

## Architecture & Processing Pipeline

```
   Gmail Inbox Scan
         │
         ├──> Attached Images (PNG, JPG, WebP) / Inline CID Images
         ├──> PDF Brochures & Circulars (via pdf-parse)
         └──> Email Body & Subject Text
                     │
                     ▼
         [ Multi-Modal Extraction Engine ]
         ├── If GEMINI_API_KEY: Gemini 1.5 Flash Vision API (High-precision visual comprehension)
         └── If Offline / Local: Tesseract.js OCR + Layout Normalizer
                     │
                     ▼
         [ Teacher Identity & Role Proximity Matcher ]
         ├── Generate Teacher Name Permutations (Dr., Prof., Initials, First/Last)
         ├── Role Triggers (Coordinator, Convener, In-charge, Speaker, Judge, etc.)
         └── Proximity Window Matching (+/- 3 lines of role trigger)
                     │
                     ▼
         [ Event Entity & Notice Generator ]
         ├── Event Title Detection (Banner headline / "National Conference on...")
         ├── Date & Time Extraction (e.g., Oct 15 - 16, 2026)
         ├── Venue Extraction (e.g., Central Block Auditorium)
         └── Formatted Status Notice: "Away - Coordinating [Event] at [Venue] ([Dates])"
                     │
                     ▼
         [ Teacher Dashboard Confirmation Modal ]
         ├── Displays Detected Event, Source File (e.g., flyer.jpg), Role, Venue
         └── Editable preview with 1-click "Accept & Update Status" or "Dismiss"
```

---

## Detailed Step-by-Step Implementation Plan

### 1. Attachment Discovery & Parsing (`backend/services/emailScanner.js`)
* **Image Attachments**: Extracts standard attachments (`image/png`, `image/jpeg`, `image/webp`).
* **Inline CID Images**: Extracts images embedded directly in the HTML body `<img src="cid:...">`.
* **PDF Circulars**: Extracts `.pdf` attachments and processes them with `pdf-parse`.
* **Teacher Context Injection**: Passes logged-in teacher's `name`, `department`, and `email` to the classifier.

### 2. Dual OCR & Vision Pipeline (`backend/services/posterOCR.js`)
* **Gemini Vision Engine (Optional)**: If `GEMINI_API_KEY` is set in `.env`, passes the image buffer directly to Gemini 1.5 Flash Vision to extract structured JSON with zero OCR noise.
* **Local OCR Engine (Default Offline)**: Uses `tesseract.js` worker to extract text, followed by layout normalization and text cleaning.
* **PDF Text Extractor**: Uses `pdf-parse` to convert circular PDFs to readable plain text.

### 3. Named Entity & Proximity Classifier (`backend/services/eventClassifier.js`)
* **Name Variations Generator**:
  - `Stephen Akash` ➔ `['Stephen Akash', 'Dr. Stephen Akash', 'Prof. Stephen Akash', 'Dr. S. Akash', 'Stephen', 'Akash']`
* **Proximity Matching Algorithm**:
  - Searches for role keywords (`Faculty Coordinator`, `Convener`, `Organizing Committee`, `Resource Person`, `In-charge`).
  - Scans +/- 3 lines (or 200 characters) around the role keyword for any match against the teacher's name variations.
* **Event Metadata Extraction**:
  - **Title**: Large title banner or regex matches for `[National/International] [Conference/Symposium/Workshop/Seminar/Hackathon/Fest] on [Title]`.
  - **Date**: Matches `DD/MM/YYYY`, `15th - 16th October`, `Today`, `Tomorrow`.
  - **Venue**: Matches `Auditorium`, `Seminar Hall`, `Block`, `Audi`, `Lab`, `Room`.
* **Status Notice Synthesizer**:
  - Compiles into a clean status notice string without emojis (e.g., `Away - Coordinating National Workshop on Cloud Computing at Sky View Auditorium (Oct 25)`).

### 4. Scan Route Integration (`backend/routes/emailNotice.js`)
* Fetches the teacher profile (`name`, `email`, `department`) on `/scan`.
* Passes profile context to the email & poster scanning pipeline.
* Returns rich payload:
  ```json
  {
    "matchFound": true,
    "suggestedNotice": "Away - Coordinating AI Symposium at Central Block Audi (Oct 15)",
    "role": "Faculty Coordinator",
    "eventName": "AI Symposium 2026",
    "venue": "Central Block Audi",
    "sourceType": "poster",
    "sourceFileName": "ai_symposium_poster.png"
  }
  ```

### 5. Teacher Dashboard Modal UI (`frontend/src/components/TeacherDashboard.jsx`)
* Displays an interactive review card when a notice is detected:
  - Badge indicating whether it came from an **Attached Poster (Image)**, **PDF Circular**, or **Email Body**.
  - Shows the detected event, role, and venue.
  - Allows teacher to adjust the text before saving.
  - Saves directly to the `status_notice` in the database upon clicking **Apply**.
