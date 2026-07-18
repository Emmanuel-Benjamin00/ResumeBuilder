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
      <header className="app-bar">
        <div className="app-brand">
          <span className="app-logo" aria-hidden="true">
            📄
          </span>
          <span className="app-name">Resume Builder</span>
        </div>
        <button
          type="button"
          className="app-theme-toggle"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </header>

      <main className="app-main">
        <ResumeBuilder />
      </main>
    </div>
  );
}
