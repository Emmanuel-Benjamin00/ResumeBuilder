import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";

/* ─────────────────────────────────────────────────────────────────────
   YouTube-style chrome for the Resume Builder.

   Everything here is presentational — it renders the familiar YouTube
   surfaces (top bar, nav drawer, home grid of "video" cards, watch-page
   header, up-next rail, upload dialog) and calls back into ResumeBuilder,
   which still owns all the resume data and actions.

   The mapping:
     • a resume            → a video
     • company / role      → the video title
     • your name           → the "channel"
     • Ready / Ongoing      → the duration badge on the thumbnail
     • Home grid            → browse all resumes
     • Watch page           → edit one resume (player = live PDF preview)
   ───────────────────────────────────────────────────────────────────── */

/* ── tiny helpers ── */
function initials(str) {
  const s = (str || "").trim();
  if (!s) return "R";
  const parts = s.split(/\s+/);
  const a = parts[0][0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase() || "R";
}

// Deterministic hue so each "channel" avatar keeps a stable colour.
function hueOf(str) {
  let h = 0;
  const s = str || "R";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
function avatarStyle(name) {
  const h = hueOf(name);
  return { background: `hsl(${h} 62% 45%)` };
}

// A views-style stat: how many sections carry real content.
function contentStat(r) {
  let n = 0;
  const p = r.personal || {};
  if (Object.values(p).some((v) => v && String(v).trim())) n++;
  if ((r.summaries || []).some((s) => s.text && s.text.trim())) n++;
  if ((r.skills || []).some((s) => (s.value || s.label || "").trim())) n++;
  if ((r.experience || []).some((e) => e.company || e.role || e.bullets)) n++;
  if ((r.projects || []).some((x) => x.name || x.bullets)) n++;
  if ((r.education || []).some((e) => e.school || e.degree)) n++;
  if ((r.certifications || []).some((c) => c.text && c.text.trim())) n++;
  n += (r.customSections || []).length;
  return n;
}

const titleOf = (r) => (r.label && r.label.trim()) || "Untitled resume";
const channelOf = (r) => (r.personal?.name || "").trim() || "Your Resume";

/* ── Icons (YouTube-flavoured line icons) ── */
const I = {
  menu: "M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z",
  search:
    "M20.87 20.17l-5.59-5.59A6.94 6.94 0 0016 10a7 7 0 10-7 7 6.94 6.94 0 004.58-1.71l5.59 5.58zM10 15a5 5 0 115-5 5 5 0 01-5 5z",
  home: "M4 10.5L12 4l8 6.5V20h-6v-6h-4v6H4z",
  flame:
    "M12 2c1 3-1 4-2 6s-1 4 2 4c2 0 3-2 2-4 3 1 4 4 3 7-1 2-4 3-7 3-4 0-7-3-7-7 0-5 4-6 6-9z",
  clock:
    "M12 3a9 9 0 100 18 9 9 0 000-18zm0 16a7 7 0 110-14 7 7 0 010 14zm.5-11H11v6l5 3 .8-1.3L12.5 12z",
  library:
    "M3 5h14v2H3zm0 4h14v2H3zm0 4h9v2H3zm13 .5l6 3.5-6 3.5z",
  doc: "M6 2h8l4 4v16H6zm7 1.5V7h3.5z",
  plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z",
  bell: "M12 22a2.2 2.2 0 002.2-2H9.8A2.2 2.2 0 0012 22zm7-6v-5a7 7 0 10-14 0v5l-2 2v1h18v-1z",
  admin:
    "M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6zm0 2.2L6 6.7v4.6c0 3.7 2.4 6.4 6 7.6 3.6-1.2 6-3.9 6-7.6V6.7z",
  settings:
    "M12 8a4 4 0 100 8 4 4 0 000-8zm8.9 4a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 2h-4l-.4 2.4a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 003.1 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2L10 22h4l.4-2.4c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
  download: "M12 3v10l4-4 1.4 1.4L12 16.8 6.6 10.4 8 9l4 4V3zM5 19h14v2H5z",
  trash: "M6 7h12l-1 14H7zm3-3h6l1 2H8zM4 6h16v2H4z",
  play: "M8 5v14l11-7z",
  close: "M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z",
  back: "M15.4 7.4L14 6l-6 6 6 6 1.4-1.4L10.8 12z",
};
function Icon({ d, size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="currentColor" d={d} />
    </svg>
  );
}
Icon.propTypes = { d: PropTypes.string.isRequired, size: PropTypes.number };

// Original brand mark — a red rounded badge holding a résumé "document"
// glyph (three lines on a page). Deliberately not YouTube's play badge.
function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--yt-red)" />
      <g fill="#fff">
        <rect x="7" y="6.4" width="10" height="1.9" rx="0.95" />
        <rect x="7" y="11.05" width="10" height="1.9" rx="0.95" />
        <rect x="7" y="15.7" width="6.5" height="1.9" rx="0.95" />
      </g>
    </svg>
  );
}

