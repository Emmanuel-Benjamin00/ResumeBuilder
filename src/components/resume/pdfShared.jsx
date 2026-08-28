import PropTypes from "prop-types";
import { createContext, useContext } from "react";
import { Text, View, Link } from "@react-pdf/renderer";

/* Styles flow to nested components through context so each template's
 * StyleSheet reaches Bullet / SectionHeading / ContactLine without props. */
export const StylesContext = createContext(null);
export const useStyles = () => useContext(StylesContext);

export const isFilled = (v) => Boolean(v && String(v).trim().length > 0);

export const personalShape = PropTypes.shape({
  name: PropTypes.string,
  title: PropTypes.string,
  location: PropTypes.string,
  phone: PropTypes.string,
  email: PropTypes.string,
  linkedin: PropTypes.string,
  github: PropTypes.string,
  website: PropTypes.string,
});

export const enabled = (item) => !item || !item.disabled;

export function resolveSummary(data) {
  if (Array.isArray(data.summaries)) {
    const sel =
      data.summaries.find((s) => s.id === data.selectedSummary) ||
      data.summaries[0];
    return sel ? sel.text : "";
  }
  return data.summary || "";
}

export function activeResume(input) {
  if (input && Array.isArray(input.resumes)) {
    return (
      input.resumes.find((r) => r.id === input.activeId) ||
      input.resumes[0] ||
      {}
    );
  }
  return input || {};
}

export function normalizeUrl(u) {
  const s = String(u).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:/i.test(s)) return s;
  return `https://${s}`;
}

