import { notFound } from "next/navigation";

import { getAssignmentTypeBySlug } from "@/features/assessment/assessment-flow";
import { AssessmentWizard } from "@/features/assessment/assessment-wizard";

export default async function AssignmentSetupPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!getAssignmentTypeBySlug(type)) notFound();

  return <AssessmentWizard screen="setup" typeSlug={type} />;
}