/* ── Top bar ─────────────────────────────────────────────────────────── */
export function TopBar({
  onMenu,
  onHome,
  query,
  setQuery,
  onSearchSubmit,
  onCreate,
  user,
  onSignIn,
  onSignOut,
  theme,
  onToggleTheme,
}) {
  return (
    <header className="yt-bar">
      <div className="yt-bar-left">
        <button
          type="button"
          className="yt-icon-btn yt-menu-btn"
          onClick={onMenu}
          aria-label="Menu"
          title="Menu"
        >
          <Icon d={I.menu} size={22} />
        </button>
        <button
          type="button"
          className="yt-brand"
          onClick={onHome}
          title="Resume Builder — Home"
        >
          <span className="yt-logo" aria-hidden="true">
            <BrandMark />
          </span>
          <span className="yt-brand-name">
            Resume<span className="yt-brand-sup">Builder</span>
          </span>
        </button>
      </div>

      <div className="yt-bar-search">
        <form
          className="yt-search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit?.();
          }}
        >
          <span className="yt-search-icon" aria-hidden="true">
            <Icon d={I.search} size={20} />
          </span>
          <input
            type="text"
            className="yt-search-input"
            placeholder="Search resumes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search resumes"
          />
          {query && (
            <button
              type="button"
              className="yt-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              title="Clear"
            >
              <Icon d={I.close} size={18} />
            </button>
          )}
          <button
            type="submit"
            className="yt-search-btn"
            aria-label="Search"
            title="Search"
          >
            <Icon d={I.search} size={20} />
          </button>
        </form>
      </div>

      <div className="yt-bar-right">
        <button
          type="button"
          className="yt-pill-btn"
          onClick={onCreate}
          title="Create a new resume"
        >
          <Icon d={I.plus} size={22} />
          <span className="yt-pill-btn-label">Create</span>
        </button>
        <button
          type="button"
          className="yt-icon-btn"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        <AccountButton user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
TopBar.propTypes = {
  onMenu: PropTypes.func,
  onHome: PropTypes.func,
  query: PropTypes.string,
  setQuery: PropTypes.func,
  onSearchSubmit: PropTypes.func,
  onCreate: PropTypes.func,
  user: PropTypes.object,
  onSignIn: PropTypes.func,
  onSignOut: PropTypes.func,
  theme: PropTypes.string,
  onToggleTheme: PropTypes.func,
};

