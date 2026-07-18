// ─────────────────────────────────────────────────────────────────────
// Single source of truth for section ordering, shared by the builder UI
// and the PDF renderer so they never drift apart.
// ─────────────────────────────────────────────────────────────────────

// Fixed built-in sections, in their default top-to-bottom order.
export const BUILTIN_SECTIONS = [
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
  "certifications",
];

export const SECTION_LABELS = {
  summary: "Professional Summary",
  skills: "Technical Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications & Training",
};

// Generate a stable id for a custom section (browser runtime only).
export function genSectionId() {
  const rand =
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2));
  return `cs_${rand}`;
}

// Return a complete, de-duplicated, valid ordering for the given data.
// - keeps whatever explicit order exists,
// - drops ids that no longer exist,
// - appends any built-in / custom sections missing from the order.
// This makes older saved resumes (no sectionOrder) upgrade cleanly.
export function normalizeOrder(data) {
  const customIds = (data.customSections || [])
    .map((s) => s.id)
    .filter(Boolean);
  const valid = new Set([...BUILTIN_SECTIONS, ...customIds]);

  const seen = new Set();
  const order = [];

  for (const key of data.sectionOrder || []) {
    if (valid.has(key) && !seen.has(key)) {
      order.push(key);
      seen.add(key);
    }
  }
  for (const key of BUILTIN_SECTIONS) {
    if (!seen.has(key)) {
      order.push(key);
      seen.add(key);
    }
  }
  for (const id of customIds) {
    if (!seen.has(id)) {
      order.push(id);
      seen.add(id);
    }
  }
  return order;
}

// Human label for any section key (built-in or custom).
export function sectionLabel(key, customSections = []) {
  if (SECTION_LABELS[key]) return SECTION_LABELS[key];
  const sec = customSections.find((s) => s.id === key);
  return (sec && sec.title.trim()) || "Custom Section";
}
