import PropTypes from "prop-types";
import { Font } from "@react-pdf/renderer";
import { resolveTemplateId } from "./templates";
import { activeResume } from "./pdfShared";
import ClassicTemplate from "./ClassicTemplate";
import ProfileTemplate from "./ProfileTemplate";
import ExecutiveTemplate from "./ExecutiveTemplate";

// Disable hyphenation so long words wrap whole to the next line instead of
// being broken with a hyphen; justified text then spreads them evenly.
Font.registerHyphenationCallback((word) => [word]);

const TEMPLATE_COMPONENTS = {
  classic: ClassicTemplate,
  profile: ProfileTemplate,
  executive: ExecutiveTemplate,
};

export default function ResumePDF({ data: rawData }) {
  const data = activeResume(rawData);
  const templateId = resolveTemplateId(data.templateId);
  const Template = TEMPLATE_COMPONENTS[templateId] || ClassicTemplate;
  return <Template data={data} />;
}

ResumePDF.propTypes = {
  data: PropTypes.object.isRequired,
};
