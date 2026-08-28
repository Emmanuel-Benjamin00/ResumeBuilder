// ─────────────────────────────────────────────────────────────────────
// Visual PDF template registry. Each resume stores a `templateId`; the
// builder picker and ResumePDF router both read from this list.
// Rename labels/hints here anytime — ids stay stable for saved data.
// ─────────────────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATE_ID = "classic";

export const TEMPLATES = [
  {
    id: "classic",
    label: "Classic",
    hint: "Centered header, ATS-friendly rules",
  },
  {
    id: "profile",
    label: "Profile",
    hint: "Teal name, blue titles, skills box",
  },
  {
    id: "executive",
    label: "Executive",
    hint: "Caps header, gray pill sections",
  },
];

const VALID = new Set(TEMPLATES.map((t) => t.id));

export function resolveTemplateId(id) {
  return VALID.has(id) ? id : DEFAULT_TEMPLATE_ID;
}
