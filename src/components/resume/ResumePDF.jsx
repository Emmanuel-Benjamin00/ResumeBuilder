import PropTypes from "prop-types";
import { createContext, useContext } from "react";
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { normalizeOrder } from "./resumeOrder";
import { DEFAULT_SETTINGS, withSettingsDefaults } from "./resumeSettings";

// Disable hyphenation so long words wrap whole to the next line instead of
// being broken with a hyphen; justified text then spreads them evenly.
Font.registerHyphenationCallback((word) => [word]);

/* ── Resume stylesheet (Arial/Helvetica sans-serif) built from settings ──
 * Per-element font sizes derive from the base `fontSize` so a single slider
 * scales the whole document consistently. */
function makeStyles(s) {
  const base = s.fontSize;
  return StyleSheet.create({
    page: {
      padding: s.margin,
      fontFamily: "Helvetica",
      fontSize: base,
      color: "#000000",
      lineHeight: s.lineHeight,
    },

    /* Header */
    header: { marginBottom: 6 },
    name: {
      fontFamily: "Helvetica-Bold",
      fontSize: s.nameSize,
      textAlign: "center",
      letterSpacing: 1,
      lineHeight: 1.2,
      marginBottom: 6,
    },
    contactLine: {
      textAlign: "center",
      fontSize: base - 1,
      lineHeight: 1.4,
      color: "#000000",
    },
    link: { color: "#000000", textDecoration: "none" },
    sep: { color: "#000000" },

    /* Section heading with rule */
    section: { marginTop: s.sectionGap },
    sectionTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: base + 1,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    rule: {
      borderBottomWidth: 0.7,
      borderBottomColor: "#000000",
      marginTop: 3,
      marginBottom: 6,
    },

    summary: { fontSize: base, textAlign: "justify" },

    /* Entry (experience / education / project) */
    entry: { marginTop: s.entryGap },
    entryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    entryTitle: { fontFamily: "Helvetica-Bold", fontSize: base + 0.5 },
    entryRight: { fontSize: base },
    entrySubRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 2,
    },
    entrySubLeft: { fontFamily: "Helvetica-Oblique", fontSize: base },
    entrySubRight: { fontFamily: "Helvetica-Oblique", fontSize: base },

    /* Bullets */
    bulletRow: { flexDirection: "row", marginTop: 4, paddingLeft: 8 },
    bulletDot: { width: 10, fontSize: base },
    bulletText: { flex: 1, fontSize: base, textAlign: "justify" },

    /* Skills / one-line rows */
    skillRow: { marginTop: 4, flexDirection: "row" },
    skillLabel: { fontFamily: "Helvetica-Bold", fontSize: base },
    skillValue: { fontSize: base, flex: 1 },

    projectTitleRow: { flexDirection: "row" },
    projectTech: { fontFamily: "Helvetica-Oblique", fontSize: base },

    /* Custom-field rendering */
    fieldRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 2,
    },
    fieldText: { fontSize: base },
    fieldPara: { fontSize: base, textAlign: "justify", marginTop: 2 },
    fBold: { fontFamily: "Helvetica-Bold" },
    fItalic: { fontFamily: "Helvetica-Oblique" },
    fNormal: { fontFamily: "Helvetica" },
  });
}

/* Styles flow to the nested components (Bullet, SectionHeading, ContactLine)
 * through context, so the whole tree re-styles when the settings change. */
const StylesContext = createContext(makeStyles(DEFAULT_SETTINGS));
const useStyles = () => useContext(StylesContext);

const emphasisStyle = (f, styles) =>
  f.style === "bold"
    ? styles.fBold
    : f.style === "italic"
      ? styles.fItalic
      : styles.fNormal;

const fieldDisplay = (f, value) =>
  f.showLabel && isFilled(f.label) ? `${f.label}: ${value}` : value;

const isFilled = (v) => Boolean(v && String(v).trim().length > 0);

const personalShape = PropTypes.shape({
  name: PropTypes.string,
  location: PropTypes.string,
  phone: PropTypes.string,
  email: PropTypes.string,
  linkedin: PropTypes.string,
  github: PropTypes.string,
  website: PropTypes.string,
});

