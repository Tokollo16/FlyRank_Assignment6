import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLlmClient, withRetries } from "./client.js";
import { fallbackTriage, triageOutputSchema } from "./schema.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const promptPath = resolve(projectRoot, "prompts/triage-v1.md");
const costLogPath = resolve(projectRoot, "logs/cost.jsonl");
const quarantineLogPath = resolve(projectRoot, "logs/quarantine.jsonl");

function parseJsonObject(raw) {
  const text = String(raw ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model response did not contain a JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

function validationMessage(result) {
  return result.error.issues.map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`).join("; ");
}

async function appendJsonLine(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

function stubResult() {
  return { ...fallbackTriage, reason: "The message was classified by deterministic stub mode." };
}

export async function classifyTriage(text, env = process.env) {
  if (env.LLM_ENABLED === "false") return { result: fallbackTriage, calls: 0 };
  if (env.LLM_STUB === "1") return { result: stubResult(), calls: 0 };

  const prompt = await readFile(promptPath, "utf8");
  const client = createLlmClient(env);
  const maxAttempts = Math.max(1, Math.min(3, Number(env.LLM_MAX_ATTEMPTS || 3)));
  let raw = "";
  let repairCount = 0;
  let totalCalls = 0;
  let lastError;

  async function callModel(userText) {
    const started = Date.now();
    totalCalls += 1;
    try {
      const response = await withRetries(() => client.chat.completions.create({
        model: env.LLM_MODEL,
        temperature: 0.1,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify({ text: userText }) }
        ]
      }), { maxAttempts });
      const usage = response.usage ?? {};
      await appendJsonLine(costLogPath, {
        prompt_version: "triage-v1",
        model: env.LLM_MODEL,
        input_tokens: usage.prompt_tokens ?? 0,
        output_tokens: usage.completion_tokens ?? 0,
        duration_ms: Date.now() - started,
        repair_count: repairCount
      });
      return response.choices?.[0]?.message?.content ?? "";
    } catch (error) {
      await appendJsonLine(costLogPath, {
        prompt_version: "triage-v1",
        model: env.LLM_MODEL,
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - started,
        repair_count: repairCount,
        error_status: error.status ?? error.code ?? error.name
      });
      throw error;
    }
  }

  try {
    raw = await callModel(text);
    let parsed;
    try {
      parsed = parseJsonObject(raw);
    } catch (error) {
      lastError = error;
    }
    if (parsed) {
      const valid = triageOutputSchema.safeParse(parsed);
      if (valid.success) return { result: valid.data, calls: totalCalls };
      lastError = new Error(validationMessage(valid));
    }

    repairCount = 1;
    const repairPrompt = `${text}\n\nPrevious rejected output:\n${raw}\n\nValidation error: ${lastError?.message}\nYour previous answer was rejected for this reason. Return only corrected JSON matching the schema.`;
    raw = await callModel(repairPrompt);
    let repaired;
    try {
      repaired = parseJsonObject(raw);
    } catch (error) {
      lastError = error;
    }
    if (repaired) {
      const valid = triageOutputSchema.safeParse(repaired);
      if (valid.success) return { result: valid.data, calls: totalCalls };
      lastError = new Error(validationMessage(valid));
    }
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "APITimeoutError" || error?.code === "ETIMEDOUT") {
      const timeoutError = new Error("LLM request timed out");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  }

  await appendJsonLine(quarantineLogPath, {
    input: text,
    raw_output: raw,
    error: lastError?.message ?? "Invalid model response",
    prompt_version: "triage-v1"
  });
  const validationError = new Error("The model response could not be validated after one repair attempt");
  validationError.statusCode = 422;
  throw validationError;
}
