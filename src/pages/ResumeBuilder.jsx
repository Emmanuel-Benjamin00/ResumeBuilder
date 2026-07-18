import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { pdf, PDFViewer } from "@react-pdf/renderer";
import { toast } from "react-toastify";
import ResumePDF from "../components/resume/ResumePDF";
import {
  DEFAULT_SETTINGS,
  LAYOUT_PRESETS,
  withSettingsDefaults,
} from "../components/resume/resumeSettings";
import {
  BUILTIN_SECTIONS,
  genSectionId,
  normalizeOrder,
  sectionLabel,
} from "../components/resume/resumeOrder";
import {
  defaultFields,
  emptyItem,
  migrateData,
  findMissingRequired,
} from "../components/resume/customFields";
import {
  Input,
  Textarea,
  Select,
  AddBtn,
  RemoveBtn,
  ShowToggle,
  MoveButtons,
  CollapsibleCard,
} from "../components/resume/formControls";
import CustomSectionEditor from "../components/resume/CustomSectionEditor";
import AdminPanel from "../components/resume/AdminPanel";
import {
  isConfigured as cloudEnabled,
  isAdmin,
  onAuthStateChanged,
  signInWithGoogle,
  signOut,
  loadResume,
  saveResume,
} from "../common/firebase";
import "./ResumeBuilder.css";

/* ── Blank templates for repeatable rows ── */
const emptyExperience = () => ({
  company: "",
  role: "",
  location: "",
  dates: "",
  bullets: "",
});
const emptyProject = () => ({ name: "", tech: "", bullets: "" });
const emptyEducation = () => ({
  school: "",
  degree: "",
  location: "",
  dates: "",
});
const emptySkill = () => ({ label: "", value: "" });
const emptySummary = () => ({ id: genSectionId(), text: "" });
const genResumeId = () =>
  `rz_${
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`;
const emptyCert = () => ({ text: "", disabled: false });
const emptyCustomSection = () => {
  const fields = defaultFields();
  return { id: genSectionId(), title: "", fields, items: [emptyItem(fields)] };
};

const initialSummary = emptySummary();

const initialData = {
  personal: {
    name: "",
    location: "",
    phone: "",
    email: "",
    linkedin: "",
    github: "",
    website: "",
  },
  // Multiple summary variants; only `selectedSummary` is rendered into the PDF.
  summaries: [initialSummary],
  selectedSummary: initialSummary.id,
  skills: [emptySkill()],
  experience: [emptyExperience()],
  projects: [emptyProject()],
  education: [emptyEducation()],
  certifications: [emptyCert()],
  customSections: [],
  sectionOrder: [...BUILTIN_SECTIONS],
  disabledSections: [], // section keys hidden from the PDF
  settings: { ...DEFAULT_SETTINGS }, // PDF layout: margins, fonts, spacing
  notes: "", // private scratchpad — never rendered into the PDF
};

const STORAGE_KEY = "resume-builder-data";

// Bring any saved/older resume up to the current shape.
function hydrate(raw) {
  const data = migrateData({ ...initialData, ...raw });
  // certifications: old string[] → { text, disabled }[]
  data.certifications = (data.certifications || []).map((c) =>
    typeof c === "string" ? { text: c, disabled: false } : c
  );
  if (!Array.isArray(data.disabledSections)) data.disabledSections = [];
  // summary: old single string → list of selectable variants. Read from `raw`
  // so the default `summaries` merged in from initialData never masks a legacy
  // string saved before this feature existed.
  if (!Array.isArray(raw && raw.summaries)) {
    const legacy =
      typeof (raw && raw.summary) === "string"
        ? raw.summary
        : typeof data.summary === "string"
          ? data.summary
          : "";
    data.summaries = [{ id: genSectionId(), text: legacy }];
  }
  if (!data.summaries.length) data.summaries = [emptySummary()];
  if (!data.summaries.some((s) => s.id === data.selectedSummary)) {
    data.selectedSummary = data.summaries[0].id;
  }
  delete data.summary;
  // Nested settings need their own merge — the top-level spread is shallow, so
  // a saved resume missing newer keys would otherwise arrive incomplete.
  data.settings = withSettingsDefaults(data.settings);
  return data;
}

/* ── Multi-resume store ──────────────────────────────────────────────
   Each company gets its own resume "document". The store holds them all
   plus which one is active; `createdAt` lets a fresh resume pre-fill from
   the most recently created one. Older saves were a single resume object,
   which we transparently wrap into a one-entry store.                    */

// A resume = the normalized field set + an id, a label (company), and a
// creation timestamp. Existing id/label/createdAt on `fields` win so saved
// resumes keep their identity across reloads.
function makeResume(fields, label = "", createdAt) {
  return {
    ...fields,
    id: fields.id || genResumeId(),
    label: fields.label || label || "",
    createdAt: fields.createdAt || createdAt || Date.now(),
    // Marked "ready" = perfected for its company; unmarked = still ongoing.
    ready: Boolean(fields.ready),
  };
}

// A brand-new, empty resume for another company.
function blankResume(label = "") {
  return makeResume(hydrate({}), label);
}

function emptyStore() {
  const one = blankResume("");
  return { resumes: [one], activeId: one.id };
}

// Is this resume still essentially empty? Drives the "Fill from last resume"
// offer — we only show it when there's nothing to overwrite.
function isBlankResume(r) {
  if (!r) return false;
  const p = r.personal || {};
  if (Object.values(p).some((v) => v && String(v).trim())) return false;
  if ((r.summaries || []).some((s) => s.text && s.text.trim())) return false;
  if (
    (r.skills || []).some(
      (s) => (s.value && s.value.trim()) || (s.label && s.label.trim())
    )
  )
    return false;
  if (
    (r.experience || []).some(
      (e) => e.company || e.role || e.bullets || e.location || e.dates
    )
  )
    return false;
  if ((r.projects || []).some((x) => x.name || x.tech || x.bullets)) return false;
  if (
    (r.education || []).some((e) => e.school || e.degree || e.location || e.dates)
  )
    return false;
  if ((r.certifications || []).some((c) => c.text && c.text.trim())) return false;
  if ((r.customSections || []).length) return false;
  if (r.notes && r.notes.trim()) return false;
  return true;
}

