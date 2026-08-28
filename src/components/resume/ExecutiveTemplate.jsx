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
  prettyUrl,
  normalizeUrl,
} from "./pdfShared";

Font.registerHyphenationCallback((word) => [word]);

/* Exact visual match for the Abdul PDF:
 * uppercase name + title, location | email | phone,
 * light-gray pill section bars (bold italic caps),
 * bold category skills, "Company - Role" + bold dates,
 * italic location, hanging bullets; Links as labeled bullets. */
const C = {
  text: "#181818",
  muted: "#4a4a4a",
  bar: "#d8d8d8",
  link: "#1a0dab",
};

function makeStyles(s) {
  const base = s.fontSize;
  return StyleSheet.create({
    page: {
      paddingTop: s.margin + 4,
      paddingBottom: s.margin + 4,
      paddingLeft: s.margin + 8,
      paddingRight: s.margin + 8,
      fontFamily: "Helvetica",
      fontSize: base,
      color: C.text,
      lineHeight: s.lineHeight,
    },
    header: { marginBottom: 14 },
    name: {
      fontFamily: "Helvetica-Bold",
      fontSize: s.nameSize + 2,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      lineHeight: 1.1,
      marginBottom: 4,
      color: C.text,
    },
    jobTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: base + 1.5,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 6,
      color: C.text,
    },
    contactLine: {
      fontSize: base - 0.5,
      color: C.muted,
      marginBottom: 4,
    },
    sep: { color: C.muted },
    linkInline: { color: C.text, textDecoration: "none" },
    section: { marginTop: s.sectionGap + 2 },
    sectionBar: {
      backgroundColor: C.bar,
      borderRadius: 14,
      paddingTop: 4,
      paddingBottom: 4,
      paddingLeft: 14,
      paddingRight: 14,
      marginBottom: 8,
    },
    sectionTitle: {
      fontFamily: "Helvetica-BoldOblique",
      fontSize: base,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: C.text,
    },
    summary: {
      fontSize: base,
      textAlign: "left",
      color: C.text,
      lineHeight: s.lineHeight,
    },
    skillRow: { marginTop: 3 },
    skillLabel: { fontFamily: "Helvetica-Bold", fontSize: base },
    skillValue: { fontSize: base },
    entry: { marginTop: s.entryGap + 2 },
    entryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    entryTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: base + 0.5,
      flex: 1,
      paddingRight: 10,
      color: C.text,
    },
    entryDates: {
      fontFamily: "Helvetica-Bold",
      fontSize: base,
      color: C.text,
    },
    entryLoc: {
      fontFamily: "Helvetica-Oblique",
      fontSize: base,
      color: C.muted,
      marginTop: 2,
      marginBottom: 3,
    },
    bulletRow: {
      flexDirection: "row",
      marginTop: 4,
      paddingLeft: 6,
    },
    bulletDot: { width: 12, fontSize: base, color: C.text },
    bulletText: {
      flex: 1,
      fontSize: base,
      textAlign: "justify",
      color: C.text,
    },
    subHeading: {
      fontFamily: "Helvetica-Bold",
      fontSize: base - 0.5,
      color: C.text,
      paddingLeft: 6,
      marginTop: 6,
      marginBottom: 1,
    },
    eduTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: base + 0.5,
      flex: 1,
      paddingRight: 10,
    },
    eduSchool: {
      fontSize: base,
      textDecoration: "underline",
      marginTop: 2,
      color: C.text,
    },
    certBulletRow: {
      flexDirection: "row",
      marginTop: 5,
      paddingLeft: 6,
    },
    certPrimary: { flex: 1, fontSize: base },
    certBold: { fontFamily: "Helvetica-Bold", fontSize: base },
    certMeta: { fontSize: base - 0.5, marginTop: 1, paddingLeft: 18, color: C.muted },
    linkBulletRow: {
      flexDirection: "row",
      marginTop: 4,
      paddingLeft: 6,
    },
    linkLabel: { fontFamily: "Helvetica-Bold", fontSize: base },
    linkUrl: { color: C.link, textDecoration: "underline", fontSize: base },
    projectTech: { fontFamily: "Helvetica-Oblique", fontSize: base },
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

