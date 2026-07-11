# BMB VCF — Command Center

A Next.js + TypeScript rewrite of the BMB VCF contact registration tool, with a
password-gated admin dashboard styled after a dark-purple "Command Center" UI.

## What changed from the old version

- Rebuilt from static HTML/JS into a Next.js app, fully in TypeScript
  (`.ts` / `.tsx` files under `src/`).
- Added an admin login flow: the profile icon in the top-right opens `/admin`,
  where an admin password (stored in the `ADMIN_PASSWORD` environment
  variable) unlocks a dashboard with:
  - Download all contacts as a `.vcf` file
  - Download all contacts as a `.pdf` file
  - View / search the full list of registered people
- The admin password is checked server-side in `/api/admin/login`. On success
  the server issues a signed, time-limited session token; the browser sends
  that token as a Bearer header on subsequent admin requests, and every admin
  API route re-verifies it server-side. The password itself never reaches the
  browser.

## Project structure

```
src/
  pages/
    index.tsx            Registration page (public)
    admin.tsx             Admin login + Command Center dashboard
    _app.tsx               App shell (fonts, global CSS)
    api/
      count.ts               Public: live contact count
      upload.ts               Public: register a new contact
      admin/
        login.ts               Verify admin password, issue session token
        list.ts                 Admin: list all contacts
        search.ts               Admin: search contacts
        update.ts               Admin: edit a contact
        download-vcf.ts         Admin: export contacts.vcf
        download-pdf.ts         Admin: export contacts.pdf
  components/
    TopBar.tsx              Shared header w/ profile/admin button
  lib/
    supabaseServer.ts       Server-side Supabase client (service role key)
    adminAuth.ts             Token creation/verification (server-side)
    adminClient.ts           Token storage + authenticated fetch (client-side)
    countries.ts             Country list with dial codes
  types/
    index.ts                 Shared TypeScript types
  styles/
    globals.css               Purple "Command Center" theme
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PASSWORD=...
SESSION_SECRET=...
```

`ADMIN_PASSWORD` is the password you'll type into the profile/admin login on
the site. `SESSION_SECRET` can be any random string — it's mixed into the
signature so session tokens can't be forged even if someone guesses the admin
password format.

## Running locally

```bash
npm install
npm run dev
```

## Deploying

This is a standard Next.js app — deploy it to Vercel (or any Next.js-capable
host) and set the four environment variables above in the project settings.
