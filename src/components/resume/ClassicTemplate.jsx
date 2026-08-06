import { Fragment } from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { normalizeOrder } from "./resumeOrder";
import { withSettingsDefaults } from "./resumeSettings";
import {
  StylesContext,
  isFilled,
  enabled,
  resolveSummary,
  splitLines,
  Bullet,
  BulletLines,
  SectionHeading,
  ContactLine,
  renderCustomSection,
} from "./pdfShared";

Font.registerHyphenationCallback((word) => [word]);

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
    header: { marginBottom: 6 },
    name: {
      fontFamily: "Helvetica-Bold",
      fontSize: s.nameSize,
      textAlign: "center",
      letterSpacing: 1,
      lineHeight: 1.2,
      marginBottom: 4,
    },
    jobTitle: {
      fontFamily: "Helvetica",
      fontSize: base + 1,
      textAlign: "center",
      marginBottom: 6,
      color: "#222222",
    },
    contactLine: {
      textAlign: "center",
      fontSize: base - 1,
      lineHeight: 1.4,
      color: "#000000",
    },
    link: { color: "#000000", textDecoration: "none" },
    sep: { color: "#000000" },
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
    entry: { marginTop: s.entryGap },
    entryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    entryTitle: { fontFamily: "Helvetica-Bold", fontSize: base + 1.5 },
    entryRight: { fontSize: base },
    entrySubRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 2,
    },
    entrySubLeft: { fontFamily: "Helvetica-Oblique", fontSize: base },
    entrySubRight: { fontFamily: "Helvetica-Oblique", fontSize: base },
    bulletRow: { flexDirection: "row", marginTop: 4, paddingLeft: 8 },
    bulletDot: { width: 10, fontSize: base },
    bulletText: { flex: 1, fontSize: base, textAlign: "justify" },
    subHeading: {
      fontFamily: "Helvetica-Bold",
      fontSize: base - 0.5,
      color: "#3a3a3a",
      paddingLeft: 8,
      marginTop: 7,
      marginBottom: 1,
    },
    skillRow: { marginTop: 4, flexDirection: "row" },
    certRow: {
      marginTop: 4,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    certText: { fontFamily: "Helvetica-Bold", fontSize: base, flex: 1 },
    skillLabel: { fontFamily: "Helvetica-Bold", fontSize: base },
    skillValue: { fontSize: base, flex: 1 },
    projectTitleRow: { flexDirection: "row" },
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

export default function ClassicTemplate({ data }) {
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
        <SectionHeading title="Professional Summary" />
        <Text style={styles.summary}>{summary}</Text>
      </>
    ) : null,

    skills: skills.some((s) => isFilled(s.value)) ? (
      <>
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
      </>
    ) : null,

    experience: experience.some(
      (e) => isFilled(e.company) || isFilled(e.role) || splitLines(e.bullets).length
    ) ? (
      <>
        <SectionHeading title="Experience" />
        {experience.map((e, i) => {
          const bullets = splitLines(e.bullets);
          if (!isFilled(e.company) && !isFilled(e.role) && !bullets.length)
            return null;
          return (
            <View key={i} style={styles.entry}>
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
      </>
    ) : null,

    certifications: certifications.filter((c) => isFilled(c.text)).length > 0 ? (
      <>
        <SectionHeading title="Certifications & Training" />
        {certifications
          .filter((c) => isFilled(c.text))
          .map((c, i) => (
            <View key={i} style={styles.certRow}>
              <Text style={styles.certText}>{c.text}</Text>
              {isFilled(c.date) && (
                <Text style={styles.entryRight}>{c.date}</Text>
              )}
            </View>
          ))}
      </>
    ) : null,
  };

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
          <View style={styles.header}>
            <Text style={styles.name}>{personal.name || "Your Name"}</Text>
            {isFilled(personal.title) ? (
              <Text style={styles.jobTitle}>{personal.title}</Text>
            ) : null}
            <ContactLine personal={personal} />
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