function PillHeading({ title }) {
  const styles = useStyles();
  return (
    <View style={styles.section} minPresenceAhead={72}>
      <View style={styles.sectionBar}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    </View>
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

function BulletLines({ lines }) {
  const styles = useStyles();
  return lines.map((line, i) =>
    SUBHEADING_RE.test(line) ? (
      <Text key={i} style={styles.subHeading} minPresenceAhead={36}>
        {line.replace(SUBHEADING_RE, "")}
      </Text>
    ) : (
      <Bullet key={i}>{line.replace(PASTED_MARKER_RE, "")}</Bullet>
    )
  );
}

function HeaderContact({ personal }) {
  const styles = useStyles();
  const items = [];
  if (isFilled(personal.location)) items.push({ text: personal.location });
  if (isFilled(personal.email))
    items.push({ text: personal.email, href: `mailto:${personal.email}` });
  if (isFilled(personal.phone)) items.push({ text: personal.phone });
  if (!items.length) return null;
  return (
    <Text style={styles.contactLine}>
      {items.map((it, i) => (
        <Text key={i}>
          {i > 0 ? <Text style={styles.sep}>{" | "}</Text> : null}
          {it.href ? (
            <Link src={it.href} style={styles.linkInline}>
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

function LinksSection({ personal }) {
  const styles = useStyles();
  const links = [];
  if (isFilled(personal.linkedin))
    links.push({
      label: "LinkedIn",
      text: prettyUrl(personal.linkedin),
      href: normalizeUrl(personal.linkedin),
    });
  if (isFilled(personal.github))
    links.push({
      label: "GitHub",
      text: prettyUrl(personal.github),
      href: normalizeUrl(personal.github),
    });
  if (isFilled(personal.website))
    links.push({
      label: "Portfolio",
      text: prettyUrl(personal.website),
      href: normalizeUrl(personal.website),
    });
  if (!links.length) return null;
  return (
    <>
      <PillHeading title="Links" />
      {links.map((l, i) => (
        <View key={i} style={styles.linkBulletRow} wrap={false}>
          <Text style={styles.bulletDot}>{"•"}</Text>
          <Text style={styles.certPrimary}>
            <Text style={styles.linkLabel}>{l.label}: </Text>
            <Link src={l.href} style={styles.linkUrl}>
              {l.text}
            </Link>
          </Text>
        </View>
      ))}
    </>
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
      <PillHeading title={(sec.title || "Additional").toUpperCase()} />
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

export default function ExecutiveTemplate({ data }) {
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

  const hasLinks =
    isFilled(personal.linkedin) ||
    isFilled(personal.github) ||
    isFilled(personal.website);

  const nodes = {
    summary: isFilled(summary) ? (
      <>
        <PillHeading title="Summary" />
        <Text style={styles.summary}>{summary}</Text>
      </>
    ) : null,

    skills: skills.some((s) => isFilled(s.value)) ? (
      <>
        <PillHeading title="Technical Skills" />
        {skills
          .filter((s) => isFilled(s.value))
          .map((s, i) =>
            isFilled(s.label) ? (
              <Text key={i} style={styles.skillRow}>
                <Text style={styles.skillLabel}>{s.label}: </Text>
                <Text style={styles.skillValue}>{s.value}</Text>
              </Text>
            ) : (
              <Bullet key={i}>{s.value}</Bullet>
            )
          )}
      </>
    ) : null,

    experience: experience.some(
      (e) => isFilled(e.company) || isFilled(e.role) || splitLines(e.bullets).length
    ) ? (
      <>
        <PillHeading title="Professional Experience" />
        {experience.map((e, i) => {
          const bullets = splitLines(e.bullets);
          if (!isFilled(e.company) && !isFilled(e.role) && !bullets.length)
            return null;
          const headline = [e.company, e.role].filter(isFilled).join(" - ");
          return (
            <View key={i} style={styles.entry}>
              <View wrap={false} minPresenceAhead={48}>
                <View style={styles.entryRow}>
                  <Text style={styles.entryTitle}>{headline}</Text>
                  {isFilled(e.dates) ? (
                    <Text style={styles.entryDates}>{e.dates}</Text>
                  ) : null}
                </View>
                {isFilled(e.location) ? (
                  <Text style={styles.entryLoc}>{e.location}</Text>
                ) : null}
              </View>
              <BulletLines lines={bullets} />
            </View>
          );
        })}
      </>
    ) : null,

    projects: projects.some(
      (p) => isFilled(p.name) || splitLines(p.bullets).length
    ) ? (
      <>
        <PillHeading title="Projects" />
        {projects.map((p, i) => {
          const bullets = splitLines(p.bullets);
          if (!isFilled(p.name) && !bullets.length) return null;
          return (
            <View key={i} style={styles.entry}>
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.entryTitle}>
                  {p.name}
                  {isFilled(p.tech) ? (
                    <Text style={styles.projectTech}>{`  |  ${p.tech}`}</Text>
                  ) : null}
                </Text>
              </View>
              <BulletLines lines={bullets} />
            </View>
          );
        })}
      </>
    ) : null,

    education: education.some(
      (e) => isFilled(e.school) || isFilled(e.degree)
    ) ? (
      <>
        <PillHeading title="Education" />
        {education.map((e, i) => {
          if (!isFilled(e.school) && !isFilled(e.degree)) return null;
          return (
            <View key={i} style={styles.entry} wrap={false}>
              <View style={styles.entryRow}>
                <Text style={styles.eduTitle}>{e.degree || e.school}</Text>
                {isFilled(e.dates) ? (
                  <Text style={styles.entryDates}>{e.dates}</Text>
                ) : null}
              </View>
              {isFilled(e.school) && isFilled(e.degree) ? (
                <Text style={styles.eduSchool}>{e.school}</Text>
              ) : null}
              {isFilled(e.location) ? (
                <Text style={styles.entryLoc}>{e.location}</Text>
              ) : null}
            </View>
          );
        })}
      </>
    ) : null,

    certifications: certifications.filter((c) => isFilled(c.text)).length > 0 ? (
      <>
        <PillHeading title="Certifications" />
        {certifications
          .filter((c) => isFilled(c.text))
          .map((c, i) => (
            <View key={i}>
              <View style={styles.certBulletRow} wrap={false}>
                <Text style={styles.bulletDot}>{"•"}</Text>
                <Text style={styles.certPrimary}>
                  <Text style={styles.certBold}>{c.text}</Text>
                  {isFilled(c.date) ? `  |  ${c.date}` : ""}
                </Text>
              </View>
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
            <Text style={styles.name}>
              {(personal.name || "Your Name").toUpperCase()}
            </Text>
            {isFilled(personal.title) ? (
              <Text style={styles.jobTitle}>
                {String(personal.title).toUpperCase()}
              </Text>
            ) : null}
            <HeaderContact personal={personal} />
          </View>

          {order.map((key) =>
            !hidden.has(key) && nodes[key] ? (
              <Fragment key={key}>{nodes[key]}</Fragment>
            ) : null
          )}

          {hasLinks ? <LinksSection personal={personal} /> : null}
        </Page>
      </Document>
    </StylesContext.Provider>
  );
}
