import { z } from "zod";

export const triageInputSchema = z.object({
  text: z.string({ required_error: "text is required" }).trim().min(1, "text must not be empty").max(2000, "text must be 2000 characters or fewer")
}).strict();

export const triageOutputSchema = z.object({
  category: z.enum(["billing", "bug", "feature", "other"]),
  urgency: z.enum(["low", "normal", "high"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(240)
}).strict();

export const fallbackTriage = {
  category: "other",
  urgency: "normal",
  confidence: 0.1,
  reason: "The AI triage feature is currently disabled."
};
