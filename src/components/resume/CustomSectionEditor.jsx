import { useState } from "react";
import PropTypes from "prop-types";
import {
  Input,
  Textarea,
  Select,
  AddBtn,
  RemoveBtn,
  ShowToggle,
  MoveButtons,
  CollapsibleCard,
} from "./formControls";
import {
  FIELD_TYPES,
  ALIGN_OPTIONS,
  STYLE_OPTIONS,
  newField,
  emptyItem,
} from "./customFields";

/*
 * Editor for a single fully-custom section: users define the fields
 * (heading / type / alignment / style / required) and then fill entries
 * whose inputs are generated from that schema.
 *
 * Owns no global state — it emits the whole updated section via onChange.
 */
export default function CustomSectionEditor({ section, onChange, onRemove }) {
  const [showFields, setShowFields] = useState(false);
  const fields = section.fields || [];
  const items = section.items || [];

  const patch = (next) => onChange({ ...section, ...next });

  /* ── field-schema ops ── */
  const addField = () => patch({ fields: [...fields, newField()] });

  const updateField = (id, changes) =>
    patch({
      fields: fields.map((f) => (f.id === id ? { ...f, ...changes } : f)),
    });

  const removeField = (id) =>
    patch({ fields: fields.filter((f) => f.id !== id) });

  const moveField = (from, to) => {
    if (to < 0 || to >= fields.length) return;
    const next = [...fields];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    patch({ fields: next });
  };

  /* ── entry ops ── */
  const addItem = () => patch({ items: [...items, emptyItem(fields)] });

  const removeItem = (idx) =>
    patch({ items: items.filter((_, i) => i !== idx) });

  const moveItem = (from, to) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    patch({ items: next });
  };

  const updateItem = (idx, fieldId, value) =>
    patch({
      items: items.map((it, i) =>
        i === idx ? { ...it, [fieldId]: value } : it
      ),
    });

  return (
    <CollapsibleCard
      className="rb-card-custom"
      title={section.title.trim() || "Custom Section"}
      headerExtra={<RemoveBtn onClick={onRemove} />}
    >
      <Input
        label="Section heading"
        value={section.title}
        onChange={(v) => patch({ title: v })}
        placeholder="Internships"
      />

      {/* Field schema configurator */}
      <button
        type="button"
        className="rb-fields-toggle"
        onClick={() => setShowFields((s) => !s)}
      >
        {showFields ? "▾" : "▸"} Configure fields ({fields.length})
      </button>

      {showFields && (
        <div className="rb-fields-panel">
          {fields.map((f, i) => (
            <div className="rb-field-def" key={f.id}>
              <div className="rb-field-def-head">
                <span className="rb-field-def-title">Field {i + 1}</span>
                <div className="rb-arrange-btns">
                  <button
                    type="button"
                    onClick={() => moveField(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Move field up"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(i, i + 1)}
                    disabled={i === fields.length - 1}
                    aria-label="Move field down"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <RemoveBtn
                    onClick={() => removeField(f.id)}
                    disabled={fields.length === 1}
                  />
                </div>
              </div>

              <div className="rb-grid rb-grid-2">
                <Input
                  label="Field heading"
                  value={f.label}
                  onChange={(v) => updateField(f.id, { label: v })}
                  placeholder="Company"
                />
                <Select
                  label="Type"
                  value={f.type}
                  onChange={(v) => updateField(f.id, { type: v })}
                  options={FIELD_TYPES}
                />
                {f.type === "text" && (
                  <Select
                    label="Alignment"
                    value={f.align}
                    onChange={(v) => updateField(f.id, { align: v })}
                    options={ALIGN_OPTIONS}
                  />
                )}
                <Select
                  label="Style"
                  value={f.style}
                  onChange={(v) => updateField(f.id, { style: v })}
                  options={STYLE_OPTIONS}
                />
              </div>

              <div className="rb-field-toggles">
                <label className="rb-check">
                  <input
                    type="checkbox"
                    checked={!!f.showLabel}
                    onChange={(e) =>
                      updateField(f.id, { showLabel: e.target.checked })
                    }
                  />
                  Show heading in PDF (e.g. &quot;{f.label || "Label"}: value&quot;)
                </label>
                <label className="rb-check">
                  <input
                    type="checkbox"
                    checked={!!f.required}
                    onChange={(e) =>
                      updateField(f.id, { required: e.target.checked })
                    }
                  />
                  Required
                </label>
              </div>
            </div>
          ))}
          <AddBtn label="Add field" onClick={addField} />
        </div>
      )}

      {/* Entries — inputs generated from the field schema */}
      {items.map((item, idx) => (
        <div
          className={`rb-item ${item.disabled ? "rb-item-off" : ""}`}
          key={idx}
        >
          <div className="rb-item-head">
            <span>Entry {idx + 1}</span>
            <div className="rb-item-actions">
              <MoveButtons
                onUp={() => moveItem(idx, idx - 1)}
                onDown={() => moveItem(idx, idx + 1)}
                disableUp={idx === 0}
                disableDown={idx === items.length - 1}
              />
              <ShowToggle
                checked={!item.disabled}
                onChange={(on) => updateItem(idx, "disabled", !on)}
              />
              <RemoveBtn
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
              />
            </div>
          </div>
          {fields.map((f) =>
            f.type === "text" ? (
              <Input
                key={f.id}
                label={f.label}
                required={f.required}
                value={item[f.id]}
                onChange={(v) => updateItem(idx, f.id, v)}
                placeholder={f.placeholder}
              />
            ) : (
              <Textarea
                key={f.id}
                label={
                  f.type === "bullets"
                    ? `${f.label} (one bullet per line)`
                    : f.label
                }
                required={f.required}
                value={item[f.id]}
                onChange={(v) => updateItem(idx, f.id, v)}
                placeholder={f.placeholder}
                rows={3}
              />
            )
          )}
        </div>
      ))}
      <AddBtn label="Add entry" onClick={addItem} />
    </CollapsibleCard>
  );
}

CustomSectionEditor.propTypes = {
  section: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    fields: PropTypes.array,
    items: PropTypes.array,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};
