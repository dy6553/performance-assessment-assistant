import { z } from "zod";

export const gradingStrictnessSchema = z.number().int().min(1).max(5);

export const gradingRequestSchema = z
  .object({
    rubricText: z.string().trim().min(10).max(30_000),
    submissionText: z.string().trim().min(20).max(60_000),
    strictness: gradingStrictnessSchema,
  })
  .strict();

export const gradingAiResultSchema = z
  .object({
    rubricTitle: z.string().trim().min(1).max(200),
    scoreBasis: z.enum(["explicit_points", "normalized_100"]),
    criteria: z
      .array(
        z
          .object({
            criterion: z.string().trim().min(1).max(240),
            maxScore: z.number().positive().max(1_000),
            earnedScore: z.number().nonnegative().max(1_000),
            evidence: z.array(z.string().trim().min(1).max(500)).max(6),
            reason: z.string().trim().min(1).max(1_000),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    overallFeedback: z.string().trim().min(1).max(3_000),
    strengths: z.array(z.string().trim().min(1).max(500)).max(10),
    deductions: z.array(z.string().trim().min(1).max(500)).max(12),
    nextActions: z.array(z.string().trim().min(1).max(500)).max(10),
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string().trim().min(1).max(500)).max(10),
  })
  .strict();

export type GradingRequest = z.infer<typeof gradingRequestSchema>;
export type GradingAiResult = z.infer<typeof gradingAiResultSchema>;

export type GradingResult = GradingAiResult & {
  strictness: number;
  strictnessLabel: string;
  score: number;
  maxScore: number;
  percentage: number;
};
