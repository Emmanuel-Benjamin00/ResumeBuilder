import { useEffect, useState } from "react";
import ResumeBuilder from "./pages/ResumeBuilder.jsx";
import "./App.css";

const THEME_KEY = "resume-builder-theme";

// Read the theme the inline <head> script already applied to <html>.
function currentTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

export default function App() {
  const [theme, setTheme] = useState(currentTheme);
  // Lifted so the top-bar search + hamburger drive the resume sidebar.
  const [query, setQuery] = useState("");
  const [navCollapsed, setNavCollapsed] = useState(false);

  // Keep <html data-theme> and the stored preference in sync with state.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore storage errors */
    }
  }, [theme]);

  return (
    <div className="app-shell">
      <header className="yt-bar">
        {/* ── Left: menu + brand ── */}
        <div className="yt-bar-left">
          <button
            type="button"
            className="yt-icon-btn"
            onClick={() => setNavCollapsed((c) => !c)}
            title="Show/hide resumes"
            aria-label="Toggle resume list"
          >
            <MenuIcon />
          </button>
          <div className="yt-brand" title="Resume Builder">
            <span className="yt-logo" aria-hidden="true">
              <PlayMark />
            </span>
            <span className="yt-brand-name">
              Resume<span className="yt-brand-sup">Builder</span>
            </span>
          </div>
        </div>

        {/* ── Center: search (filters resumes by company / role) ── */}
        <div className="yt-bar-search">
          <div className="yt-search">
            <span className="yt-search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="text"
              className="yt-search-input"
              placeholder="Search your resumes"
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
                ×
              </button>
            )}
            <button
              type="button"
              className="yt-search-btn"
              aria-label="Search"
              title="Search"
              tabIndex={-1}
            >
              <SearchIcon />
            </button>
          </div>
        </div>

        {/* ── Right: theme toggle ── */}
        <div className="yt-bar-right">
          <button
            type="button"
            className="yt-icon-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <main className="app-main">
        <ResumeBuilder
          query={query}
          navCollapsed={navCollapsed}
          onToggleNav={() => setNavCollapsed((c) => !c)}
        />
      </main>
    </div>
  );
}

/* ── Inline icons (Roboto-flavoured, stroke-light like YouTube's) ── */
function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.87 20.17l-5.59-5.59A6.94 6.94 0 0016 10a7 7 0 10-7 7 6.94 6.94 0 004.58-1.71l5.59 5.58zM10 15a5 5 0 115-5 5 5 0 01-5 5z"
      />
    </svg>
  );
}

// YouTube's rounded-triangle play badge — recast as the brand mark.
function PlayMark() {
  return (
    <svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true">
      <rect x="0" y="0" width="28" height="20" rx="5" fill="var(--yt-red)" />
      <path d="M11 6l6 4-6 4z" fill="#fff" />
    </svg>
  );
}
