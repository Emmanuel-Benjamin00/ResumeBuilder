// ─────────────────────────────────────────────────────────────────────
// PDF layout settings for the resume. These are the knobs the builder's
// "Layout & Spacing" panel controls so a resume can be nudged onto a single
// page without cutting content. Shared by the builder UI and the renderer.
// All sizes are in PDF points (72pt = 1in).
// ─────────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS = {
  pageSize: "A4", // "A4" | "LETTER"
  margin: 36, // page padding on all four sides (0.5in)
  fontSize: 10, // base body font size
  lineHeight: 1.4, // body line spacing
  sectionGap: 15, // space above each section heading
  entryGap: 8, // space above each experience/education/project entry
  nameSize: 22, // name heading size
};

// One-click presets. "compact"/"ultra" reclaim space to fit one page.
// pageSize is intentionally omitted so applying a preset keeps the user's
// chosen page size.
export const LAYOUT_PRESETS = {
  normal: { margin: 36, fontSize: 10, lineHeight: 1.4, sectionGap: 15, entryGap: 8, nameSize: 22 },
  compact: { margin: 30, fontSize: 9.5, lineHeight: 1.3, sectionGap: 11, entryGap: 6, nameSize: 20 },
  ultra: { margin: 24, fontSize: 9, lineHeight: 1.2, sectionGap: 9, entryGap: 5, nameSize: 18 },
};

// Fill any missing keys with defaults so resumes saved before this feature
// (or saved by an older version) still render correctly.
export const withSettingsDefaults = (s) => ({ ...DEFAULT_SETTINGS, ...(s || {}) });
