# Resume Builder

A live, ATS-friendly resume builder. Fill in your details, preview the PDF in
real time, keep a separate resume per company, and export a clean one-page PDF.
Optional Firebase cloud sync lets you open your resumes on any device.

> Extracted as a standalone product from
> [My-Portfolio](https://github.com/Emmanuel-Benjamin00/My-Portfolio). Both apps
> can point at the **same Firebase project**, so your resumes stay in sync
> between them.

## Features

- **Multiple resumes** — one per company/role, with a sidebar switcher.
- **Copy from another resume** — start a new one from an existing draft (name and
  Ongoing/Ready status stay independent).
- **Ready / Ongoing status** — mark a resume as perfected for its company.
- **Live PDF preview** and one-click PDF download (`@react-pdf/renderer`).
- **Custom sections**, drag-to-reorder, show/hide sections, layout & spacing
  presets to fit one page.
- **Cloud sync (optional)** — Google sign-in + Firestore; falls back to
  `localStorage` when Firebase isn't configured.
- **Admin view** — the owner account can see everyone's saved resumes.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Firebase values (optional)
npm run dev
```

Open the printed local URL. Without Firebase configured, everything works and
saves to this device only.

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the Vite dev server            |
| `npm run build`   | Production build to `dist/`          |
| `npm run preview` | Preview the production build locally |
| `npm run lint`    | Lint with ESLint                     |

## Cloud sync setup (optional)

1. Create a free project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication → Google** sign-in.
3. Create a **Firestore** database.
4. Copy your web app config into `.env` (see `.env.example`). Use the **same**
   values as the portfolio app to share data.
5. Set the owner email in [`src/common/firebase.js`](src/common/firebase.js)
   (`OWNER_EMAIL`) — this is the only account that can see the admin list and
   upload the public resume file.

### Firestore security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Each signed-in user owns their resume document.
    // The owner account may additionally read everyone's (admin view).
    match /resumes/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read: if request.auth != null
        && request.auth.token.email == "<your-owner-email>";
    }

    // Public resume file: anyone can read; only the owner can write.
    match /public/{docId} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email == "<your-owner-email>";
    }
  }
}
```

## Deploy

Any static host works (the included `netlify.toml` is preconfigured):

- **Netlify / Vercel** — build command `npm run build`, publish directory `dist`.
- Add your `VITE_FIREBASE_*` values as environment variables in the host's
  dashboard.
- If using Firebase Auth, add your deployed domain under
  **Firebase → Authentication → Settings → Authorized domains**.

## Tech

React 18 · Vite · @react-pdf/renderer · Firebase (Auth + Firestore) ·
react-toastify

## Project layout

```
src/
├── App.jsx                     # standalone shell + theme toggle
├── main.jsx                    # entry
├── styles/theme.css            # design tokens (dark/light)
├── common/firebase.js          # auth + Firestore (safe when unconfigured)
├── pages/
│   ├── ResumeBuilder.jsx       # the builder
│   └── ResumeBuilder.css
└── components/resume/          # PDF, form controls, custom sections, admin
```
# ResumeBuilder
