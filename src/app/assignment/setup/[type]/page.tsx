import { notFound } from "next/navigation";

import { getAssignmentTypeBySlug } from "@/features/assessment/assessment-flow";
import { AssignmentTypeSelector } from "@/features/assessment/assignment-type-selector";
import { AssessmentWizard } from "@/features/assessment/assessment-wizard";

export default async function AssignmentSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ keepType?: string }>;
}) {
  const { type } = await params;
  const { keepType } = await searchParams;
  if (!getAssignmentTypeBySlug(type)) notFound();

  if (type === "auto") {
    return <AssignmentTypeSelector />;
  }

  return <AssessmentWizard screen="setup" typeSlug={keepType === "1" ? undefined : type} />;
}
