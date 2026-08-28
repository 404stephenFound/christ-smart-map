# Google Gmail OAuth Integration Setup Guide

This guide documents the complete setup process for connecting a local
backend application to Gmail using Google OAuth 2.0.

It is written to cover the common issues and screens encountered during
setup, including the newer **Google Auth Platform** interface.

------------------------------------------------------------------------

## 1. What This Setup Provides

The application can use Google's OAuth flow to obtain permission to
access a Gmail account.

For a backend that only needs to read incoming emails, the typical Gmail
scope is:

``` text
https://www.googleapis.com/auth/gmail.readonly
```

The local OAuth callback used by this project is:

``` text
http://localhost:5000/api/teachers/email/callback
```

The setup requires three environment variables:

``` env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
TOKEN_ENCRYPTION_KEY=...
```

------------------------------------------------------------------------

# 2. Prerequisites

Before starting, make sure you have:

-   A Google account
-   Access to Google Cloud Console
-   A local backend running on port `5000`
-   The Gmail integration code already present in the project
-   A `.env` file for backend environment variables

Open Google Cloud Console:

https://console.cloud.google.com/

------------------------------------------------------------------------

# 3. Create a Google Cloud Project

## Step 1: Open Google Cloud Console

Go to:

https://console.cloud.google.com/

Sign in with the Google account that will be used for the Gmail
integration.

------------------------------------------------------------------------

## Step 2: Create a project

From the project selector, choose:

**New Project**

Example project name:

``` text
Campus AI Gmail Integration
```

For the parent resource, if you do not belong to a Google Workspace
organization, leave it as:

``` text
No organization
```

Click:

**Create**

------------------------------------------------------------------------

## Possible Issue: Project Quota Warning

You may see a message such as:

> You have 10 projects remaining in your quota. Request an increase or
> delete projects.

This is not an error.

It means the Google Cloud account has a limit on the number of projects
it can create and currently has that many project slots remaining.

If the project can be created, simply continue.

If Google prevents project creation because the quota is exhausted,
either:

-   Delete an unused Google Cloud project, or
-   Request a quota increase.

Do not create multiple unnecessary projects just to troubleshoot this.

------------------------------------------------------------------------

# 4. Select the Correct Project

After creating the project, make sure the project shown in the Google
Cloud project selector is:

``` text
Campus AI Gmail Integration
```

All API and OAuth configuration must be performed inside this project.

A common mistake is creating the project successfully but continuing to
configure APIs in a different Google Cloud project.

------------------------------------------------------------------------

# 5. Enable the Gmail API

Go to:

**APIs & Services → Library**

Search for:

``` text
Gmail API
```

Open **Gmail API**.

Click:

**Enable**

Wait for the API to finish enabling.

------------------------------------------------------------------------

## Verify Gmail API

Go to:

**APIs & Services → Enabled APIs & services**

You should eventually see:

``` text
Gmail API
```

If it is not listed, make sure you are working in the correct project.

------------------------------------------------------------------------

# 6. Configure Google OAuth

Google's current interface may show:

**Google Auth Platform**

instead of the older:

**OAuth consent screen**

This is normal.

The newer interface separates OAuth configuration into sections such as:

-   Overview
-   Branding
-   Audience
-   Clients
-   Data Access
-   Verification Center
-   Settings

------------------------------------------------------------------------

# 7. Configure Branding

Open:

**Google Auth Platform → Branding**

You may see a page titled:

**Create branding**

The setup is usually divided into:

1.  App Information
2.  Audience
3.  Contact Information
4.  Finish

------------------------------------------------------------------------

## 7.1 App Information

### App name

Use a meaningful name, for example:

``` text
Campus AI Gmail Integration
```

This is the name users will see when Google asks them to authorize the
application.

### User support email

Select the Google account email that users can use to contact the
application owner/support person.

Click:

**Next**

------------------------------------------------------------------------

# 8. Configure Audience

For a development/testing application where the Gmail account may not
belong to a Google Workspace organization, select:

