import { AssessmentWizard } from "@/features/assessment/assessment-wizard";
import { DraftRevisionEditor } from "@/features/assessment/draft-revision-editor";

export default function AssignmentWorkspacePage() {
  return (
    <>
      <AssessmentWizard screen="workspace" />
      <DraftRevisionEditor />
    </>
  );
}
