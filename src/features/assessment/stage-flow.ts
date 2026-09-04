export const assessmentResearchStorageKey = "assessment-wizard-research-v1";
export const assessmentResearchSourceNotesStorageKey = "assessment-wizard-research-source-notes-v1";
export const assessmentExecutionPlanStorageKey = "assessment-wizard-execution-plan-v1";

export const assessmentStageStorageKeys = [
  assessmentResearchStorageKey,
  assessmentResearchSourceNotesStorageKey,
  assessmentExecutionPlanStorageKey,
] as const;