``` text
External
```

### External vs Internal

**External** means the OAuth application can be used by Google accounts
outside a specific Google Workspace organization, subject to Google's
testing and verification rules.

**Internal** is intended for applications restricted to users inside a
Google Workspace organization.

For a normal student/local development project using a personal Gmail
account, **External** is generally the appropriate choice.

Click:

**Next**

------------------------------------------------------------------------

# 9. Configure Contact Information

Enter the developer/contact email address.

This allows Google to contact the application owner regarding the OAuth
configuration.

Click:

**Next**

Then complete the setup.

------------------------------------------------------------------------

# 10. Configure OAuth Scopes / Data Access

Go to:

**Google Auth Platform → Data Access**

The exact screen can vary depending on the current Google Cloud UI.

If the application only needs to read Gmail messages, request the
minimum Gmail permission required by the application.

Typical scope:

``` text
https://www.googleapis.com/auth/gmail.readonly
```

### Why use `gmail.readonly`?

The scope allows the application to read Gmail data without giving it
permission to modify or send messages.

Do not request broader Gmail scopes unless the application actually
needs them.

For example, an application that only scans incoming messages should not
request permission to send, delete, or modify emails unnecessarily.

------------------------------------------------------------------------

# 11. Create the OAuth Client

Go to:

**Google Auth Platform → Clients**

You may also see a **Create OAuth client** button on the Overview page.

Click:

**Create OAuth client**

------------------------------------------------------------------------

## Application Type

Choose:

``` text
Web application
```

Example name:

``` text
Campus AI Gmail Backend
```

The name is primarily for identifying the credential inside Google
Cloud.

------------------------------------------------------------------------

# 12. Configure the Redirect URI

Under:

**Authorized redirect URIs**

Click:

**Add URI**

Enter the following exactly:

``` text
http://localhost:5000/api/teachers/email/callback
```

Important:

-   Use `http`, not `https`, for this localhost development callback.
-   Use port `5000` if your backend runs on port 5000.
-   The path must exactly match the callback implemented by the backend.
-   Do not add an extra trailing `/`.
-   Do not use a frontend URL unless the backend OAuth implementation
    specifically requires it.

The expected URI is:

``` text
http://localhost:5000/api/teachers/email/callback
```

Then click:

**Create**

------------------------------------------------------------------------

# 13. Get the Client ID and Client Secret

After creating the OAuth client, Google provides:

``` text
Client ID
Client Secret
```

These correspond to:

``` env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

## Security warning

Never commit the Client Secret to GitHub.

Never put the Client Secret directly into frontend React/JavaScript
code.

Never post the Client Secret in screenshots, chat messages, GitHub
issues, or public documentation.

It belongs in the backend environment configuration.

------------------------------------------------------------------------

# 14. Generate TOKEN_ENCRYPTION_KEY

The project also uses:

``` env
TOKEN_ENCRYPTION_KEY=...
```

This key is used by the backend to encrypt/decrypt Google refresh tokens
before they are stored in the database.

Do not reuse the example key from documentation in a real deployment.

Generate a random 32-byte key.

For example, with Python:

``` bash
python -c "import secrets; print(secrets.token_hex(32))"
```

This generates a 64-character hexadecimal representation of 32 random
bytes.

If the existing application specifically requires a 32-character string
rather than a 32-byte value, follow the application's implementation
requirement instead.

The important rule is:

> Match the key format expected by the project's encryption code.

Do not change the key format blindly.

------------------------------------------------------------------------

# 15. Configure the Backend `.env`

Your backend `.env` should contain values similar to:

``` env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
TOKEN_ENCRYPTION_KEY=your_secure_encryption_key
```

Use the actual values generated by Google for the first two variables.

Use a securely generated key for the third.

------------------------------------------------------------------------

# 16. Protect the `.env` File

Make sure `.env` is included in `.gitignore`.

Example:

``` gitignore
.env
.env.*
!.env.example
```

If the repository contains an example environment file, it can contain
placeholders:

``` env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TOKEN_ENCRYPTION_KEY=
```

Do not put real credentials in `.env.example`.

------------------------------------------------------------------------

# 17. OAuth Flow

The expected development flow is:

``` text
User
  |
  | Click Connect Gmail
  v
