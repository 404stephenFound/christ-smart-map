# 🔑 API Keys & Environment Variables Setup Guide
### Complete walkthrough on how to acquire and generate every key in `.env`

This document provides a step-by-step guide for developers on where and how to acquire or generate each key required in the `backend/.env` file.

---

## 📋 Summary of All Required Keys

| Key Name | Purpose | How to Acquire |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | Local PostgreSQL database installation |
| `JWT_SECRET` | Signing secret for session login tokens | Generated via Node.js / terminal command |
| `PORT` | Local Express server port | Default `5000` |
| `REGISTRATION_SECRET` | Security passcode for teacher registration | Custom secret passcode (e.g. `CHRIST_FACULTY_2026`) |
| `ALLOWED_EMAIL_DOMAIN` | Restrict teacher signups to institution | Set to `@christuniversity.in` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID for Gmail API | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret for Gmail API | Google Cloud Console |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM encryption key for stored tokens | Generated via Node.js `crypto` |

---

## 🛠️ Step-by-Step Acquisition Instructions

### 1. 🌐 Google OAuth 2.0 (`GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`)

These keys allow the application to securely connect to Google APIs and read emails using OAuth 2.0.

#### Step 1.1: Open Google Cloud Console
1. Go to the **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Log in with your Google account.
3. In the top navbar, click the project dropdown and click **New Project**.
4. Name your project (e.g., `ChristSmart-Campus-Assistant`) and click **Create**.

#### Step 1.2: Enable the Gmail API
1. In the search bar at the top, search for **Gmail API**.
2. Click on **Gmail API** from the Marketplace search results.
3. Click the blue **Enable** button.

#### Step 1.3: Configure the OAuth Consent Screen
1. On the left sidebar, navigate to **APIs & Services** > **OAuth consent screen**.
2. Select **External** (or **Internal** if using a Google Workspace organization account) and click **Create**.
3. Fill in the required fields:
   * **App name**: `ChristSmart Cabin Finder`
   * **User support email**: Your email address
   * **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes**:
   * Search for `gmail.readonly` (or filter by Gmail API).
   * Select `https://www.googleapis.com/auth/gmail.readonly`.
   * Click **Update** and then **Save and Continue**.
6. Under **Test users** (Required while the app is in *Testing* status):
   * Click **+ Add Users**.
   * Enter the Google email addresses of the faculty accounts you plan to test with.
   * Click **Add** and then **Save and Continue**.

#### Step 1.4: Create OAuth 2.0 Client Credentials
1. On the left sidebar, click **Credentials**.
2. Click **+ CREATE CREDENTIALS** at the top and select **OAuth client ID**.
3. For **Application type**, choose **Web application**.
4. Set **Name**: `ChristSmart Web Client`.
5. Under **Authorized JavaScript origins**, click **+ ADD URI** and add:
   * `http://localhost:5173`
   * `http://127.0.0.1:5173`
6. Under **Authorized redirect URIs**, click **+ ADD URI** and add:
   * `http://localhost:5000/api/teachers/email/callback`
7. Click **Create**.
8. A modal will appear showing your **Client ID** and **Client Secret**.
9. Copy both values into your `backend/.env` file:
   ```env
   GOOGLE_CLIENT_ID="your_client_id_here.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your_client_secret_here"
   ```

---

### 2. 🔐 Token Encryption Key (`TOKEN_ENCRYPTION_KEY`)

The system uses **AES-256-GCM** authenticated encryption to encrypt OAuth refresh tokens at rest in PostgreSQL. This key must be exactly **32 bytes (64 hexadecimal characters)** or a 32-character secure string.

#### How to Generate:
Open your terminal and run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
*Output Example:*
`6905d59b120aa298f5b7d81ae95a7146d8abdaa561e708dfc49dc777c44d753e`

Paste the generated string into `backend/.env`:
```env
TOKEN_ENCRYPTION_KEY="6905d59b120aa298f5b7d81ae95a7146d8abdaa561e708dfc49dc777c44d753e"
```

---

### 3. 🛡️ JWT Secret Key (`JWT_SECRET`)

Used by the backend to sign and verify session authentication tokens stored in HttpOnly cookies.

#### How to Generate:
Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
*Output Example:*
`k9X2bYq8vM7wL1zP4tR6sT3uV0wX2yZ5aB8cD1eF4g=`

Paste the value into `backend/.env`:
```env
JWT_SECRET="k9X2bYq8vM7wL1zP4tR6sT3uV0wX2yZ5aB8cD1eF4g="
```

---

### 4. 🗄️ Database Connection (`DATABASE_URL`)

The PostgreSQL connection string URL. The server automatically checks and creates the target database (`cabin_finder`) and required tables on startup.

#### Format:
```env
DATABASE_URL="postgresql://<USERNAME>:<PASSWORD>@localhost:<PORT>/cabin_finder?schema=public"
```

#### Typical Local Setup:
* Default PostgreSQL user: `postgres`
* Default Port: `5432`
* Password: Your local PostgreSQL master password (e.g. `root` or `admin`)
```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/cabin_finder?schema=public"
```

---

### 5. 🏫 Faculty Passcode & Domain (`REGISTRATION_SECRET` & `ALLOWED_EMAIL_DOMAIN`)

These variables ensure security and prevent unauthorized student or public accounts from creating teacher profiles.

1. **`REGISTRATION_SECRET`**:
   * A shared secret passcode that faculty members must enter during registration.
   * Example: `CHRIST_FACULTY_2026`
2. **`ALLOWED_EMAIL_DOMAIN`**:
   * Restricts registration only to institutional email addresses.
   * Example: `@christuniversity.in`

```env
REGISTRATION_SECRET="CHRIST_FACULTY_2026"
ALLOWED_EMAIL_DOMAIN="@christuniversity.in"
```

---

## 🚀 Complete `.env` Template

Create a `.env` file in the `backend/` directory with the following structure:

```env
# -------------------------------------------------------------
# Database Configuration
# -------------------------------------------------------------
DATABASE_URL="postgresql://postgres:root@localhost:5432/cabin_finder?schema=public"

# -------------------------------------------------------------
# Authentication & Security
# -------------------------------------------------------------
JWT_SECRET="super-secret-jwt-key-change-this-in-production"
PORT=5000
REGISTRATION_SECRET="CHRIST_FACULTY_2026"
ALLOWED_EMAIL_DOMAIN="@christuniversity.in"

# -------------------------------------------------------------
# Email Notice & Google OAuth 2.0 Integration
# -------------------------------------------------------------
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
TOKEN_ENCRYPTION_KEY="your_64_character_hex_or_32_character_encryption_key"
```
