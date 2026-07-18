import { useState, useEffect, Fragment } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import ResumePDF from "./ResumePDF";
import { listResumes } from "../../common/firebase";

/* Admin-only view: lists everyone who has signed in and saved a resume, with
 * a per-row toggle to preview that user's resume. Rendered only for the admin
 * account — the caller (ResumeBuilder) gates it behind isAdmin(user). */
export default function AdminPanel() {
  const [rows, setRows] = useState(null); // null = still loading
  const [error, setError] = useState(false);
  const [openUid, setOpenUid] = useState(null);

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

  return (
    <div className="rb-card rb-admin">
      <h2 className="rb-admin-title">
        Admin · {rows.length} user{rows.length === 1 ? "" : "s"}
      </h2>
      {rows.length === 0 ? (
        <p className="rb-admin-empty">No one has saved a resume yet.</p>
      ) : (
        <div className="rb-admin-scroll">
          <table className="rb-admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Last updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <Fragment key={u.uid}>
                  <tr>
                    <td>{u.displayName || "—"}</td>
                    <td>{u.email || "—"}</td>
                    <td>{fmtDate(u.updatedAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="rb-link-btn"
                        onClick={() =>
                          setOpenUid(openUid === u.uid ? null : u.uid)
                        }
                        disabled={!u.data}
                      >
                        {openUid === u.uid ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {openUid === u.uid && u.data && (
                    <tr>
                      <td colSpan={4}>
                        <PDFViewer className="rb-admin-viewer" showToolbar>
                          <ResumePDF data={u.data} />
                        </PDFViewer>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