function AccountButton({ user, onSignIn, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!user) {
    return (
      <button type="button" className="yt-signin" onClick={onSignIn}>
        <span className="yt-signin-ring" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path
              fill="currentColor"
              d="M12 12a5 5 0 10-5-5 5 5 0 005 5zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z"
            />
          </svg>
        </span>
        Sign in
      </button>
    );
  }
  return (
    <div className="yt-account" ref={ref}>
      <button
        type="button"
        className="yt-avatar yt-avatar-btn"
        style={avatarStyle(user.email || "U")}
        onClick={() => setOpen((o) => !o)}
        title={user.email}
      >
        {initials(user.displayName || user.email)}
      </button>
      {open && (
        <div className="yt-account-menu" role="menu">
          <div className="yt-account-head">
            <span
              className="yt-avatar"
              style={avatarStyle(user.email || "U")}
              aria-hidden="true"
            >
              {initials(user.displayName || user.email)}
            </span>
            <div className="yt-account-id">
              <strong>{user.displayName || "Signed in"}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            className="yt-account-item"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
AccountButton.propTypes = {
  user: PropTypes.object,
  onSignIn: PropTypes.func,
  onSignOut: PropTypes.func,
};

/* ── Left navigation drawer ──────────────────────────────────────────── */
export function SideNav({
  open,
  page,
  filter,
  resumes,
  activeId,
  isAdmin,
  onNavHome,
  onNavFilter,
  onOpenResume,
  onAdmin,
  onCreate,
}) {
  const homeActive = page === "home" && filter === "all";
  if (!open) {
    // Mini rail — icons only, like YouTube's collapsed sidebar.
    const rail = [
      { key: "home", d: I.home, label: "Home", on: page === "home", act: onNavHome },
      { key: "ready", d: I.flame, label: "Ready", on: false, act: () => onNavFilter("ready") },
      { key: "ongoing", d: I.clock, label: "Ongoing", on: false, act: () => onNavFilter("ongoing") },
      { key: "create", d: I.plus, label: "New", on: false, act: onCreate },
    ];
    if (isAdmin)
      rail.push({ key: "admin", d: I.admin, label: "Admin", on: page === "admin", act: onAdmin });
    return (
      <nav className="yt-nav yt-nav-mini" aria-label="Primary">
        {rail.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`yt-mini-item ${it.on ? "yt-mini-item-active" : ""}`}
            onClick={it.act}
            title={it.label}
          >
            <Icon d={it.d} size={22} />
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
    );
  }

  return (
    <nav className="yt-nav" aria-label="Primary">
      <div className="yt-nav-group">
        <NavRow icon={I.home} label="Home" active={homeActive} onClick={onNavHome} />
        <NavRow
          icon={I.flame}
          label="Ready"
          active={page === "home" && filter === "ready"}
          onClick={() => onNavFilter("ready")}
        />
        <NavRow
          icon={I.clock}
          label="Ongoing"
          active={page === "home" && filter === "ongoing"}
          onClick={() => onNavFilter("ongoing")}
        />
      </div>

      <div className="yt-nav-sep" />

      <div className="yt-nav-group">
        <p className="yt-nav-heading">Your resumes</p>
        {resumes.length === 0 && <p className="yt-nav-empty">No resumes yet</p>}
        {resumes.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`yt-nav-row ${r.id === activeId && page === "watch" ? "yt-nav-row-active" : ""}`}
            onClick={() => onOpenResume(r.id)}
            title={titleOf(r)}
          >
            <span className="yt-nav-ava" style={avatarStyle(channelOf(r))} aria-hidden="true">
              {initials(channelOf(r))}
            </span>
            <span className="yt-nav-row-label">{titleOf(r)}</span>
            {r.ready && <span className="yt-nav-live" title="Ready">READY</span>}
          </button>
        ))}
        <NavRow icon={I.plus} label="Create resume" onClick={onCreate} />
      </div>

      {isAdmin && (
        <>
          <div className="yt-nav-sep" />
          <div className="yt-nav-group">
            <p className="yt-nav-heading">Admin</p>
            <NavRow
              icon={I.admin}
              label="All users"
              active={page === "admin"}
              onClick={onAdmin}
            />
          </div>
        </>
      )}

      <div className="yt-nav-sep" />
      <p className="yt-nav-foot">
        Resume Builder · a YouTube-styled résumé studio. Build, preview and export
        clean, ATS-friendly PDFs.
      </p>
    </nav>
  );
}
SideNav.propTypes = {
  open: PropTypes.bool,
  page: PropTypes.string,
  filter: PropTypes.string,
  resumes: PropTypes.array,
  activeId: PropTypes.string,
  isAdmin: PropTypes.bool,
  onNavHome: PropTypes.func,
  onNavFilter: PropTypes.func,
  onOpenResume: PropTypes.func,
  onAdmin: PropTypes.func,
  onCreate: PropTypes.func,
};

function NavRow({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      className={`yt-nav-row ${active ? "yt-nav-row-active" : ""}`}
      onClick={onClick}
    >
      <span className="yt-nav-ico">
        <Icon d={icon} size={22} />
      </span>
      <span className="yt-nav-row-label">{label}</span>
    </button>
  );
}
NavRow.propTypes = {
  icon: PropTypes.string,
  label: PropTypes.string,
  active: PropTypes.bool,
  onClick: PropTypes.func,
};

/* ── Home: chips + grid of resume "video" cards ──────────────────────── */
const CHIPS = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "ongoing", label: "Ongoing" },
];

