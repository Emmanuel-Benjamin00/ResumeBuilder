// ─────────────────────────────────────────────────────────────────────
// Template router. Every resume stores a `templateId`; this picks the
// matching layout component and hands it the resume it should render.
// The layouts themselves live in ClassicTemplate / ProfileTemplate /
// ExecutiveTemplate — each returns its own complete <Document>.
// ─────────────────────────────────────────────────────────────────────
import PropTypes from "prop-types";
import { activeResume } from "./pdfShared";
import { resolveTemplateId } from "./templates";
import ClassicTemplate from "./ClassicTemplate";
import ProfileTemplate from "./ProfileTemplate";
import ExecutiveTemplate from "./ExecutiveTemplate";

const LAYOUTS = {
  classic: ClassicTemplate,
  profile: ProfileTemplate,
  executive: ExecutiveTemplate,
};

export default function ResumePDF({ data: rawData }) {
  // Accept either a single resume or a multi-resume store (the admin view
  // hands us the raw cloud document); render the active one either way.
  const data = activeResume(rawData);
  const Layout = LAYOUTS[resolveTemplateId(data.templateId)];
  return <Layout data={data} />;
}

ResumePDF.propTypes = {
  data: PropTypes.object.isRequired,
};
