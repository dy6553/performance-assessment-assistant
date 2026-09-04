import { DraftRevisionEditor } from "@/features/assessment/draft-revision-editor";
import { EnhancedAssessmentWorkspace } from "@/features/assessment/enhanced-workspace";
import { StageContextBoundary } from "@/features/assessment/stage-context-boundary";

export default function AssignmentWorkspacePage() {
  return (
    <StageContextBoundary>
      <EnhancedAssessmentWorkspace />
      <DraftRevisionEditor />
    </StageContextBoundary>
  );
}