export function HomeGrid({ resumes, query, filter, setFilter, onOpen, onCreate, onRemove }) {
  const q = query.trim().toLowerCase();
  const visible = resumes.filter((r) => {
    if (q && !titleOf(r).toLowerCase().includes(q) && !channelOf(r).toLowerCase().includes(q))
      return false;
    if (filter === "ready" && !r.ready) return false;
    if (filter === "ongoing" && r.ready) return false;
    return true;
  });

  return (
    <div className="yt-home">
      <div className="yt-chips" role="tablist" aria-label="Filter resumes">
        {CHIPS.map((c) => {
          const count =
            c.key === "all"
              ? resumes.length
              : resumes.filter((r) => (c.key === "ready" ? r.ready : !r.ready)).length;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={filter === c.key}
              className={`yt-chip ${filter === c.key ? "yt-chip-active" : ""}`}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
              <span className="yt-chip-n">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="yt-empty">
          <div className="yt-empty-mark" aria-hidden="true">
            <BrandMark />
          </div>
          <h3>{q ? "No results found" : "No resumes here yet"}</h3>
          <p>
            {q
              ? `Nothing matches “${query.trim()}”. Try a different search.`
              : "Create your first resume to see it appear here as a card."}
          </p>
          <button type="button" className="yt-cta" onClick={onCreate}>
            <Icon d={I.plus} size={20} /> Create resume
          </button>
        </div>
      ) : (
        <div className="yt-grid">
          <button type="button" className="yt-card yt-card-new" onClick={onCreate}>
            <span className="yt-card-new-plus" aria-hidden="true">
              <Icon d={I.plus} size={34} />
            </span>
            <span className="yt-card-new-label">New resume</span>
            <span className="yt-card-new-sub">Start one for another company</span>
          </button>
          {visible.map((r) => (
            <ResumeCard key={r.id} resume={r} onOpen={onOpen} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
HomeGrid.propTypes = {
  resumes: PropTypes.array,
  query: PropTypes.string,
  filter: PropTypes.string,
  setFilter: PropTypes.func,
  onOpen: PropTypes.func,
  onCreate: PropTypes.func,
  onRemove: PropTypes.func,
};

function ResumeCard({ resume: r, onOpen, onRemove }) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setMenu(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  const stat = contentStat(r);
  const status = r.ready ? "Ready" : "Ongoing";

  return (
    <div className="yt-card">
      {/* Thumbnail = a faux résumé "preview" with a duration-style badge */}
      <button
        type="button"
        className="yt-thumb"
        onClick={() => onOpen(r.id)}
        title={`Open ${titleOf(r)}`}
      >
        <div className="yt-thumb-paper">
          <div className="yt-thumb-bar" style={avatarStyle(channelOf(r))} />
          <div className="yt-thumb-name">{channelOf(r)}</div>
          <div className="yt-thumb-role">{titleOf(r)}</div>
          <span className="yt-thumb-l" style={{ width: "92%" }} />
          <span className="yt-thumb-l" style={{ width: "78%" }} />
          <span className="yt-thumb-l" style={{ width: "85%" }} />
          <span className="yt-thumb-l" style={{ width: "60%" }} />
        </div>
        <span className={`yt-thumb-badge ${r.ready ? "yt-thumb-badge-ready" : ""}`}>
          {status}
        </span>
        <span className="yt-thumb-hover" aria-hidden="true">
          <Icon d={I.doc} size={26} /> Open editor
        </span>
      </button>

      {/* Meta row = avatar + title + channel + stats */}
      <div className="yt-card-meta">
        <span className="yt-card-ava" style={avatarStyle(channelOf(r))} aria-hidden="true">
          {initials(channelOf(r))}
        </span>
        <div className="yt-card-text">
          <div className="yt-card-title" title={titleOf(r)}>
            {r.ready && <span className="yt-card-star" aria-hidden="true">★</span>}
            {titleOf(r)}
          </div>
          <div className="yt-card-sub">{channelOf(r)}</div>
          <div className="yt-card-sub">
            {stat} section{stat === 1 ? "" : "s"} · {status}
          </div>
        </div>
        <div className="yt-card-menu-wrap" ref={ref}>
          <button
            type="button"
            className="yt-card-menu-btn"
            onClick={() => setMenu((m) => !m)}
            aria-label="More"
            title="More"
          >
            ⋮
          </button>
          {menu && !confirm && (
            <div className="yt-card-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenu(false); onOpen(r.id); }}>
                <Icon d={I.doc} size={18} /> Open &amp; edit
              </button>
              <button type="button" role="menuitem" className="yt-card-menu-del" onClick={() => setConfirm(true)}>
                <Icon d={I.trash} size={18} /> Delete resume
              </button>
            </div>
          )}
          {menu && confirm && (
            <div className="yt-card-menu yt-card-menu-confirm" role="menu">
              <p>Delete “{titleOf(r)}” permanently?</p>
              <div className="yt-card-menu-actions">
                <button type="button" className="yt-btn-ghost" onClick={() => { setConfirm(false); setMenu(false); }}>
                  Cancel
                </button>
                <button type="button" className="yt-btn-danger" onClick={() => { onRemove(r.id); setConfirm(false); setMenu(false); }}>
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
ResumeCard.propTypes = {
  resume: PropTypes.object.isRequired,
  onOpen: PropTypes.func,
  onRemove: PropTypes.func,
};

/* ── Watch page header (title + channel + actions) ───────────────────── */
export function WatchHeader({
  data,
  ready,
  onToggleReady,
  generating,
  onGenerate,
  onReset,
  onBack,
  syncNode,
}) {
  const channel = channelOf(data);
  return (
    <div className="yt-watch-head">
      <h1 className="yt-watch-title">
        {titleOf(data)}
        <button type="button" className="yt-back-link" onClick={onBack} title="Back to all resumes">
          <Icon d={I.back} size={18} /> All resumes
        </button>
      </h1>

      <div className="yt-watch-actions">
        <div className="yt-channel">
          <span className="yt-channel-ava" style={avatarStyle(channel)} aria-hidden="true">
            {initials(channel)}
          </span>
          <div className="yt-channel-id">
            <strong>{channel}</strong>
            <span>{contentStat(data)} sections in this resume</span>
          </div>
          <button
            type="button"
            className={`yt-ready-btn ${ready ? "yt-ready-on" : ""}`}
            onClick={onToggleReady}
            aria-pressed={ready}
          >
            {ready ? "✓ Ready" : "Mark ready"}
          </button>
        </div>

        <div className="yt-watch-pills">
          <button
            type="button"
            className="yt-action-pill yt-action-primary"
            onClick={onGenerate}
            disabled={generating}
          >
            <Icon d={I.download} size={20} />
            {generating ? "Generating…" : "Download PDF"}
          </button>
          <button type="button" className="yt-action-pill" onClick={onReset}>
            <Icon d={I.trash} size={20} />
            Reset
          </button>
        </div>
      </div>

      {syncNode && <div className="yt-watch-sync">{syncNode}</div>}
    </div>
  );
}
WatchHeader.propTypes = {
  data: PropTypes.object.isRequired,
  ready: PropTypes.bool,
  onToggleReady: PropTypes.func,
  generating: PropTypes.bool,
  onGenerate: PropTypes.func,
  onReset: PropTypes.func,
  onBack: PropTypes.func,
  syncNode: PropTypes.node,
};

/* ── Up-next rail (other resumes) ────────────────────────────────────── */
export function UpNext({ resumes, activeId, onOpen, onCreate }) {
  const others = resumes.filter((r) => r.id !== activeId);
  return (
    <aside className="yt-rail">
      <div className="yt-rail-head">
        <span>Up next</span>
        <button type="button" className="yt-rail-new" onClick={onCreate}>
          + New
        </button>
      </div>
      {others.length === 0 && (
        <p className="yt-rail-empty">No other resumes yet. Create one for another company.</p>
      )}
      {others.map((r) => (
        <button key={r.id} type="button" className="yt-rail-item" onClick={() => onOpen(r.id)}>
          <span className="yt-rail-thumb" style={avatarStyle(channelOf(r))}>
            {initials(channelOf(r))}
            <span className={`yt-rail-badge ${r.ready ? "yt-rail-badge-ready" : ""}`}>
              {r.ready ? "Ready" : "Ongoing"}
            </span>
          </span>
          <span className="yt-rail-text">
            <span className="yt-rail-title">{titleOf(r)}</span>
            <span className="yt-rail-sub">{channelOf(r)}</span>
            <span className="yt-rail-sub">{contentStat(r)} sections</span>
          </span>
        </button>
      ))}
    </aside>
  );
}
UpNext.propTypes = {
  resumes: PropTypes.array,
  activeId: PropTypes.string,
  onOpen: PropTypes.func,
  onCreate: PropTypes.func,
};

/* ── Create dialog (YouTube "upload" style) ──────────────────────────── */
export function CreateModal({ onCancel, onCreate }) {
  const [name, setName] = useState("");
  return (
    <div className="yt-modal-scrim" onMouseDown={onCancel}>
      <div className="yt-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="yt-modal-head">
          <h2>New resume</h2>
          <button type="button" className="yt-icon-btn" onClick={onCancel} aria-label="Close">
            <Icon d={I.close} size={22} />
          </button>
        </div>
        <div className="yt-modal-body">
          <div className="yt-modal-drop">
            <span className="yt-modal-drop-mark" aria-hidden="true">
              <Icon d={I.doc} size={40} />
            </span>
            <p className="yt-modal-drop-title">Name this resume</p>
            <p className="yt-modal-drop-sub">
              Use the company or role you&apos;re targeting — it becomes the video title.
            </p>
            <input
              autoFocus
              className="yt-modal-input"
              value={name}
              placeholder="e.g. Google — Frontend Engineer"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) onCreate(name.trim());
                if (e.key === "Escape") onCancel();
              }}
            />
          </div>
        </div>
        <div className="yt-modal-foot">
          <button type="button" className="yt-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="yt-btn-primary"
            disabled={!name.trim()}
            onClick={() => name.trim() && onCreate(name.trim())}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
CreateModal.propTypes = {
  onCancel: PropTypes.func,
  onCreate: PropTypes.func,
};