export function prettyUrl(u) {
  return String(u)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

export function splitLines(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export const SUBHEADING_RE = /^#+\s*/;
export const PASTED_MARKER_RE = /^[•·▪◦*-]\s+/;

export const emphasisStyle = (f, styles) =>
  f.style === "bold"
    ? styles.fBold
    : f.style === "italic"
      ? styles.fItalic
      : styles.fNormal;

export const fieldDisplay = (f, value) =>
  f.showLabel && isFilled(f.label) ? `${f.label}: ${value}` : value;

export function Bullet({ children }) {
  const styles = useStyles();
  return (
    <View style={styles.bulletRow} wrap={false}>
      <Text style={styles.bulletDot}>{"•"}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export function SubHeading({ children }) {
  const styles = useStyles();
  return (
    <Text style={styles.subHeading} minPresenceAhead={36}>
      {children}
    </Text>
  );
}

export function BulletLines({ lines }) {
  return lines.map((line, i) =>
    SUBHEADING_RE.test(line) ? (
      <SubHeading key={i}>{line.replace(SUBHEADING_RE, "")}</SubHeading>
    ) : (
      <Bullet key={i}>{line.replace(PASTED_MARKER_RE, "")}</Bullet>
    )
  );
}

/* Paragraph lines (no dots) — used by Profile for experience blurbs. */
export function ParaLines({ lines }) {
  const styles = useStyles();
  return lines.map((line, i) =>
    SUBHEADING_RE.test(line) ? (
      <SubHeading key={i}>{line.replace(SUBHEADING_RE, "")}</SubHeading>
    ) : (
      <Text key={i} style={styles.paraLine}>
        {line.replace(PASTED_MARKER_RE, "")}
      </Text>
    )
  );
}

export function SectionHeading({ title }) {
  const styles = useStyles();
  return (
    <View style={styles.section} minPresenceAhead={72}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.rule} />
    </View>
  );
}

/* Classic centered contact: email → linkedin → github → website → phone → location */
export function ContactLine({ personal, order }) {
  const styles = useStyles();
  const seq =
    order ||
    ["email", "linkedin", "github", "website", "phone", "location"];
  const items = [];

  for (const key of seq) {
    if (key === "email" && isFilled(personal.email))
      items.push({ text: personal.email, href: `mailto:${personal.email}` });
    else if (key === "linkedin" && isFilled(personal.linkedin))
      items.push({
        text: prettyUrl(personal.linkedin),
        href: normalizeUrl(personal.linkedin),
      });
    else if (key === "github" && isFilled(personal.github))
      items.push({
        text: prettyUrl(personal.github),
        href: normalizeUrl(personal.github),
      });
    else if (key === "website" && isFilled(personal.website))
      items.push({
        text: prettyUrl(personal.website),
        href: normalizeUrl(personal.website),
      });
    else if (key === "phone" && isFilled(personal.phone))
      items.push({ text: personal.phone });
    else if (key === "location" && isFilled(personal.location))
      items.push({ text: personal.location });
  }

  if (!items.length) return null;

  return (
    <Text style={styles.contactLine}>
      {items.map((it, i) => (
        <Text key={i}>
          {i > 0 ? <Text style={styles.sep}>{" | "}</Text> : null}
          {it.href ? (
            <Link src={it.href} style={styles.link}>
              {it.text}
            </Link>
          ) : (
            <Text>{it.text}</Text>
          )}
        </Text>
      ))}
    </Text>
  );
}

/* Profile-style labeled contact: "Email: …"  "Phone: …" */
export function LabeledContact({ personal }) {
  const styles = useStyles();
  const parts = [];
  if (isFilled(personal.email))
    parts.push({
      label: "Email",
      text: personal.email,
      href: `mailto:${personal.email}`,
    });
  if (isFilled(personal.phone))
    parts.push({ label: "Phone", text: personal.phone });
  if (isFilled(personal.location))
    parts.push({ label: "Location", text: personal.location });
  if (isFilled(personal.linkedin))
    parts.push({
      label: "LinkedIn",
      text: prettyUrl(personal.linkedin),
      href: normalizeUrl(personal.linkedin),
    });
  if (isFilled(personal.github))
    parts.push({
      label: "GitHub",
      text: prettyUrl(personal.github),
      href: normalizeUrl(personal.github),
    });
  if (isFilled(personal.website))
    parts.push({
      label: "Web",
      text: prettyUrl(personal.website),
      href: normalizeUrl(personal.website),
    });

  if (!parts.length) return null;

  return (
    <Text style={styles.contactLine}>
      {parts.map((p, i) => (
        <Text key={i}>
          {i > 0 ? <Text style={styles.sep}>{"   "}</Text> : null}
          <Text style={styles.contactLabel}>{p.label}: </Text>
          {p.href ? (
            <Link src={p.href} style={styles.link}>
              {p.text}
            </Link>
          ) : (
            <Text>{p.text}</Text>
          )}
        </Text>
      ))}
    </Text>
  );
}

export function renderCustomSection(sec, styles) {
  const fields = sec.fields || [];
  const items = (sec.items || [])
    .filter((it) => !it.disabled)
    .filter((it) => fields.some((f) => isFilled(it[f.id])));
  if (!isFilled(sec.title) && !items.length) return null;

  return (
    <>
      <SectionHeading title={sec.title || "Additional"} />
      {items.map((item, idx) => (
        <View key={idx} style={styles.entry} minPresenceAhead={40}>
          {renderEntryFields(fields, item, styles)}
        </View>
      ))}
    </>
  );
}

function renderEntryFields(fields, item, styles) {
  const out = [];
  let pending = null;

  const flush = () => {
    if (!pending) return;
    out.push(
      <View key={`row-${out.length}`} style={styles.fieldRow}>
        <Text style={pending.leftStyle}>{pending.left || ""}</Text>
        {pending.right != null && (
          <Text style={pending.rightStyle}>{pending.right}</Text>
        )}
      </View>
    );
    pending = null;
  };

  fields.forEach((f) => {
    const raw = item[f.id];
    if (!isFilled(raw)) return;
    const style = [styles.fieldText, emphasisStyle(f, styles)];

    if (f.type === "textarea") {
      flush();
      out.push(
        <Text key={`ta-${f.id}`} style={[styles.fieldPara, emphasisStyle(f, styles)]}>
          {fieldDisplay(f, raw)}
        </Text>
      );
    } else if (f.type === "bullets") {
      flush();
      let firstBullet = true;
      splitLines(raw).forEach((b, i) => {
        if (SUBHEADING_RE.test(b)) {
          out.push(
            <SubHeading key={`sh-${f.id}-${i}`}>
              {b.replace(SUBHEADING_RE, "")}
            </SubHeading>
          );
          return;
        }
        const text = b.replace(PASTED_MARKER_RE, "");
        out.push(
          <Bullet key={`b-${f.id}-${i}`}>
            {firstBullet ? fieldDisplay(f, text) : text}
          </Bullet>
        );
        firstBullet = false;
      });
    } else {
      const text = fieldDisplay(f, raw);
      if (f.align === "right") {
        if (!pending) pending = { left: "" };
        pending.right = text;
        pending.rightStyle = style;
        flush();
      } else {
        if (pending && pending.left) flush();
        pending = { ...(pending || {}), left: text, leftStyle: style };
      }
    }
  });
  flush();
  return out;
}

Bullet.propTypes = { children: PropTypes.node };
SubHeading.propTypes = { children: PropTypes.node };
BulletLines.propTypes = { lines: PropTypes.arrayOf(PropTypes.string).isRequired };
ParaLines.propTypes = { lines: PropTypes.arrayOf(PropTypes.string).isRequired };
SectionHeading.propTypes = { title: PropTypes.string.isRequired };
ContactLine.propTypes = {
  personal: personalShape.isRequired,
  order: PropTypes.arrayOf(PropTypes.string),
};
LabeledContact.propTypes = { personal: personalShape.isRequired };
