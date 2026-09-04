import { z } from "zod";

import { analysisResultSchema, assignmentInputSchema } from "./schemas";

export const sourceCheckStatusSchema = z.enum([
  "VERIFIED",
  "REACHABLE_LIMITED",
  "UNREACHABLE",
  "NOT_PROVIDED",
]);

export const researchResultSchema = z
  .object({
    summary: z.string().trim().min(1).max(2_000),
    liveSourceChecks: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(300),
            url: z.string().trim().max(2_000),
            status: sourceCheckStatusSchema,
            title: z.string().trim().max(500),
            publisher: z.string().trim().max(300),
            publishedAt: z.string().trim().max(120),
            notes: z.string().trim().min(1).max(1_000),
          })
          .strict(),
      )
      .max(10),
    academicCandidates: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(600),
            publisher: z.string().trim().max(300),
            year: z.number().int().min(1800).max(2200).nullable(),
            doi: z.string().trim().max(300),
            url: z.string().trim().max(2_000),
            status: z.literal("CROSSREF_METADATA_FOUND"),
          })
          .strict(),
      )
      .max(8),
    evidenceNeeds: z
      .array(
        z
          .object({
            claimOrQuestion: z.string().trim().min(1).max(700),
            preferredSourceTypes: z.array(z.string().trim().min(1).max(180)).min(1).max(6),
            searchQueries: z.array(z.string().trim().min(1).max(240)).min(1).max(6),
            status: z.enum(["VERIFIED_ENOUGH", "PARTIAL", "NEEDS_WEB_VERIFICATION"]),
            notes: z.string().trim().min(1).max(1_000),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    gaps: z.array(z.string().trim().min(1).max(800)).max(12),
    nextActions: z.array(z.string().trim().min(1).max(800)).min(1).max(12),
  })
  .strict();

export const executionPlanResultSchema = z
  .object({
    goal: z.string().trim().min(1).max(1_200),
    coreQuestion: z.string().trim().min(1).max(700),
    methodSteps: z.array(z.string().trim().min(1).max(800)).min(2).max(14),
    outline: z
      .array(
        z
          .object({
            section: z.string().trim().min(1).max(220),
            purpose: z.string().trim().min(1).max(700),
            evidenceToUse: z.array(z.string().trim().min(1).max(600)).max(6),
            studentAction: z.string().trim().min(1).max(700),
          })
          .strict(),
      )
      .min(2)
      .max(16),
    rubricMap: z
      .array(
        z
          .object({
            criterion: z.string().trim().min(1).max(300),
            proofInOutput: z.string().trim().min(1).max(900),
          })
          .strict(),
      )
      .max(14),
    requiredStudentInputs: z.array(z.string().trim().min(1).max(700)).max(12),
    checkpoints: z.array(z.string().trim().min(1).max(700)).min(1).max(10),
  })
  .strict();

export const researchRequestSchema = z
  .object({
    assignment: assignmentInputSchema,
    analysis: analysisResultSchema,
    sourceNotes: z.string().trim().max(12_000).default(""),
  })
  .strict();

export const executionPlanRequestSchema = z
  .object({
    assignment: assignmentInputSchema,
    analysis: analysisResultSchema,
    research: researchResultSchema,
  })
  .strict();

export type ResearchResult = z.infer<typeof researchResultSchema>;
export type ExecutionPlanResult = z.infer<typeof executionPlanResultSchema>;
export type SourceCheckStatus = z.infer<typeof sourceCheckStatusSchema>;
