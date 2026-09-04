import { DraftRevisionEditor } from "@/features/assessment/draft-revision-editor";
import { EnhancedAssessmentWorkspace } from "@/features/assessment/enhanced-workspace";

export default function AssignmentWorkspacePage() {
  return (
    <>
      <EnhancedAssessmentWorkspace />
      <DraftRevisionEditor />
    </>
  );
}
