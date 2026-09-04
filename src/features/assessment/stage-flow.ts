import type { AssignmentInput } from "./schemas";

export const assessmentResearchStorageKey = "assessment-wizard-research-v1";
export const assessmentResearchSourceNotesStorageKey = "assessment-wizard-research-source-notes-v1";
export const assessmentExecutionPlanStorageKey = "assessment-wizard-execution-plan-v1";
export const assessmentStageContextStorageKey = "assessment-wizard-stage-context-v1";

export const assessmentStageStorageKeys = [
  assessmentResearchStorageKey,
  assessmentResearchSourceNotesStorageKey,
  assessmentExecutionPlanStorageKey,
  assessmentStageContextStorageKey,
] as const;

export function assessmentStageContextId(assignment: AssignmentInput) {
  return JSON.stringify([
    assignment.curriculum,
    assignment.schoolLevel,
    assignment.grade,
    assignment.subject,
    assignment.course,
    assignment.assignmentType,
    assignment.topic,
    assignment.teacherInstruction,
    assignment.rubricText,
    assignment.achievementStandardText,
    assignment.requiredElements,
    assignment.lengthRule,
    assignment.formatRule,
  ]);
}