Backend
  |
  | Redirect to Google OAuth
  v
Google
  |
  | User signs in and grants permission
  v
Google redirects to:
http://localhost:5000/api/teachers/email/callback
  |
  v
Backend
  |
  | Exchanges authorization code for tokens
  | Encrypts/stores refresh token
  v
Database
```

The refresh token allows the backend to continue accessing Gmail without
requiring the user to authorize the application every time, subject to
Google's OAuth rules.

------------------------------------------------------------------------

# 18. Common Problems and Fixes

## Problem 1: "You have X projects remaining in your quota"

### Meaning

This is a Google Cloud project quota warning.

### Fix

If project creation still works, continue.

If project creation is blocked:

-   Delete unused projects, or
-   Request a project quota increase.

------------------------------------------------------------------------

## Problem 2: Gmail API is not appearing

### Cause

The API may not have been enabled in the currently selected project.

### Fix

Go to:

**APIs & Services → Library → Gmail API → Enable**

Then verify under:

**APIs & Services → Enabled APIs & services**

------------------------------------------------------------------------

## Problem 3: "You haven't configured any OAuth clients for this project yet"

### Meaning

This is not an error.

It simply means the project has OAuth branding/configuration but no
OAuth client credential yet.

### Fix

Go to:

**Google Auth Platform → Clients**

or click:

**Create OAuth client**

Create a **Web application** OAuth client.

------------------------------------------------------------------------

## Problem 4: Redirect URI mismatch

A common error is:

``` text
Error 400: redirect_uri_mismatch
```

### Cause

The redirect URI used by the backend does not exactly match one
registered in Google Cloud.

### Fix

Make sure Google Cloud contains:

``` text
http://localhost:5000/api/teachers/email/callback
```

And make sure the backend uses exactly the same URI.

These are different:

``` text
http://localhost:5000/api/teachers/email/callback
```

``` text
http://localhost:5000/api/teachers/email/callback/
```

``` text
http://localhost:5000/api/teachers/callback
```

``` text
https://localhost:5000/api/teachers/email/callback
```

Even small differences can cause the OAuth flow to fail.

------------------------------------------------------------------------

# 19. OAuth Testing Restrictions

If the application is configured as **External** and remains in testing
mode, Google may restrict who can authorize the application.

If Google provides a **Test users** section under the Audience
configuration, add the Gmail account(s) that need to test the
application.

Use the exact Google account email that will authorize Gmail access.

If a user who is not allowed to test the application tries to authorize
it, Google may show an access/restriction error.

------------------------------------------------------------------------

# 20. Sensitive / Restricted Gmail Scopes

Gmail scopes can be subject to Google's OAuth verification requirements.

For a local hackathon/development project, testing may be possible
without going through the full public verification process, depending on
the scopes and account configuration.

However, do not assume that an application can be publicly distributed
with sensitive Gmail permissions without additional Google requirements.

If the application is later deployed publicly, review Google's current
OAuth verification requirements before production release.

------------------------------------------------------------------------

# 21. Backend Port Must Match the Redirect URI

If the backend runs on:

``` text
http://localhost:5000
```

then the redirect URI should use:

``` text
http://localhost:5000/api/teachers/email/callback
```

If the backend is changed to another port, such as:

``` text
http://localhost:8000
```

the OAuth redirect configuration must also be updated:

``` text
http://localhost:8000/api/teachers/email/callback
```

The backend and Google Cloud configuration must agree.

------------------------------------------------------------------------

# 22. If the Backend Is Not Running

The OAuth authorization page may work, but after Google finishes
authentication the browser must return to the backend callback.

If nothing is listening on:

``` text
localhost:5000
```

the callback will fail.

Start the backend before testing the complete OAuth flow.

------------------------------------------------------------------------

# 23. Recommended Environment Configuration

Example:

``` env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Token encryption
TOKEN_ENCRYPTION_KEY=your_secure_key
```

Never use these literal values in production:

``` env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
TOKEN_ENCRYPTION_KEY=your_secure_key
```

They are placeholders only.

------------------------------------------------------------------------

# 24. Final Configuration Checklist

Before testing Gmail integration, verify all of the following:

-   [ ] Google Cloud project created
-   [ ] Correct Google Cloud project selected
-   [ ] Gmail API enabled
-   [ ] Google Auth Platform branding configured
-   [ ] App name configured
-   [ ] User support email configured
-   [ ] Audience configured
-   [ ] Developer/contact email configured
-   [ ] Gmail scope configured if required by the backend
-   [ ] OAuth client created
-   [ ] Application type set to Web application
-   [ ] Redirect URI added
-   [ ] Redirect URI exactly matches backend
-   [ ] `GOOGLE_CLIENT_ID` added to backend `.env`
-   [ ] `GOOGLE_CLIENT_SECRET` added to backend `.env`
-   [ ] `TOKEN_ENCRYPTION_KEY` added to backend `.env`
-   [ ] `.env` excluded from Git
-   [ ] Backend running on the expected port
-   [ ] Test Gmail account added as a test user if Google requires it
-   [ ] OAuth flow tested from the application

------------------------------------------------------------------------

# 25. Quick Reference

## Google Cloud Project

``` text
Campus AI Gmail Integration
```

## Gmail API

``` text
Gmail API
```

## OAuth Application Type

``` text
Web application
```

## Redirect URI

``` text
http://localhost:5000/api/teachers/email/callback
```

## Read-only Gmail Scope

``` text
https://www.googleapis.com/auth/gmail.readonly
```

## Environment Variables

``` env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
TOKEN_ENCRYPTION_KEY=...
```

------------------------------------------------------------------------

# 26. Troubleshooting Order

If Gmail OAuth does not work, check the following in this order:

1.  Is the correct Google Cloud project selected?
2.  Is Gmail API enabled?
3.  Is OAuth branding configured?
4.  Is the OAuth audience configured correctly?
5.  Is the Gmail account allowed to test the application?
6.  Does an OAuth Web application client exist?
7.  Does the redirect URI exactly match?
8.  Is the backend running?
9.  Is the backend running on port `5000`?
10. Are the environment variables loaded?
11. Is `TOKEN_ENCRYPTION_KEY` in the format expected by the backend?
12. Check the backend logs for the exact OAuth error.

Do not randomly change multiple settings at once. Change one
configuration item, retry, and inspect the resulting error.

------------------------------------------------------------------------

# 27. Production Notes

The localhost setup is intended for development/testing.

For production:

-   Use HTTPS.
-   Register the production redirect URI.
-   Store secrets in a proper secret manager/environment configuration.
-   Do not expose OAuth secrets to the frontend.
-   Use the minimum Gmail scopes required.
-   Review Google's OAuth verification requirements.
-   Protect stored refresh tokens with strong encryption.
-   Rotate compromised credentials immediately.
-   Never commit `.env` files containing real credentials.

------------------------------------------------------------------------

# 28. Summary

The minimum Google-side setup is:

``` text
Google Cloud Project
        ↓
Enable Gmail API
        ↓
Configure Google Auth Platform Branding
        ↓
Configure Audience
        ↓
Configure required Gmail Data Access
        ↓
Create OAuth Client
        ↓
Choose Web Application
        ↓
Add redirect URI
        ↓
Copy Client ID + Client Secret
        ↓
Add credentials to backend .env
        ↓
Generate/configure TOKEN_ENCRYPTION_KEY
        ↓
Start backend
        ↓
Test Gmail OAuth flow
```

The most common configuration mistake is the **redirect URI mismatch**.
Make sure the URI registered in Google Cloud and the URI used by the
backend are character-for-character identical.
