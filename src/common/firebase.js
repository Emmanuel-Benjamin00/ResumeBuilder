// ─────────────────────────────────────────────────────────────────────
// Firebase (Auth + Firestore) — free-forever cloud storage for resumes.
//
// This module is SAFE to import even when Firebase isn't configured:
// if the env vars are missing it simply reports `isConfigured = false`
// and the Resume Builder falls back to localStorage-only.
//
// To enable cloud sync, create a free Firebase project and add these to a
// `.env` file at the project root (see README / setup notes):
//   VITE_FIREBASE_API_KEY=...
//   VITE_FIREBASE_AUTH_DOMAIN=...
//   VITE_FIREBASE_PROJECT_ID=...
//   VITE_FIREBASE_STORAGE_BUCKET=...
//   VITE_FIREBASE_MESSAGING_SENDER_ID=...
//   VITE_FIREBASE_APP_ID=...
// ─────────────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

// Only this account may upload / replace the public resume file AND view the
// admin list of everyone's resumes. No other account is ever an admin.
export const OWNER_EMAIL = "emmanuel26112000@gmail.com";

// True only for the single admin account above.
export const isAdmin = (user) => Boolean(user && user.email === OWNER_EMAIL);

let auth = null;
let db = null;
let provider = null;

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
} else {
  console.info(
    "[firebase] Not configured — Resume Builder will use local storage only. " +
      "Add VITE_FIREBASE_* env vars to enable cross-device cloud sync."
  );
}

/* ── Auth helpers ── */
export function onAuthStateChanged(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return fbOnAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  if (!auth || !provider) throw new Error("Firebase is not configured.");
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOut() {
  if (auth) await fbSignOut(auth);
}

/* ── Firestore: one resume document per user (collection "resumes") ── */
export async function loadResume(uid) {
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, "resumes", uid));
  return snap.exists() ? snap.data().data : null;
}

export async function saveResume(user, data) {
  if (!db || !user?.uid) return;
  // Store the signed-in identity alongside the resume so the admin view can
  // show WHO each resume belongs to (not just what's typed inside it).
  await setDoc(doc(db, "resumes", user.uid), {
    data,
    email: user.email || "",
    displayName: user.displayName || "",
    updatedAt: new Date().toISOString(),
  });
}

// Admin-only: read every user's resume. Requires the Firestore rule that
// grants read access to the OWNER_EMAIL account (see the module header notes).
// Returns [{ uid, email, displayName, updatedAt, data }], newest first.
export async function listResumes() {
  if (!db) return [];
  const snap = await getDocs(collection(db, "resumes"));
  return snap.docs
    .map((d) => {
      const v = d.data() || {};
      return {
        uid: d.id,
        email: v.email || v.data?.personal?.email || "",
        displayName: v.displayName || v.data?.personal?.name || "",
        updatedAt: v.updatedAt || "",
        data: v.data || null,
      };
    })
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

/* ── Public resume file (owner uploads, everyone can view) ──
 *
 * No paid Storage bucket needed: the PDF itself is stored (base64-encoded)
 * inside a single public Firestore document. Each upload OVERWRITES that
 * one doc, so the previous file is discarded and the latest always wins.
 * The frontend rebuilds the PDF from the stored data and opens it.
 *
 * Firestore caps a document at ~1 MB, so the PDF must stay under that.
 *
 * Requires this Firestore rule (set once in the console):
 *   match /public/{docId} {
 *     allow read: if true;
 *     allow write: if request.auth != null
 *       && request.auth.token.email == "emmanuel26112000@gmail.com";
 *   }
 */
const RESUME_DOC = ["public", "resume"];
// Keep the base64 payload safely under Firestore's ~1 MB document limit.
export const RESUME_MAX_BYTES = 700 * 1024;

function fileToDataUrl(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.onprogress = (e) => {
      // Reading/encoding is ~90% of the work; the Firestore write finishes it.
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 90));
      }
    };
    reader.readAsDataURL(file);
  });
}

// Upload (overwrite) the public resume PDF; returns its base64 data URL.
// `onProgress(pct)` is called with 0–100 as the upload advances.
export async function uploadResumeFile(file, onProgress) {
  if (!db) throw new Error("Firebase is not configured.");
  if (file.size > RESUME_MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  onProgress?.(0);
  const dataUrl = await fileToDataUrl(file, onProgress);
  onProgress?.(95); // encoded — now committing to Firestore
  await setDoc(doc(db, ...RESUME_DOC), {
    dataUrl,
    fileName: file.name,
    updatedAt: new Date().toISOString(),
  });
  onProgress?.(100);
  return dataUrl;
}

// Read the latest public resume, or null if none uploaded yet.
// Returns { dataUrl, fileName } so the frontend can rebuild the PDF.
export async function loadResumeData() {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, ...RESUME_DOC));
    if (!snap.exists()) return null;
    const { dataUrl, fileName } = snap.data();
    return dataUrl ? { dataUrl, fileName } : null;
  } catch {
    return null;
  }
}
