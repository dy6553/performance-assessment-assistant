import { z } from "zod";

export const schoolLevelSchema = z.enum(["초등학교", "중학교", "고등학교"]);

export const assignmentInputSchema = z
  .object({
    schoolYear: z.number().int().min(2015).max(2035),
    schoolLevel: schoolLevelSchema,
    grade: z.number().int().min(1).max(6),
    subject: z.string().trim().min(1).max(80),
    course: z.string().trim().max(120).default(""),
    assignmentType: z.string().trim().max(120).default("자동 분석"),
    topic: z.string().trim().min(2).max(500),
    teacherInstruction: z.string().trim().min(2).max(20_000),
    rubricText: z.string().trim().max(20_000).default(""),
    achievementStandardText: z.string().trim().max(8_000).default(""),
    requiredElements: z.string().trim().max(8_000).default(""),
    lengthRule: z.string().trim().max(300).default(""),
    formatRule: z.string().trim().max(300).default(""),
    studentIdeas: z.string().trim().max(12_000).default(""),
  })
  .superRefine((value, ctx) => {
    const maxGrade = value.schoolLevel === "초등학교" ? 6 : 3;
    if (value.grade > maxGrade) {
      ctx.addIssue({
        code: "custom",
        path: ["grade"],
        message: `${value.schoolLevel} 학년 범위를 확인해 주세요.`,
      });
    }
  });

const requirementSchema = z
  .object({
    requiredSections: z.array(z.string().trim().min(1).max(300)).max(20),
    requiredKeywords: z.array(z.string().trim().min(1).max(120)).max(20),
    prohibitedItems: z.array(z.string().trim().min(1).max(300)).max(20),
    teacherSpecificRules: z.array(z.string().trim().min(1).max(500)).max(30),
    length: z
      .object({
        min: z.number().int().nonnegative().nullable(),
        max: z.number().int().nonnegative().nullable(),
        unit: z.enum(["characters", "words", "pages", "minutes", "unknown"]),
      })
      .strict(),
    format: z.string().trim().max(500),
  })
  .strict();

export const analysisResultSchema = z
  .object({
    taskType: z
      .object({
        primary: z.string().trim().min(1).max(120),
        secondary: z.array(z.string().trim().min(1).max(120)).max(5),
        confidence: z.number().min(0).max(1),
        reasons: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
      })
      .strict(),
    curriculum: z
      .object({
        version: z.string().trim().min(1).max(120),
        status: z.enum(["user_provided", "inferred_needs_verification"]),
        basis: z.string().trim().min(1).max(800),
      })
      .strict(),
    requirements: requirementSchema,
    achievementStandards: z
      .array(
        z
          .object({
            code: z.string().trim().max(80),
            text: z.string().trim().min(1).max(1_500),
            relevance: z.number().min(0).max(1),
            verificationStatus: z.enum(["user_provided", "unverified"]),
          })
          .strict(),
      )
      .max(3),
    rubricItems: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(120),
            description: z.string().trim().min(1).max(800),
            weight: z.number().min(0).max(100).nullable(),
            source: z.enum(["teacher", "temporary"]),
          })
          .strict(),
      )
      .max(12),
    strategy: z
      .object({
        important: z.array(z.string().trim().min(1).max(600)).min(1).max(8),
        rubricStrategies: z.array(z.string().trim().min(1).max(700)).max(12),
        recommendedStructure: z.array(z.string().trim().min(1).max(300)).min(1).max(15),
        mustInclude: z.array(z.string().trim().min(1).max(500)).max(15),
        deductionRisks: z.array(z.string().trim().min(1).max(500)).max(12),
        topicApplication: z.array(z.string().trim().min(1).max(700)).max(10),
      })
      .strict(),
    warnings: z.array(z.string().trim().min(1).max(700)).max(12),
  })
  .strict();

export const draftResultSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    thesisOrGoal: z.string().trim().min(1).max(1_000),
    sections: z
      .array(
        z
          .object({
            heading: z.string().trim().min(1).max(160),
            body: z.string().trim().min(1).max(8_000),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    claimCandidates: z.array(z.string().trim().min(1).max(1_000)).max(20),
    sourceNeeds: z.array(z.string().trim().min(1).max(700)).max(20),
    uncertainties: z.array(z.string().trim().min(1).max(700)).max(15),
  })
  .strict();

const checkStatusSchema = z.enum(["PASS", "PARTIAL", "FAIL", "NEEDS_WEB_VERIFICATION"]);
const verificationCheckSchema = z
  .object({
    status: checkStatusSchema,
    evidence: z.array(z.string().trim().min(1).max(900)).max(12),
    issues: z.array(z.string().trim().min(1).max(900)).max(12),
    fixes: z.array(z.string().trim().min(1).max(900)).max(12),
  })
  .strict();

export const verificationResultSchema = z
  .object({
    requirementCheck: verificationCheckSchema,
    curriculumCheck: verificationCheckSchema,
    rubricCheck: verificationCheckSchema,
    logicCheck: verificationCheckSchema,
    factSourceCheck: verificationCheckSchema,
    formatCheck: verificationCheckSchema,
    gradeLevelCheck: verificationCheckSchema,
    revisedDraft: draftResultSchema.nullable(),
    summary: z.string().trim().min(1).max(1_500),
  })
  .strict();

export const analyzeRequestSchema = z.object({ assignment: assignmentInputSchema }).strict();
export const generateRequestSchema = z
  .object({ assignment: assignmentInputSchema, analysis: analysisResultSchema })
  .strict();
export const verifyRequestSchema = z
  .object({
    assignment: assignmentInputSchema,
    analysis: analysisResultSchema,
    draft: draftResultSchema,
  })
  .strict();

export type AssignmentInput = z.infer<typeof assignmentInputSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type DraftResult = z.infer<typeof draftResultSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type VerificationStatus = z.infer<typeof checkStatusSchema>;
