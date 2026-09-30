import { Router } from "express";
import { classifyTriage } from "../llm/service.js";
import { triageInputSchema } from "../llm/schema.js";

export const triageRouter = Router();

triageRouter.post("/triage", async (request, response, next) => {
  const input = triageInputSchema.safeParse(request.body);
  if (!input.success) {
    return response.status(400).json({
      error: "Invalid request",
      fields: input.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message }))
    });
  }

  try {
    const { result } = await classifyTriage(input.data.text);
    return response.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return response.status(error.statusCode).json({ error: error.message });
    if (error.status === 401 || error.status === 403) return response.status(502).json({ error: "LLM provider authentication failed" });
    return next(error);
  }
});
