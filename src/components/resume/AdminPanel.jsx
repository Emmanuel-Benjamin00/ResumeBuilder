import { useState, useEffect } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import ResumePDF from "./ResumePDF";
import { listResumes } from "../../common/firebase";

/* Admin-only view: lists everyone who has signed in and saved, and — because
 * each person keeps MANY resumes (one per company) — expands every user into
 * all of their resumes, each previewable on its own. Rendered only for the
 * admin account; the caller (ResumeBuilder) gates it behind isAdmin(user). */
export default function AdminPanel() {
  const [rows, setRows] = useState(null); // null = still loading
  const [error, setError] = useState(false);
  const [openKey, setOpenKey] = useState(null); // `${uid}:${index}` being previewed

  useEffect(() => {
    let alive = true;
    listResumes()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="rb-card rb-admin">
        Couldn&apos;t load users — make sure the admin read rule is set in
        Firestore.
      </div>
    );
  }
  if (rows === null) {
    return <div className="rb-card rb-admin">Loading users…</div>;
  }

  const totalResumes = rows.reduce((n, u) => n + resumesOf(u).length, 0);

  return (
    <div className="rb-card rb-admin">
      <h2 className="rb-admin-title">
        Admin · {rows.length} user{rows.length === 1 ? "" : "s"} ·{" "}
        {totalResumes} resume{totalResumes === 1 ? "" : "s"}
      </h2>

      {rows.length === 0 ? (
        <p className="rb-admin-empty">No one has saved a resume yet.</p>
      ) : (
        <div className="ad-users">
          {rows.map((u) => {
            const resumes = resumesOf(u);
            const name = u.displayName || u.email || "Unknown user";
            return (
              <div className="ad-user" key={u.uid}>
                <div className="ad-user-head">
                  <span className="ad-avatar" style={avatarStyle(u.email || name)}>
                    {initials(name)}
                  </span>
                  <div className="ad-user-id">
                    <strong>{u.displayName || "—"}</strong>
                    <span>{u.email || "—"}</span>
                  </div>
                  <span className="ad-user-meta">
                    {resumes.length} resume{resumes.length === 1 ? "" : "s"} ·
                    updated {fmtDate(u.updatedAt)}
                  </span>
                </div>

                {resumes.length === 0 ? (
                  <p className="ad-none">No resume data stored for this user.</p>
                ) : (
                  <div className="ad-resumes">
                    {resumes.map((r, i) => {
                      const key = `${u.uid}:${i}`;
                      const open = openKey === key;
                      const title =
                        (r.label && r.label.trim()) ||
                        (r.personal && r.personal.name) ||
                        "Untitled resume";
                      return (
                        <div className="ad-resume" key={key}>
                          <button
                            type="button"
                            className={`ad-resume-row ${open ? "ad-resume-row-open" : ""}`}
                            onClick={() => setOpenKey(open ? null : key)}
                          >
                            <span className="ad-resume-title">
                              {r.ready && <span className="ad-star">★</span>}
                              {title}
                            </span>
                            <span
                              className={`ad-status ${r.ready ? "ad-status-ready" : ""}`}
                            >
                              {r.ready ? "Ready" : "Ongoing"}
                            </span>
                            <span className="ad-view">{open ? "Hide" : "View"}</span>
                          </button>
                          {open && (
                            <PDFViewer className="rb-admin-viewer" showToolbar>
                              <ResumePDF data={r} />
                            </PDFViewer>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* A user's saved document is the whole multi-resume store {resumes, activeId}.
   Older accounts saved a single resume object — normalise both to an array. */
function resumesOf(u) {
  const d = u.data;
  if (!d) return [];
  if (Array.isArray(d.resumes)) return d.resumes;
  return [d]; // legacy single-resume document
}

function initials(str) {
  const s = (str || "").trim();
  if (!s) return "?";
  const p = s.split(/\s+/);
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function avatarStyle(seed) {
  let h = 0;
  const s = seed || "?";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return { background: `hsl(${h % 360} 62% 45%)` };
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