function Bullet({ children }) {
  const styles = useStyles();
  // wrap={false}: keep the dot and its text together — a bullet moves to the
  // next page as a unit instead of leaving an empty "•" at the page bottom.
  return (
    <View style={styles.bulletRow} wrap={false}>
      <Text style={styles.bulletDot}>{"•"}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function SectionHeading({ title }) {
  const styles = useStyles();
  // minPresenceAhead: if there isn't at least this much room below the heading
  // on the current page, push the whole heading to the next page instead of
  // stranding it above a blank gap (its first entry uses wrap={false}).
  return (
    <View style={styles.section} minPresenceAhead={72}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.rule} />
    </View>
  );
}

Bullet.propTypes = { children: PropTypes.node };
SectionHeading.propTypes = { title: PropTypes.string.isRequired };
ContactLine.propTypes = { personal: personalShape.isRequired };

/* Build a single flowing contact line from whatever fields are present.
 * Everything lives in one centered paragraph so items fill the width and
 * only wrap to a second line when they genuinely run out of room (instead
 * of forcing the links onto their own line while the first line has space).
 * Order: email → phone → location → linkedin → github → website. */
function ContactLine({ personal }) {
  const styles = useStyles();
  const items = [];
  if (isFilled(personal.email))
    items.push({ text: personal.email, href: `mailto:${personal.email}` });
  if (isFilled(personal.phone)) items.push({ text: personal.phone });
  if (isFilled(personal.location)) items.push({ text: personal.location });
  if (isFilled(personal.linkedin))
    items.push({
      text: prettyUrl(personal.linkedin),
      href: normalizeUrl(personal.linkedin),
    });
  if (isFilled(personal.github))
    items.push({
      text: prettyUrl(personal.github),
      href: normalizeUrl(personal.github),
    });
  if (isFilled(personal.website))
    items.push({
      text: prettyUrl(personal.website),
      href: normalizeUrl(personal.website),
    });

  if (!items.length) return null;

  return (
    <Text style={styles.contactLine}>
      {items.map((it, i) => (
        <Text key={i}>
          {i > 0 ? <Text style={styles.sep}>{"  |  "}</Text> : null}
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

function normalizeUrl(u) {
  const s = String(u).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:/i.test(s)) return s;
  return `https://${s}`;
}

// Clean text shown for a link: drop protocol, "www.", and trailing slash,
// so full pasted URLs still read tidily (e.g. "github.com/user").
function prettyUrl(u) {
  return String(u)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

function splitLines(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

ResumePDF.propTypes = {
  data: PropTypes.shape({
    personal: personalShape.isRequired,
    summary: PropTypes.string,
    summaries: PropTypes.arrayOf(
      PropTypes.shape({ id: PropTypes.string, text: PropTypes.string })
    ),
    selectedSummary: PropTypes.string,
    skills: PropTypes.array,
    experience: PropTypes.array,
    projects: PropTypes.array,
    education: PropTypes.array,
    certifications: PropTypes.array,
    customSections: PropTypes.array,
    disabledSections: PropTypes.array,
    settings: PropTypes.shape({
      pageSize: PropTypes.string,
      margin: PropTypes.number,
      fontSize: PropTypes.number,
      lineHeight: PropTypes.number,
      sectionGap: PropTypes.number,
      entryGap: PropTypes.number,
      nameSize: PropTypes.number,
    }),
  }).isRequired,
};

const enabled = (item) => !item || !item.disabled;

// Resolve the single summary to render: the selected variant from the new
// `summaries` list, falling back to the first, or the legacy `summary` string.
function resolveSummary(data) {
  if (Array.isArray(data.summaries)) {
    const sel =
      data.summaries.find((s) => s.id === data.selectedSummary) ||
      data.summaries[0];
    return sel ? sel.text : "";
  }
  return data.summary || "";
}

// Accept either a single resume or a multi-resume store (e.g. the admin view
// hands us the raw cloud document). When given a store, render the active one.
function activeResume(input) {
  if (input && Array.isArray(input.resumes)) {
    return (
      input.resumes.find((r) => r.id === input.activeId) ||
      input.resumes[0] ||
      {}
    );
  }
  return input || {};
}

export default function ResumePDF({ data: rawData }) {
  const data = activeResume(rawData);
  const {
    personal = {},
    skills: allSkills,
    experience: allExperience,
    projects: allProjects,
    education: allEducation,
    certifications: allCertifications,
    customSections = [],
    disabledSections = [],
  } = data;

  // Layout settings drive every spacing/font value; fall back to defaults so
  // resumes saved before this feature still render.
  const settings = withSettingsDefaults(data.settings);
  const styles = makeStyles(settings);

  const summary = resolveSummary(data);

  // Drop items the user has disabled before building any section.
  const skills = (allSkills || []).filter(enabled);
  const experience = (allExperience || []).filter(enabled);
  const projects = (allProjects || []).filter(enabled);
  const education = (allEducation || []).filter(enabled);
  const certifications = (allCertifications || []).filter(enabled);

  // Build each section as a keyed node; render null when empty so ordering
  // never leaves blank headings behind.
  const nodes = {
    summary: isFilled(summary) ? (
      <View>
        <SectionHeading title="Professional Summary" />
        <Text style={styles.summary}>{summary}</Text>
      </View>
    ) : null,

    skills: skills.some((s) => isFilled(s.value)) ? (
      <View>
        <SectionHeading title="Technical Skills" />
        {skills
          .filter((s) => isFilled(s.value))
          .map((s, i) =>
            isFilled(s.label) ? (
              <View key={i} style={styles.skillRow}>
                <Text style={styles.skillValue}>
                  <Text style={styles.skillLabel}>{s.label}: </Text>
                  {s.value}
                </Text>
              </View>
            ) : (
              <Bullet key={i}>{s.value}</Bullet>
            )
          )}
      </View>
    ) : null,

    experience: experience.some(
      (e) => isFilled(e.company) || isFilled(e.role) || splitLines(e.bullets).length
    ) ? (
      <View>
        <SectionHeading title="Experience" />
        {experience.map((e, i) => {
          const bullets = splitLines(e.bullets);
          if (!isFilled(e.company) && !isFilled(e.role) && !bullets.length)
            return null;
          return (
            <View key={i} style={styles.entry}>
              {/* Header stays together and won't orphan at a page bottom; the
                  bullets below are free to flow onto the next page. */}
              <View wrap={false} minPresenceAhead={40}>
                <View style={styles.entryRow}>
                  <Text style={styles.entryTitle}>{e.company}</Text>
                  <Text style={styles.entryRight}>{e.dates}</Text>
                </View>
                <View style={styles.entrySubRow}>
                  <Text style={styles.entrySubLeft}>{e.role}</Text>
                  <Text style={styles.entrySubRight}>{e.location}</Text>
                </View>
              </View>
              {bullets.map((b, j) => (
                <Bullet key={j}>{b}</Bullet>
              ))}
            </View>
          );
        })}
      </View>
    ) : null,

    projects: projects.some(
      (p) => isFilled(p.name) || splitLines(p.bullets).length
    ) ? (
      <View>
        <SectionHeading title="Projects" />
        {projects.map((p, i) => {
          const bullets = splitLines(p.bullets);
          if (!isFilled(p.name) && !bullets.length) return null;
          return (
            <View key={i} style={styles.entry}>
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.projectTitleRow}>
                  <Text style={styles.entryTitle}>{p.name}</Text>
                  {isFilled(p.tech) && (
                    <Text style={styles.projectTech}>{"  |  " + p.tech}</Text>
                  )}
                </Text>
              </View>
              {bullets.map((b, j) => (
                <Bullet key={j}>{b}</Bullet>
              ))}
            </View>
          );
        })}
      </View>
    ) : null,

    education: education.some(
      (e) => isFilled(e.school) || isFilled(e.degree)
    ) ? (
      <View>
        <SectionHeading title="Education" />
        {education.map((e, i) => {
          if (!isFilled(e.school) && !isFilled(e.degree)) return null;
          return (
            <View key={i} style={styles.entry} wrap={false}>
              <View style={styles.entryRow}>
                <Text style={styles.entryTitle}>{e.school}</Text>
                <Text style={styles.entryRight}>{e.location}</Text>
              </View>
              <View style={styles.entrySubRow}>
                <Text style={styles.entrySubLeft}>{e.degree}</Text>
                <Text style={styles.entrySubRight}>{e.dates}</Text>
              </View>
            </View>
          );
        })}
      </View>
    ) : null,

    certifications: certifications.filter((c) => isFilled(c.text)).length > 0 ? (
      <View>
        <SectionHeading title="Certifications & Training" />
        {certifications
          .filter((c) => isFilled(c.text))
          .map((c, i) => (
            <View key={i} style={styles.skillRow}>
              <Text style={styles.skillValue}>{c.text}</Text>
            </View>
          ))}
      </View>
    ) : null,
  };

  // Custom sections keyed by their id.
  for (const sec of customSections) {
    if (!sec || !sec.id) continue;
    nodes[sec.id] = renderCustomSection(sec, styles);
  }

  const order = normalizeOrder(data);
  const hidden = new Set(disabledSections);

  return (
    <StylesContext.Provider value={styles}>
      <Document title={personal.name || "Resume"} author={personal.name || ""}>
        <Page size={settings.pageSize} style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.name}>{personal.name || "Your Name"}</Text>
            <ContactLine personal={personal} />
          </View>

          {order.map((key) =>
            !hidden.has(key) && nodes[key] ? (
              <View key={key}>{nodes[key]}</View>
            ) : null
          )}
        </Page>
      </Document>
    </StylesContext.Provider>
  );
}

/* Render one fully-custom section from its field schema.
 * Left/right single-line text fields pair up into a justified row (like the
 * classic "Company … Dates" line); paragraphs and bullet lists span full width. */
function renderCustomSection(sec, styles) {
  const fields = sec.fields || [];
  const items = (sec.items || [])
    .filter((it) => !it.disabled)
    .filter((it) => fields.some((f) => isFilled(it[f.id])));
  if (!isFilled(sec.title) && !items.length) return null;

  return (
    <View>
      <SectionHeading title={sec.title || "Additional"} />
      {items.map((item, idx) => (
        <View key={idx} style={styles.entry} minPresenceAhead={40}>
          {renderEntryFields(fields, item, styles)}
        </View>
      ))}
    </View>
  );
}

function renderEntryFields(fields, item, styles) {
  const out = [];
  let pending = null; // holds a left text awaiting an optional right partner

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
      splitLines(raw).forEach((b, i) =>
        out.push(
          <Bullet key={`b-${f.id}-${i}`}>
            {i === 0 ? fieldDisplay(f, b) : b}
          </Bullet>
        )
      );
    } else {
      // single-line text: pair left + right into one justified row
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
