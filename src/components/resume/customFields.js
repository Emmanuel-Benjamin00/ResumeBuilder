// ─────────────────────────────────────────────────────────────────────
// Field model for fully-custom sections. Each custom section owns a
// `fields` schema (what inputs exist) and `items` (rows of values keyed
// by field id). Shared by the builder UI and the PDF renderer.
// ─────────────────────────────────────────────────────────────────────

export const FIELD_TYPES = [
  { value: "text", label: "Single-line text" },
  { value: "textarea", label: "Paragraph" },
  { value: "bullets", label: "Bullet list" },
];

export const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

export const STYLE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "bold", label: "Bold" },
  { value: "italic", label: "Italic" },
];

export function genFieldId() {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `f_${rand}`;
}

// A brand-new field with sensible defaults.
export function newField(overrides = {}) {
  return {
    id: genFieldId(),
    label: "New Field",
    type: "text",
    align: "left",
    style: "normal",
    showLabel: false,
    required: false,
    placeholder: "",
    ...overrides,
  };
}

// Default starter schema for a new custom section — mirrors the classic
// resume entry (bold title + right-aligned date, italic subtitle + location,
// then a bullet list). Users can freely edit/add/remove these.
export function defaultFields() {
  return [
    newField({ label: "Title", style: "bold", align: "left", required: true }),
    newField({ label: "Date", align: "right" }),
    newField({ label: "Subtitle", style: "italic", align: "left" }),
    newField({ label: "Location", style: "italic", align: "right" }),
    newField({ label: "Details", type: "bullets" }),
  ];
}

// An empty item (all fields blank) for the given schema.
export function emptyItem(fields) {
  const item = {};
  for (const f of fields) item[f.id] = "";
  return item;
}

// Upgrade an old-shape custom section (fixed title/subtitle/location/dates/
// bullets keys) to the new field-based shape. Idempotent.
export function migrateSection(sec) {
  if (!sec) return sec;
  if (Array.isArray(sec.fields)) return sec; // already new shape

  const fields = defaultFields();
  const [fTitle, fDate, fSubtitle, fLocation, fDetails] = fields;
  const items = (sec.items || []).map((it) => ({
    [fTitle.id]: it.title || "",
    [fDate.id]: it.dates || "",
    [fSubtitle.id]: it.subtitle || "",
    [fLocation.id]: it.location || "",
    [fDetails.id]: it.bullets || "",
  }));
  return {
    ...sec,
    fields,
    items: items.length ? items : [emptyItem(fields)],
  };
}

// Migrate every custom section on a resume data object.
export function migrateData(data) {
  if (!data || !Array.isArray(data.customSections)) return data;
  return {
    ...data,
    customSections: data.customSections.map(migrateSection),
  };
}

// Which required fields are empty in any partially-filled row?
// Returns [{ section, field }] for user-facing validation.
export function findMissingRequired(customSections = []) {
  const missing = [];
  for (const sec of customSections) {
    const fields = sec.fields || [];
    const required = fields.filter((f) => f.required);
    if (!required.length) continue;
    (sec.items || []).forEach((item) => {
      const anyFilled = fields.some((f) => String(item[f.id] || "").trim());
      if (!anyFilled) return; // ignore fully-empty rows
      for (const f of required) {
        if (!String(item[f.id] || "").trim()) {
          missing.push({
            section: sec.title || "Custom Section",
            field: f.label,
          });
        }
      }
    });
  }
  return missing;
}
