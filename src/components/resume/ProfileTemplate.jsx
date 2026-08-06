import { Fragment } from "react";
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
import { withSettingsDefaults } from "./resumeSettings";
import {
  StylesContext,
  useStyles,
  isFilled,
  enabled,
  resolveSummary,
  splitLines,
  SUBHEADING_RE,
  PASTED_MARKER_RE,
  emphasisStyle,
  fieldDisplay,
  normalizeUrl,
  prettyUrl,
} from "./pdfShared";

Font.registerHyphenationCallback((word) => [word]);

/* Exact visual match for the Vignesh PDF:
 * teal name, grey title, labeled Email/Phone, hairline rule,
 * blue section titles, light-blue rounded Skills box with bullets,
 * role + dates row, italic company, paragraph project blurbs. */
const C = {
  name: "#075985",
  heading: "#3b82a8",
  body: "#304050",
  muted: "#6b7280",
  rule: "#e5e7eb",
  skillsBg: "#f0f9ff",
  link: "#075985",
};

function makeStyles(s) {
  const base = s.fontSize;
  return StyleSheet.create({
    page: {
      paddingTop: s.margin,
      paddingBottom: s.margin,
      paddingLeft: s.margin + 4,
      paddingRight: s.margin + 4,
      fontFamily: "Helvetica",
      fontSize: base,
      color: C.body,
      lineHeight: s.lineHeight,
    },
    header: { marginBottom: 10 },
    name: {
      fontFamily: "Helvetica-Bold",
      fontSize: s.nameSize,
      color: C.name,
      lineHeight: 1.15,
      marginBottom: 4,
    },
    jobTitle: {
      fontFamily: "Helvetica",
      fontSize: base + 2,
      color: C.muted,
      marginBottom: 8,
    },
    contactLine: {
      fontSize: base - 0.5,
      color: C.body,
      marginBottom: 10,
    },
    contactLabel: {
      fontFamily: "Helvetica",
      fontSize: base - 0.5,
      color: C.muted,
    },
    link: { color: C.link, textDecoration: "underline" },
    headerRule: {
      borderBottomWidth: 1,
      borderBottomColor: C.rule,
      marginBottom: 12,
    },
    section: { marginTop: s.sectionGap },
    sectionTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: base + 1,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      color: C.heading,
      marginBottom: 6,
    },
    summary: {
      fontSize: base,
      textAlign: "justify",
      color: C.body,
      lineHeight: s.lineHeight,
    },
    skillsBox: {
      backgroundColor: C.skillsBg,
      borderRadius: 8,
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 14,
      paddingRight: 14,
      marginTop: s.sectionGap,
    },
    skillsTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: base + 1,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      color: C.heading,
      marginBottom: 6,
    },
    skillBulletRow: {
      flexDirection: "row",
      marginTop: 3,
      paddingLeft: 2,
    },
    skillDot: { width: 12, fontSize: base, color: C.body },
    skillText: { flex: 1, fontSize: base, color: C.body },
    skillLabel: { fontFamily: "Helvetica-Bold", fontSize: base },
    entry: { marginTop: s.entryGap + 2 },
    entryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    entryRole: {
      fontFamily: "Helvetica-Bold",
      fontSize: base + 0.5,
      color: C.body,
      flex: 1,
      paddingRight: 10,
    },
    entryDates: {
      fontSize: base,
      color: C.muted,
    },
    entryCompany: {
      fontFamily: "Helvetica-Oblique",
      fontSize: base,
      color: C.muted,
      marginTop: 2,
      marginBottom: 4,
    },
    paraLine: {
      fontSize: base,
      textAlign: "justify",
      color: C.body,
      marginTop: 4,
      lineHeight: s.lineHeight,
    },
    subHeading: {
      fontFamily: "Helvetica-Bold",
      fontSize: base - 0.5,
      color: C.body,
      marginTop: 6,
      marginBottom: 1,
    },
    eduDegree: {
      fontFamily: "Helvetica-Bold",
      fontSize: base + 0.5,
      color: C.body,
    },
    eduDegreeItalic: {
      fontFamily: "Helvetica-Oblique",
      fontSize: base + 0.5,
      color: C.body,
    },
    eduMeta: {
      fontSize: base,
      color: C.muted,
      marginTop: 2,
    },
    certRow: {
      marginTop: 4,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    certText: { fontFamily: "Helvetica-Bold", fontSize: base, flex: 1 },
    projectTitle: { fontFamily: "Helvetica-Bold", fontSize: base + 0.5 },
    projectTech: { fontFamily: "Helvetica-Oblique", fontSize: base, color: C.muted },
    bulletRow: { flexDirection: "row", marginTop: 3, paddingLeft: 2 },
    bulletDot: { width: 12, fontSize: base },
    bulletText: { flex: 1, fontSize: base, textAlign: "justify" },
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

function ProfileHeading({ title }) {
  const styles = useStyles();
  return (
    <View style={styles.section} minPresenceAhead={72}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function ProfileContact({ personal }) {
  const styles = useStyles();
  const bits = [];
  if (isFilled(personal.email)) {
    bits.push(
      <Text key="email">
        <Text style={styles.contactLabel}>Email: </Text>
        <Link src={`mailto:${personal.email}`} style={styles.link}>
          {personal.email}
        </Link>
      </Text>
    );
  }
  if (isFilled(personal.phone)) {
    bits.push(
      <Text key="phone">
        <Text style={styles.contactLabel}>Phone: </Text>
        <Text>{personal.phone}</Text>
      </Text>
    );
  }
  // Extra links if present (keep labeled style)
  if (isFilled(personal.linkedin)) {
    bits.push(
      <Text key="li">
        <Text style={styles.contactLabel}>LinkedIn: </Text>
        <Link src={normalizeUrl(personal.linkedin)} style={styles.link}>
          {prettyUrl(personal.linkedin)}
        </Link>
      </Text>
    );
  }
  if (isFilled(personal.github)) {
    bits.push(
      <Text key="gh">
        <Text style={styles.contactLabel}>GitHub: </Text>
        <Link src={normalizeUrl(personal.github)} style={styles.link}>
          {prettyUrl(personal.github)}
        </Link>
      </Text>
    );
  }
  if (!bits.length) return null;
  return (
    <Text style={styles.contactLine}>
      {bits.map((b, i) => (
        <Text key={i}>
          {i > 0 ? "      " : ""}
          {b}
        </Text>
      ))}
    </Text>
  );
}

function ParaLines({ lines }) {
  const styles = useStyles();
  return lines.map((line, i) =>
    SUBHEADING_RE.test(line) ? (
      <Text key={i} style={styles.subHeading}>
        {line.replace(SUBHEADING_RE, "")}
      </Text>
    ) : (
      <Text key={i} style={styles.paraLine}>
        {line.replace(PASTED_MARKER_RE, "")}
      </Text>
    )
  );
}

function Bullet({ children }) {
  const styles = useStyles();
  return (
    <View style={styles.bulletRow} wrap={false}>
      <Text style={styles.bulletDot}>{"•"}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function renderCustom(sec, styles) {
  const fields = sec.fields || [];
  const items = (sec.items || [])
    .filter((it) => !it.disabled)
    .filter((it) => fields.some((f) => isFilled(it[f.id])));
  if (!isFilled(sec.title) && !items.length) return null;

  return (
    <>
      <ProfileHeading title={(sec.title || "Additional").toUpperCase()} />
      {items.map((item, idx) => (
        <View key={idx} style={styles.entry} minPresenceAhead={40}>
          {renderFields(fields, item, styles)}
        </View>
      ))}
    </>
  );
}

function renderFields(fields, item, styles) {
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
      splitLines(raw).forEach((b, i) => {
        if (SUBHEADING_RE.test(b)) {
          out.push(
            <Text key={`sh-${f.id}-${i}`} style={styles.subHeading}>
              {b.replace(SUBHEADING_RE, "")}
            </Text>
          );
          return;
        }
        out.push(
          <Bullet key={`b-${f.id}-${i}`}>{b.replace(PASTED_MARKER_RE, "")}</Bullet>
        );
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

export default function ProfileTemplate({ data }) {
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

  const settings = withSettingsDefaults(data.settings);
  const styles = makeStyles(settings);
  const summary = resolveSummary(data);

  const skills = (allSkills || []).filter(enabled);
  const experience = (allExperience || []).filter(enabled);
  const projects = (allProjects || []).filter(enabled);
  const education = (allEducation || []).filter(enabled);
  const certifications = (allCertifications || []).filter(enabled);

  const nodes = {
    summary: isFilled(summary) ? (
      <>
        <ProfileHeading title="Profile" />
        <Text style={styles.summary}>{summary}</Text>
      </>
    ) : null,

    skills: skills.some((s) => isFilled(s.value)) ? (
      <View style={styles.skillsBox}>
        <Text style={styles.skillsTitle}>Skills</Text>
        {skills
          .filter((s) => isFilled(s.value))
          .map((s, i) => (
            <View key={i} style={styles.skillBulletRow} wrap={false}>
              <Text style={styles.skillDot}>{"•"}</Text>
              <Text style={styles.skillText}>
                {isFilled(s.label) ? (
                  <>
                    <Text style={styles.skillLabel}>{s.label}: </Text>
                    {s.value}
                  </>
                ) : (
                  s.value
                )}
              </Text>
            </View>
          ))}
      </View>
    ) : null,

    experience: experience.some(
      (e) => isFilled(e.company) || isFilled(e.role) || splitLines(e.bullets).length
    ) ? (
      <>
        <ProfileHeading title="Experience" />
        {experience.map((e, i) => {
          const lines = splitLines(e.bullets);
          if (!isFilled(e.company) && !isFilled(e.role) && !lines.length)
            return null;
          return (
            <View key={i} style={styles.entry}>
              <View wrap={false} minPresenceAhead={48}>
                <View style={styles.entryRow}>
                  <Text style={styles.entryRole}>{e.role || e.company}</Text>
                  {isFilled(e.dates) ? (
                    <Text style={styles.entryDates}>{e.dates}</Text>
                  ) : null}
                </View>
                {isFilled(e.company) && isFilled(e.role) ? (
                  <Text style={styles.entryCompany}>{e.company}</Text>
                ) : null}
              </View>
              <ParaLines lines={lines} />
            </View>
          );
        })}
      </>
    ) : null,

    projects: projects.some(
      (p) => isFilled(p.name) || splitLines(p.bullets).length
    ) ? (
      <>
        <ProfileHeading title="Projects" />
        {projects.map((p, i) => {
          const lines = splitLines(p.bullets);
          if (!isFilled(p.name) && !lines.length) return null;
          return (
            <View key={i} style={styles.entry}>
              <View wrap={false} minPresenceAhead={40}>
                <Text>
                  <Text style={styles.projectTitle}>{p.name}</Text>
                  {isFilled(p.tech) ? (
                    <Text style={styles.projectTech}>{`  —  ${p.tech}`}</Text>
                  ) : null}
                </Text>
              </View>
              <ParaLines lines={lines} />
            </View>
          );
        })}
      </>
    ) : null,

    education: education.some(
      (e) => isFilled(e.school) || isFilled(e.degree)
    ) ? (
      <>
        <ProfileHeading title="Education" />
        {education.map((e, i) => {
          if (!isFilled(e.school) && !isFilled(e.degree)) return null;
          return (
            <View key={i} style={styles.entry} wrap={false}>
              {isFilled(e.degree) ? (
                <Text style={styles.eduDegree}>{e.degree}</Text>
              ) : null}
              {isFilled(e.school) || isFilled(e.location) ? (
                <Text style={styles.eduMeta}>
                  {[e.school, e.location].filter(isFilled).join(", ")}
                </Text>
              ) : null}
              {isFilled(e.dates) ? (
                <Text style={styles.eduMeta}>{e.dates}</Text>
              ) : null}
            </View>
          );
        })}
      </>
    ) : null,

    certifications: certifications.filter((c) => isFilled(c.text)).length > 0 ? (
      <>
        <ProfileHeading title="Certifications" />
        {certifications
          .filter((c) => isFilled(c.text))
          .map((c, i) => (
            <View key={i} style={styles.certRow}>
              <Text style={styles.certText}>{c.text}</Text>
              {isFilled(c.date) ? (
                <Text style={styles.entryDates}>{c.date}</Text>
              ) : null}
            </View>
          ))}
      </>
    ) : null,
  };

  for (const sec of customSections) {
    if (!sec || !sec.id) continue;
    nodes[sec.id] = renderCustom(sec, styles);
  }

  const order = normalizeOrder(data);
  const hidden = new Set(disabledSections);

  return (
    <StylesContext.Provider value={styles}>
      <Document title={personal.name || "Resume"} author={personal.name || ""}>
        <Page size={settings.pageSize} style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.name}>{personal.name || "Your Name"}</Text>
            {isFilled(personal.title) ? (
              <Text style={styles.jobTitle}>{personal.title}</Text>
            ) : null}
            <ProfileContact personal={personal} />
            <View style={styles.headerRule} />
          </View>

          {order.map((key) =>
            !hidden.has(key) && nodes[key] ? (
              <Fragment key={key}>{nodes[key]}</Fragment>
            ) : null
          )}
        </Page>
      </Document>
    </StylesContext.Provider>
  );
}