// A just-created resume the user never touched at all — not even named. These
// are dropped when you navigate away instead of lingering as empty documents.
function isDiscardable(r) {
  return Boolean(r && !(r.label || "").trim() && isBlankResume(r));
}

function hydrateStore(raw) {
  if (raw && Array.isArray(raw.resumes)) {
    // Sequential fallback stamps keep migrated resumes in their saved order.
    const resumes = raw.resumes.map((r, i) =>
      makeResume(hydrate(r), r && r.label, i + 1)
    );
    if (!resumes.length) return emptyStore();
    const activeId = resumes.some((r) => r.id === raw.activeId)
      ? raw.activeId
      : resumes[0].id;
    return { resumes, activeId };
  }
  // Legacy single-resume document (or nothing saved yet).
  const one = makeResume(hydrate(raw || {}), "", 1);
  return { resumes: [one], activeId: one.id };
}

function loadInitialStore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return hydrateStore(JSON.parse(saved));
  } catch {
    /* ignore corrupt storage */
  }
  return emptyStore();
}

export default function ResumeBuilder() {
  const [store, setStore] = useState(loadInitialStore);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState("builder"); // "builder" | "admin"

  // The resume currently being edited. Everything below operates on it, so the
  // rest of the form is unchanged: `data` is the active resume, and `setData`
  // maps the update onto it inside the store.
  const active =
    store.resumes.find((r) => r.id === store.activeId) || store.resumes[0];
  const data = active;

  const setData = (updater) =>
    setStore((s) => ({
      ...s,
      resumes: s.resumes.map((r) =>
        r.id === s.activeId
          ? typeof updater === "function"
            ? updater(r)
            : updater
          : r
      ),
    }));

  /* ── Cloud sync state ── */
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncState, setSyncState] = useState("idle"); // idle | loading | saving | saved | error
  const saveTimer = useRef(null);
  // Blocks auto-save until the cloud copy has been pulled in, so we never
  // overwrite a saved resume with the empty form during the sign-in window.
  const hydrated = useRef(false);

  // Watch auth; when a user signs in, pull their resume from the cloud.
  useEffect(() => {
    if (!cloudEnabled) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(async (u) => {
      hydrated.current = false; // runs synchronously before the re-render
      setUser(u);
      setAuthReady(true);
      if (u) {
        setSyncState("loading");
        try {
          const cloud = await loadResume(u.uid);
          if (cloud) {
            setStore(hydrateStore(cloud));
            toast.info("Loaded your saved resumes from the cloud.");
          }
          setSyncState("saved");
        } catch (err) {
          console.error(err);
          setSyncState("error");
        } finally {
          hydrated.current = true; // enable auto-save from here on
        }
      } else {
        setSyncState("idle");
      }
    });
    return unsub;
  }, []);

  // Mirror the whole store to localStorage on every change so switching,
  // adding and deleting resumes survive a reload even when signed out.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* ignore quota/serialization errors */
    }
  }, [store]);

  // Auto-save to the cloud (debounced) whenever any resume changes while signed
  // in. The entire store (all companies) is saved as the user's document.
  useEffect(() => {
    if (!cloudEnabled || !user || !hydrated.current) return;
    setSyncState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveResume(user, store);
        setSyncState("saved");
      } catch (err) {
        console.error(err);
        setSyncState("error");
      }
    }, 900);
    return () => clearTimeout(saveTimer.current);
  }, [store, user]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      toast.error("Sign-in failed. Please try again.");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.info("Signed out. Edits now save on this device only.");
  };

  /* ── Multiple resumes (one per company) ── */
  // A name is required up front, so a new resume is always created titled.
  const addResume = (label) =>
    setStore((s) => {
      const name = (label || "").trim();
      if (!name) return s;
      // Drop the current resume if it's an untouched blank we'd be leaving.
      const active = s.resumes.find((r) => r.id === s.activeId);
      const base = isDiscardable(active)
        ? s.resumes.filter((r) => r.id !== s.activeId)
        : s.resumes;
      const r = blankResume(name);
      return { ...s, resumes: [...base, r], activeId: r.id };
    });

  const switchResume = (id) =>
    setStore((s) => {
      if (id === s.activeId) return s;
      // Leaving an untouched blank resume discards it rather than saving it.
      const active = s.resumes.find((r) => r.id === s.activeId);
      const resumes =
        isDiscardable(active) && s.resumes.length > 1
          ? s.resumes.filter((r) => r.id !== s.activeId)
          : s.resumes;
      return { ...s, resumes, activeId: id };
    });

  const setResumeLabel = (id, label) =>
    setStore((s) => ({
      ...s,
      resumes: s.resumes.map((r) => (r.id === id ? { ...r, label } : r)),
    }));

  // Toggle the "ready for this company" mark on the active resume.
  const toggleReady = () => setData((r) => ({ ...r, ready: !r.ready }));

  // Confirmation is handled by the switcher's two-step UI, so this just applies.
  const removeResume = (id) =>
    setStore((s) => {
      if (s.resumes.length === 1) return s; // always keep at least one
      const resumes = s.resumes.filter((r) => r.id !== id);
      const activeId = s.activeId === id ? resumes[0].id : s.activeId;
      return { ...s, resumes, activeId };
    });

  // Copy every field from a chosen OTHER resume into the active (blank) one,
  // keeping the active resume's own identity (id/name/created time).
  const copyFromResume = (sourceId) =>
    setStore((s) => {
      const source = s.resumes.find((r) => r.id === sourceId);
      if (!source || sourceId === s.activeId) return s;
      const clone = JSON.parse(JSON.stringify(source));
      return {
        ...s,
        resumes: s.resumes.map((r) =>
          r.id === s.activeId
            ? {
                ...clone,
                id: r.id,
                label: r.label,
                createdAt: r.createdAt,
                // A copied resume is a fresh draft — never inherit the source's
                // "ready" mark; it stays Ongoing until perfected for its company.
                ready: false,
              }
            : r
        ),
      };
    });

  // Copying from another resume is always available (as long as there's another
  // resume to copy from) — not just while the active one is blank.
  const canPrefill = store.resumes.length > 1;

  /* ── generic updaters ── */
  const setPersonal = (field, value) =>
    setData((d) => ({ ...d, personal: { ...d.personal, [field]: value } }));

  const setField = (field, value) =>
    setData((d) => ({ ...d, [field]: value }));

  /* ── PDF layout settings ── */
  const setSetting = (key, value) =>
    setData((d) => ({
      ...d,
      settings: { ...withSettingsDefaults(d.settings), [key]: value },
    }));

  // Apply a named preset (keeps the current page size, which is separate).
  const applyPreset = (name) =>
    setData((d) => ({
      ...d,
      settings: {
        ...withSettingsDefaults(d.settings),
        ...(LAYOUT_PRESETS[name] || {}),
      },
    }));

  const setListItem = (list, index, field, value) =>
    setData((d) => {
      const next = [...d[list]];
      next[index] = { ...next[index], [field]: value };
      return { ...d, [list]: next };
    });


  const addItem = (list, factory) =>
    setData((d) => ({ ...d, [list]: [...d[list], factory()] }));

  const removeItem = (list, index) =>
    setData((d) => ({
      ...d,
      [list]: d[list].filter((_, i) => i !== index),
    }));

  // Reorder an entry within a section list.
  const moveListItem = (list, from, to) =>
    setData((d) => {
      const arr = d[list];
      if (to < 0 || to >= arr.length || from === to) return d;
      const next = [...arr];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return { ...d, [list]: next };
    });

  /* ── summary variants ── */
  const addSummary = () => addItem("summaries", emptySummary);

  const removeSummary = (index) =>
    setData((d) => {
      const removed = d.summaries[index];
      const next = d.summaries.filter((_, i) => i !== index);
      // If the shown variant was removed, fall back to the first remaining one.
      const selectedSummary =
        d.selectedSummary === (removed && removed.id)
          ? next[0] && next[0].id
          : d.selectedSummary;
      return { ...d, summaries: next, selectedSummary };
    });

  /* ── custom-section updaters ── */
  const addSection = () =>
    setData((d) => {
      const sec = emptyCustomSection();
      return {
        ...d,
        customSections: [...d.customSections, sec],
        sectionOrder: [...normalizeOrder(d), sec.id],
      };
    });

  const removeSection = (si) =>
    setData((d) => {
      const removed = d.customSections[si];
      return {
        ...d,
        customSections: d.customSections.filter((_, i) => i !== si),
        sectionOrder: normalizeOrder(d).filter(
          (k) => k !== (removed && removed.id)
        ),
      };
    });

  /* ── section ordering ── */
  const moveSection = (from, to) =>
    setData((d) => {
      const order = normalizeOrder(d);
      if (to < 0 || to >= order.length || from === to) return d;
      const next = [...order];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...d, sectionOrder: next };
    });

  // Hide/show a whole section in the PDF (kept in the form either way).
  const toggleSection = (key) =>
    setData((d) => {
      const set = new Set(d.disabledSections || []);
      set.has(key) ? set.delete(key) : set.add(key);
      return { ...d, disabledSections: [...set] };
    });

  // Replace a whole custom section (fields + items + title) at index si.
  const updateSection = (si, nextSection) =>
    setData((d) => {
      const next = [...d.customSections];
      next[si] = nextSection;
      return { ...d, customSections: next };
    });

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* ignore */
    }
  };

  const handleGenerate = async () => {
    if (!(data.label || "").trim()) {
      toast.warn("Give this resume a name (e.g. the company) before generating.");
      return;
    }
    if (!data.personal.name.trim()) {
      toast.warn("Add your name before generating the PDF.");
      return;
    }
    const missing = findMissingRequired(data.customSections);
    if (missing.length) {
      const { section, field } = missing[0];
      toast.warn(
        `Required field "${field}" in "${section}" is empty${
          missing.length > 1 ? ` (and ${missing.length - 1} more)` : ""
        }.`
      );
      return;
    }
    setGenerating(true);
    persist();
    try {
      const blob = await pdf(<ResumePDF data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.personal.name.replace(/\s+/g, "_")}_Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Resume PDF downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong generating the PDF.");
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    if (
      window.confirm(
        "Clear all fields in this resume? This cannot be undone. Your other resumes are kept."
      )
    ) {
      // Reset only the active resume; keep its identity and place in the store.
      setData((r) => ({
        ...blankResume(r.label),
        id: r.id,
        label: r.label,
        createdAt: r.createdAt,
      }));
    }
  };

  return (
    <div className="rb-wrap">
      <header className="rb-head">
        <h1 className="rb-title">Resume Builder</h1>
        <p className="rb-sub">
          Fill in your details, preview live, and download a clean, ATS-friendly
          PDF.
        </p>

        <SyncBar
          cloudEnabled={cloudEnabled}
          authReady={authReady}
          user={user}
          syncState={syncState}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />

        {/* ── Builder / Admin tabs (admins only) ── */}
        {isAdmin(user) && (
          <div className="rb-viewtabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === "builder"}
              className={`rb-viewtab ${view === "builder" ? "rb-viewtab-active" : ""}`}
              onClick={() => setView("builder")}
            >
              Resume Builder
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "admin"}
              className={`rb-viewtab ${view === "admin" ? "rb-viewtab-active" : ""}`}
              onClick={() => setView("admin")}
            >
              Admin
            </button>
          </div>
        )}

        {view === "builder" && (
          <div className="rb-actions">
            <button
              className="rb-btn rb-btn-primary"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? "Generating…" : "Generate PDF"}
            </button>
            <button
              className="rb-btn rb-btn-ghost"
              onClick={() => setShowPreview((s) => !s)}
            >
              {showPreview ? "Hide Preview" : "Live Preview"}
            </button>
            <button className="rb-btn rb-btn-ghost" onClick={handleReset}>
              Reset
            </button>
          </div>
        )}
      </header>

      {view === "admin" && isAdmin(user) ? (
        <AdminPanel />
      ) : (
        <div className="rb-shell">
          {/* ── One resume per company; switch, add or delete ── */}
          <ResumeSidebar
            resumes={store.resumes}
            activeId={store.activeId}
            onSwitch={switchResume}
            onAdd={addResume}
            onRemove={removeResume}
          />

          <div className="rb-main">
            <div className={`rb-layout ${showPreview ? "rb-layout-split" : ""}`}>
              <form className="rb-form" onBlur={persist} onSubmit={(e) => e.preventDefault()}>
          {/* ── This resume's name (company / target role) — required ── */}
          <div className="rb-card rb-resume-meta">
            <Input
              label="Resume name / Company"
              value={data.label || ""}
              onChange={(v) => setResumeLabel(store.activeId, v)}
              placeholder="e.g. Google — Frontend Engineer"
              required
            />
            {!(data.label || "").trim() && (
              <p className="rb-req-hint">
                A name is required — it labels this resume in the switcher and
                can’t be blank when you generate the PDF.
              </p>
            )}

            {/* Mark this resume as ready (perfected) for its company. */}
            <div className="rb-ready">
              <button
                type="button"
                className={`rb-ready-toggle ${data.ready ? "rb-ready-on" : ""}`}
                onClick={toggleReady}
                aria-pressed={data.ready}
                title={
                  data.ready
                    ? "Marked ready — click to set back to ongoing"
                    : "Mark this resume as ready for its company"
                }
              >
                <span className="rb-ready-mark" aria-hidden="true">
                  {data.ready ? "★" : "☆"}
                </span>
                {data.ready ? "Ready for this company" : "Mark as ready"}
              </button>
              <span
                className={`rb-ready-status ${data.ready ? "rb-ready-status-on" : ""}`}
              >
                {data.ready ? "Status: Ready" : "Status: Ongoing"}
              </span>
            </div>
          </div>

          {/* ── Small, always-available control to copy from another resume ── */}
          {canPrefill && (
            <CopyFromPicker
              sources={store.resumes.filter((r) => r.id !== store.activeId)}
              onCopy={copyFromResume}
              targetBlank={isBlankResume(active)}
            />
          )}

          {/* ── Arrange sections ── */}
          <SectionArranger
            order={normalizeOrder(data)}
            customSections={data.customSections}
            disabledSections={data.disabledSections}
            onMove={moveSection}
            onToggle={toggleSection}
          />

          {/* ── Layout & Spacing (fit to one page) ── */}
          <LayoutPanel
            settings={withSettingsDefaults(data.settings)}
            onChange={setSetting}
            onPreset={applyPreset}
          />

          {/* ── Personal ── */}
          <CollapsibleCard title="Personal Details">
            <div className="rb-grid">
              <Input
                label="Full Name"
                value={data.personal.name}
                onChange={(v) => setPersonal("name", v)}
                placeholder="Emmanuel Benjamin D"
              />
              <Input
                label="Location"
                value={data.personal.location}
                onChange={(v) => setPersonal("location", v)}
                placeholder="Chennai, India"
              />
              <Input
                label="Phone"
                value={data.personal.phone}
                onChange={(v) => setPersonal("phone", v)}
                placeholder="+91 80000 00000"
              />
              <Input
                label="Email"
                value={data.personal.email}
                onChange={(v) => setPersonal("email", v)}
                placeholder="you@email.com"
              />
              <Input
                label="LinkedIn"
                value={data.personal.linkedin}
                onChange={(v) => setPersonal("linkedin", v)}
                placeholder="linkedin.com/in/username"
              />
              <Input
                label="GitHub"
                value={data.personal.github}
                onChange={(v) => setPersonal("github", v)}
                placeholder="github.com/username"
              />
              <Input
                label="Website / Portfolio"
                value={data.personal.website}
                onChange={(v) => setPersonal("website", v)}
                placeholder="yoursite.netlify.app"
              />
            </div>
          </CollapsibleCard>

          {/* ── Summary ── */}
          <CollapsibleCard title="Professional Summary">
            <p className="rb-notes-hint">
              Keep several summary variants — e.g. tailored to different roles —
              and pick the one shown on your resume.
            </p>
            {data.summaries.map((s, i) => {
              const shown = data.selectedSummary === s.id;
              return (
                <div
                  className={`rb-item ${shown ? "" : "rb-item-off"}`}
                  key={s.id}
                >
                  <div className="rb-item-head">
                    <label className="rb-summary-pick">
                      <input
                        type="radio"
                        name="rb-selected-summary"
                        checked={shown}
                        onChange={() => setField("selectedSummary", s.id)}
                      />
                      <span>
                        {shown ? "Shown on resume" : "Use this one"}
                      </span>
                    </label>
                    <div className="rb-item-actions">
                      <MoveButtons
                        onUp={() => moveListItem("summaries", i, i - 1)}
                        onDown={() => moveListItem("summaries", i, i + 1)}
                        disableUp={i === 0}
                        disableDown={i === data.summaries.length - 1}
                      />
                      <RemoveBtn
                        onClick={() => removeSummary(i)}
                        disabled={data.summaries.length === 1}
                      />
                    </div>
                  </div>
                  <Textarea
                    value={s.text}
                    onChange={(v) => setListItem("summaries", i, "text", v)}
                    placeholder="A short 2–3 sentence overview of who you are and what you do."
                    rows={4}
                  />
                </div>
              );
            })}
            <AddBtn label="Add summary variant" onClick={addSummary} />
          </CollapsibleCard>

          {/* ── Skills ── */}
          <CollapsibleCard title="Technical Skills">
            {data.skills.map((s, i) => (
              <div className={`rb-row ${s.disabled ? "rb-item-off" : ""}`} key={i}>
                <div className="rb-grid rb-grid-2 rb-flex1">
                  <Input
                    label="Category"
                    value={s.label}
                    onChange={(v) => setListItem("skills", i, "label", v)}
                    placeholder="Frontend & Mobile"
                  />
                  <Input
                    label="Skills (comma separated)"
                    value={s.value}
                    onChange={(v) => setListItem("skills", i, "value", v)}
                    placeholder="React, TypeScript, Redux…"
                  />
                </div>
                <MoveButtons
                  onUp={() => moveListItem("skills", i, i - 1)}
                  onDown={() => moveListItem("skills", i, i + 1)}
                  disableUp={i === 0}
                  disableDown={i === data.skills.length - 1}
                />
                <ShowToggle
                  checked={!s.disabled}
                  onChange={(on) => setListItem("skills", i, "disabled", !on)}
                />
                <RemoveBtn
                  onClick={() => removeItem("skills", i)}
                  disabled={data.skills.length === 1}
                />
              </div>
            ))}
            <AddBtn label="Add skill category" onClick={() => addItem("skills", emptySkill)} />
          </CollapsibleCard>

          {/* ── Experience ── */}
          <CollapsibleCard title="Experience">
            {data.experience.map((e, i) => (
              <div
                className={`rb-item ${e.disabled ? "rb-item-off" : ""}`}
                key={i}
              >
                <div className="rb-item-head">
                  <span>Experience {i + 1}</span>
                  <div className="rb-item-actions">
                    <MoveButtons
                      onUp={() => moveListItem("experience", i, i - 1)}
                      onDown={() => moveListItem("experience", i, i + 1)}
                      disableUp={i === 0}
                      disableDown={i === data.experience.length - 1}
                    />
                    <ShowToggle
                      checked={!e.disabled}
                      onChange={(on) =>
                        setListItem("experience", i, "disabled", !on)
                      }
                    />
                    <RemoveBtn
                      onClick={() => removeItem("experience", i)}
                      disabled={data.experience.length === 1}
                    />
                  </div>
                </div>
                <div className="rb-grid rb-grid-2">
                  <Input
                    label="Company"
                    value={e.company}
                    onChange={(v) => setListItem("experience", i, "company", v)}
                    placeholder="Company Name"
                  />
                  <Input
                    label="Role"
                    value={e.role}
                    onChange={(v) => setListItem("experience", i, "role", v)}
                    placeholder="Software Engineer"
                  />
                  <Input
                    label="Location"
                    value={e.location}
                    onChange={(v) => setListItem("experience", i, "location", v)}
                    placeholder="Chennai, India"
                  />
                  <Input
                    label="Dates"
                    value={e.dates}
                    onChange={(v) => setListItem("experience", i, "dates", v)}
                    placeholder="June 2024 – Present"
                  />
                </div>
                <Textarea
                  label="Bullet points (one per line)"
                  value={e.bullets}
                  onChange={(v) => setListItem("experience", i, "bullets", v)}
                  placeholder={"Built X that did Y…\nImproved Z by N%…"}
                  rows={4}
                />
              </div>
            ))}
            <AddBtn
              label="Add experience"
              onClick={() => addItem("experience", emptyExperience)}
            />
          </CollapsibleCard>

          {/* ── Projects ── */}
          <CollapsibleCard title="Projects">
            {data.projects.map((p, i) => (
              <div
                className={`rb-item ${p.disabled ? "rb-item-off" : ""}`}
                key={i}
              >
                <div className="rb-item-head">
                  <span>Project {i + 1}</span>
                  <div className="rb-item-actions">
                    <MoveButtons
                      onUp={() => moveListItem("projects", i, i - 1)}
                      onDown={() => moveListItem("projects", i, i + 1)}
                      disableUp={i === 0}
                      disableDown={i === data.projects.length - 1}
                    />
                    <ShowToggle
                      checked={!p.disabled}
                      onChange={(on) =>
                        setListItem("projects", i, "disabled", !on)
                      }
                    />
                    <RemoveBtn
                      onClick={() => removeItem("projects", i)}
                      disabled={data.projects.length === 1}
                    />
                  </div>
                </div>
                <div className="rb-grid rb-grid-2">
                  <Input
                    label="Project name"
                    value={p.name}
                    onChange={(v) => setListItem("projects", i, "name", v)}
                    placeholder="Full-Stack Restaurant System"
                  />
                  <Input
                    label="Tech stack"
                    value={p.tech}
                    onChange={(v) => setListItem("projects", i, "tech", v)}
                    placeholder="React, Express.js, MySQL"
                  />
                </div>
                <Textarea
                  label="Bullet points (one per line)"
                  value={p.bullets}
                  onChange={(v) => setListItem("projects", i, "bullets", v)}
                  placeholder={"What you built and the impact…"}
                  rows={3}
                />
              </div>
            ))}
            <AddBtn label="Add project" onClick={() => addItem("projects", emptyProject)} />
          </CollapsibleCard>

          {/* ── Education ── */}
          <CollapsibleCard title="Education">
            {data.education.map((e, i) => (
              <div
                className={`rb-item ${e.disabled ? "rb-item-off" : ""}`}
                key={i}
              >
                <div className="rb-item-head">
                  <span>Education {i + 1}</span>
                  <div className="rb-item-actions">
                    <MoveButtons
                      onUp={() => moveListItem("education", i, i - 1)}
                      onDown={() => moveListItem("education", i, i + 1)}
                      disableUp={i === 0}
                      disableDown={i === data.education.length - 1}
                    />
                    <ShowToggle
                      checked={!e.disabled}
                      onChange={(on) =>
                        setListItem("education", i, "disabled", !on)
                      }
                    />
                    <RemoveBtn
                      onClick={() => removeItem("education", i)}
                      disabled={data.education.length === 1}
                    />
                  </div>
                </div>
                <div className="rb-grid rb-grid-2">
                  <Input
                    label="School / University"
                    value={e.school}
                    onChange={(v) => setListItem("education", i, "school", v)}
                    placeholder="Crescent Institute of Science & Technology"
                  />
                  <Input
                    label="Degree"
                    value={e.degree}
                    onChange={(v) => setListItem("education", i, "degree", v)}
                    placeholder="B.Tech in ECE (CGPA: 7.9)"
                  />
                  <Input
                    label="Location"
                    value={e.location}
                    onChange={(v) => setListItem("education", i, "location", v)}
                    placeholder="Chennai, India"
                  />
                  <Input
                    label="Dates"
                    value={e.dates}
                    onChange={(v) => setListItem("education", i, "dates", v)}
                    placeholder="June 2018 – May 2022"
                  />
                </div>
              </div>
            ))}
            <AddBtn
              label="Add education"
              onClick={() => addItem("education", emptyEducation)}
            />
          </CollapsibleCard>

          {/* ── Certifications ── */}
          <CollapsibleCard title="Certifications & Training">
            {data.certifications.map((c, i) => (
              <div className={`rb-row ${c.disabled ? "rb-item-off" : ""}`} key={i}>
                <div className="rb-flex1">
                  <Input
                    value={c.text}
                    onChange={(v) => setListItem("certifications", i, "text", v)}
                    placeholder="Full-Stack Developer Program – Guvi"
                  />
                </div>
                <MoveButtons
                  onUp={() => moveListItem("certifications", i, i - 1)}
                  onDown={() => moveListItem("certifications", i, i + 1)}
                  disableUp={i === 0}
                  disableDown={i === data.certifications.length - 1}
                />
                <ShowToggle
                  checked={!c.disabled}
                  onChange={(on) =>
                    setListItem("certifications", i, "disabled", !on)
                  }
                />
                <RemoveBtn
                  onClick={() => removeItem("certifications", i)}
                  disabled={data.certifications.length === 1}
                />
              </div>
            ))}
            <AddBtn
              label="Add certification"
              onClick={() => addItem("certifications", emptyCert)}
            />
          </CollapsibleCard>

          {/* ── Custom sections (fully user-defined fields) ── */}
          {data.customSections.map((sec, si) => (
            <CustomSectionEditor
              key={sec.id || si}
              section={sec}
              onChange={(next) => updateSection(si, next)}
              onRemove={() => removeSection(si)}
            />
          ))}

          <button
            type="button"
            className="rb-add-section"
            onClick={addSection}
          >
            + Add custom section
            <span className="rb-add-section-hint">
              Internships, Awards, Languages, Volunteering…
            </span>
          </button>

          {/* ── Private scratchpad — future points, never in the PDF ── */}
          <CollapsibleCard
            title="Scratchpad · Future Points"
            className="rb-card-notes"
            defaultOpen={false}
          >
            <p className="rb-notes-hint">
              Jot down points you might add to your resume later. This is just
              for you — it is saved &amp; synced but never appears in the PDF.
            </p>
            <Textarea
              value={data.notes}
              onChange={(v) => setField("notes", v)}
              placeholder={
                "• Led migration to TypeScript\n• AWS certification (in progress)\n• Open-source contribution to …"
              }
              rows={6}
            />
          </CollapsibleCard>
        </form>

              {showPreview && (
                <div className="rb-preview">
                  <PDFViewer className="rb-pdf-viewer" showToolbar={false}>
                    <ResumePDF data={data} />
                  </PDFViewer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Layout & Spacing panel — tune margins/fonts/gaps to fit one page ── */
const PRESET_BUTTONS = [
  { key: "normal", label: "Normal", hint: "Roomy default" },
  { key: "compact", label: "Compact", hint: "Fits more" },
  { key: "ultra", label: "Ultra", hint: "Tightest" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "A4", label: "A4" },
  { value: "LETTER", label: "US Letter" },
];

// step controls the slider granularity; some knobs move in half-points.
const SLIDERS = [
  { key: "margin", label: "Page margin", min: 20, max: 48, step: 1, unit: "pt" },
  { key: "fontSize", label: "Body font size", min: 8.5, max: 11.5, step: 0.5, unit: "pt" },
  { key: "lineHeight", label: "Line height", min: 1.1, max: 1.5, step: 0.05, unit: "" },
  { key: "sectionGap", label: "Section spacing", min: 6, max: 20, step: 1, unit: "pt" },
  { key: "entryGap", label: "Entry spacing", min: 3, max: 14, step: 1, unit: "pt" },
  { key: "nameSize", label: "Name size", min: 16, max: 28, step: 1, unit: "pt" },
];

function LayoutPanel({ settings, onChange, onPreset }) {
  return (
    <CollapsibleCard title="Layout & Spacing" defaultOpen={false}>
      <p className="rb-layout-hint">
        Fit your resume onto one page by tightening spacing and fonts — no need
        to cut content. Start with a preset, then fine-tune.
      </p>

      <div className="rb-preset-row">
        {PRESET_BUTTONS.map((p) => (
          <button
            key={p.key}
            type="button"
            className="rb-preset-btn"
            onClick={() => onPreset(p.key)}
            title={p.hint}
          >
            <span className="rb-preset-label">{p.label}</span>
            <span className="rb-preset-hint">{p.hint}</span>
          </button>
        ))}
      </div>

      <div className="rb-field rb-pagesize">
        <Select
          label="Page size"
          value={settings.pageSize}
          onChange={(v) => onChange("pageSize", v)}
          options={PAGE_SIZE_OPTIONS}
        />
      </div>

      <div className="rb-slider-grid">
        {SLIDERS.map((s) => (
          <Range
            key={s.key}
            label={s.label}
            value={settings[s.key]}
            min={s.min}
            max={s.max}
            step={s.step}
            unit={s.unit}
            onChange={(v) => onChange(s.key, v)}
          />
        ))}
      </div>
    </CollapsibleCard>
  );
}

LayoutPanel.propTypes = {
  settings: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onPreset: PropTypes.func.isRequired,
};

/* Labeled range slider with a live numeric readout. */
function Range({ label, value, min, max, step, unit, onChange }) {
  const display = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return (
    <label className="rb-range">
      <span className="rb-range-head">
        <span className="rb-label">{label}</span>
        <span className="rb-range-value">
          {display}
          {unit}
        </span>
      </span>
      <input
        type="range"
        className="rb-range-input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

Range.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  unit: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

/* ── Resume sidebar: list every resume, switch, add, mark & delete ── */
function ResumeSidebar({ resumes, activeId, onSwitch, onAdd, onRemove }) {
  const [collapsed, setCollapsed] = useState(false);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [menuId, setMenuId] = useState(null); // row whose options menu is open
  const [confirmId, setConfirmId] = useState(null); // row awaiting delete confirm

  // Close any open options menu when the selected resume changes.
  useEffect(() => setMenuId(null), [activeId]);

  // A name is mandatory — only create once one is entered.
  const submitName = () => {
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNaming(false);
    setNewName("");
  };

  const cancelName = () => {
    setNaming(false);
    setNewName("");
  };

  if (collapsed) {
    return (
      <aside className="rb-sidebar rb-sidebar-collapsed">
        <button
          type="button"
          className="rb-sidebar-expand"
          onClick={() => setCollapsed(false)}
          title="Show resumes"
        >
          <span aria-hidden="true">☰</span>
          <span className="rb-sidebar-expand-label">Resumes</span>
          <span className="rb-sidebar-expand-count">{resumes.length}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="rb-sidebar">
      <div className="rb-sidebar-head">
        <h2 className="rb-sidebar-title">Resumes</h2>
        <div className="rb-sidebar-head-actions">
          {!naming && (
            <button
              type="button"
              className="rb-tab-add"
              onClick={() => {
                setMenuId(null);
                setConfirmId(null);
                setNaming(true);
              }}
              title="Create a new resume for another company"
            >
              <span aria-hidden="true">＋</span> New
            </button>
          )}
          <button
            type="button"
            className="rb-sidebar-collapse"
            onClick={() => setCollapsed(true)}
            title="Hide sidebar"
            aria-label="Hide sidebar"
          >
            <span aria-hidden="true">⟨</span>
          </button>
        </div>
      </div>

      {/* Naming a new resume — name is required before it's created. */}
      {naming && (
        <div className="rb-sidebar-name">
          <input
            className="rb-switcher-select"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitName();
              } else if (e.key === "Escape") {
                cancelName();
              }
            }}
            placeholder="Company / role name"
          />
          <div className="rb-sidebar-name-actions">
            <button
              type="button"
              className="rb-btn rb-btn-ghost"
              onClick={cancelName}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rb-btn rb-btn-primary"
              onClick={submitName}
              disabled={!newName.trim()}
            >
              Create
            </button>
          </div>
        </div>
      )}

      <ul className="rb-sidebar-list">
        {resumes.map((r) => {
          const name = (r.label && r.label.trim()) || "Untitled resume";
          const isActive = r.id === activeId;
          const menuOpen = menuId === r.id;
          const confirming = confirmId === r.id;
          return (
            <li
              key={r.id}
              className={`rb-sidebar-item ${
                isActive ? "rb-sidebar-item-active" : ""
              }`}
            >
              <div className="rb-sidebar-item-row">
                <button
                  type="button"
                  className="rb-sidebar-item-btn"
                  onClick={() => onSwitch(r.id)}
                  title={name}
                >
                  <span className="rb-sidebar-item-name">
                    {r.ready && (
                      <span className="rb-sidebar-star" aria-hidden="true">
                        ★
                      </span>
                    )}
                    <span className="rb-sidebar-item-label">{name}</span>
                  </span>
                  <span
                    className={`rb-sidebar-badge ${
                      r.ready ? "rb-sidebar-badge-ready" : ""
                    }`}
                  >
                    {r.ready ? "Ready" : "Ongoing"}
                  </span>
                </button>

                {resumes.length > 1 && (
                  <button
                    type="button"
                    className={`rb-sidebar-opt ${menuOpen ? "rb-sidebar-opt-on" : ""}`}
                    onClick={() =>
                      setMenuId((cur) => (cur === r.id ? null : r.id))
                    }
                    aria-haspopup="true"
                    aria-expanded={menuOpen}
                    title="Options"
                  >
                    <span aria-hidden="true">⋯</span>
                  </button>
                )}
              </div>

              {/* Inline options — no clipped popup. */}
              {menuOpen && (
                <div className="rb-sidebar-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="rb-sidebar-menu-del"
                    onClick={() => {
                      setMenuId(null);
                      setConfirmId(r.id);
                    }}
                  >
                    <span aria-hidden="true">🗑</span> Delete resume
                  </button>
                </div>
              )}

              {/* Deliberate two-step delete so it can't be hit by accident. */}
              {confirming && (
                <div className="rb-sidebar-confirm">
                  <span className="rb-sidebar-confirm-text">
                    Delete “{name}” permanently? This can’t be undone.
                  </span>
                  <div className="rb-sidebar-confirm-actions">
                    <button
                      type="button"
                      className="rb-btn rb-btn-ghost"
                      onClick={() => setConfirmId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rb-switcher-del-confirm"
                      onClick={() => {
                        onRemove(r.id);
                        setConfirmId(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

ResumeSidebar.propTypes = {
  resumes: PropTypes.array.isRequired,
  activeId: PropTypes.string,
  onSwitch: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

/* ── Small "Options" menu holding the "copy from another resume" action.
   A custom menu (not a native <select>) so option text is always readable
   in dark mode, and the whole thing stays tucked behind one button.       */
function CopyFromPicker({ sources, onCopy, targetBlank }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close the menu on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!sources.length) return null;

  const pick = (id) => {
    setOpen(false);
    // Copying overwrites current content — guard it only when there's
    // something to lose. A blank resume copies straight in.
    if (
      targetBlank ||
      window.confirm(
        "Copy over this resume? Its current content will be replaced (name and status are kept)."
      )
    ) {
      onCopy(id);
    }
  };

  return (
    <div className="rb-copyfrom" ref={ref}>
      <button
        type="button"
        className={`rb-copyfrom-toggle ${open ? "rb-copyfrom-toggle-on" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Options"
      >
        <span aria-hidden="true">⚙</span> Options
      </button>

      {open && (
        <div className="rb-copyfrom-menu" role="menu">
          <p className="rb-copyfrom-heading">Copy from another resume</p>
          <ul className="rb-copyfrom-list">
            {sources.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  role="menuitem"
                  className="rb-copyfrom-item"
                  onClick={() => pick(r.id)}
                >
                  {r.ready && (
                    <span className="rb-copyfrom-star" aria-hidden="true">
                      ★
                    </span>
                  )}
                  <span className="rb-copyfrom-item-label">
                    {(r.label && r.label.trim()) || "Untitled resume"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

CopyFromPicker.propTypes = {
  sources: PropTypes.array.isRequired,
  onCopy: PropTypes.func.isRequired,
  targetBlank: PropTypes.bool,
};

/* ── Cloud sync status bar ── */
const SYNC_LABEL = {
  loading: "Loading…",
  saving: "Saving…",
  saved: "All changes saved to cloud",
  error: "Sync error — retrying on next edit",
  idle: "",
};

function SyncBar({ cloudEnabled, authReady, user, syncState, onSignIn, onSignOut }) {
  if (!cloudEnabled) {
    return (
      <div className="rb-sync rb-sync-local">
        Saved on this device only. Cloud sync isn&apos;t configured yet.
      </div>
    );
  }
  if (!authReady) {
    return <div className="rb-sync">Checking sign-in…</div>;
  }
  if (!user) {
    return (
      <div className="rb-sync">
        <span className="rb-sync-hint">
          Sign in to save your resume and open it on any device.
        </span>
        <button className="rb-btn rb-btn-google" onClick={onSignIn}>
          <GoogleGlyph /> Sign in with Google
        </button>
      </div>
    );
  }
  return (
    <div className="rb-sync">
      <span className={`rb-sync-dot rb-sync-${syncState}`} />
      <span className="rb-sync-status">
        {SYNC_LABEL[syncState] || "Synced"}
      </span>
      <span className="rb-sync-user">· {user.email}</span>
      <button className="rb-link-btn" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

SyncBar.propTypes = {
  cloudEnabled: PropTypes.bool,
  authReady: PropTypes.bool,
  user: PropTypes.object,
  syncState: PropTypes.string,
  onSignIn: PropTypes.func.isRequired,
  onSignOut: PropTypes.func.isRequired,
};

/* ── Drag-and-drop section reordering + show/hide ── */
function SectionArranger({ order, customSections, disabledSections, onMove, onToggle }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const hidden = new Set(disabledSections || []);

  const handleDrop = (target) => {
    if (dragIndex !== null && target !== null) onMove(dragIndex, target);
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <fieldset className="rb-card rb-arrange">
      <legend>Arrange Sections</legend>
      <p className="rb-arrange-hint">
        Drag ⠿ or use ↑ ↓ to reorder. Toggle a section to show/hide it in the
        PDF without deleting it.
      </p>
      <ul className="rb-arrange-list">
        {order.map((key, i) => {
          const off = hidden.has(key);
          return (
            <li
              key={key}
              className={`rb-arrange-item ${dragIndex === i ? "rb-dragging" : ""} ${
                overIndex === i && dragIndex !== i ? "rb-drop-target" : ""
              } ${off ? "rb-item-off" : ""}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(i);
              }}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
            >
              <span className="rb-grip" aria-hidden="true">
                ⠿
              </span>
              <span className="rb-arrange-label">
                {sectionLabel(key, customSections)}
              </span>
              <ShowToggle checked={!off} onChange={() => onToggle(key)} />
              <span className="rb-arrange-btns">
                <button
                  type="button"
                  onClick={() => onMove(i, i - 1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(i, i + 1)}
                  disabled={i === order.length - 1}
                  aria-label="Move down"
                  title="Move down"
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

SectionArranger.propTypes = {
  order: PropTypes.arrayOf(PropTypes.string).isRequired,
  customSections: PropTypes.array,
  disabledSections: PropTypes.array,
  onMove: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
};

