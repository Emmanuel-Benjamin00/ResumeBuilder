import { useState } from "react";
import PropTypes from "prop-types";

/* Shared form controls used across the Resume Builder. */

/* Collapsible section card — click the header to expand/collapse the body. */
export function CollapsibleCard({
  title,
  children,
  defaultOpen = true,
  className = "",
  headerExtra = null,
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rb-card rb-collapsible ${className}`}>
      <div className="rb-card-headrow">
        <button
          type="button"
          className="rb-card-header"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="rb-card-chevron">{open ? "▾" : "▸"}</span>
          <span className="rb-card-title">{title}</span>
        </button>
        {headerExtra}
      </div>
      {open && <div className="rb-card-body">{children}</div>}
    </div>
  );
}
CollapsibleCard.propTypes = {
  title: PropTypes.node.isRequired,
  children: PropTypes.node,
  defaultOpen: PropTypes.bool,
  className: PropTypes.string,
  headerExtra: PropTypes.node,
};

export function Input({ label, value, onChange, placeholder, required }) {
  return (
    <label className="rb-field">
      {label && (
        <span className="rb-label">
          {label}
          {required && <span className="rb-req">*</span>}
        </span>
      )}
      <input
        className="rb-input"
        type="text"
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function Textarea({ label, value, onChange, placeholder, rows = 3, required }) {
  return (
    <label className="rb-field">
      {label && (
        <span className="rb-label">
          {label}
          {required && <span className="rb-req">*</span>}
        </span>
      )}
      <textarea
        className="rb-input rb-textarea"
        value={value || ""}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function Select({ label, value, onChange, options }) {
  return (
    <label className="rb-field">
      {label && <span className="rb-label">{label}</span>}
      <select
        className="rb-input rb-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* Show/hide-in-PDF toggle for an item or section. */
export function ShowToggle({ checked, onChange }) {
  return (
    <label
      className={`rb-show-toggle ${checked ? "" : "rb-show-off"}`}
      title={
        checked
          ? "Shown in PDF — click to hide"
          : "Hidden from PDF — click to show"
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{checked ? "Shown" : "Hidden"}</span>
    </label>
  );
}

/* Up / down reorder buttons for an item within a list. */
export function MoveButtons({ onUp, onDown, disableUp, disableDown }) {
  return (
    <span className="rb-arrange-btns">
      <button
        type="button"
        onClick={onUp}
        disabled={disableUp}
        aria-label="Move up"
        title="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disableDown}
        aria-label="Move down"
        title="Move down"
      >
        ↓
      </button>
    </span>
  );
}

export function AddBtn({ label, onClick }) {
  return (
    <button type="button" className="rb-add" onClick={onClick}>
      + {label}
    </button>
  );
}

export function RemoveBtn({ onClick, disabled }) {
  return (
    <button
      type="button"
      className="rb-remove"
      onClick={onClick}
      disabled={disabled}
      aria-label="Remove"
      title={disabled ? "At least one required" : "Remove"}
    >
      ×
    </button>
  );
}

Input.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
};
Textarea.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  rows: PropTypes.number,
  required: PropTypes.bool,
};
Select.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array.isRequired,
};
ShowToggle.propTypes = {
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
};
MoveButtons.propTypes = {
  onUp: PropTypes.func.isRequired,
  onDown: PropTypes.func.isRequired,
  disableUp: PropTypes.bool,
  disableDown: PropTypes.bool,
};
AddBtn.propTypes = {
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};
RemoveBtn.propTypes = {
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
