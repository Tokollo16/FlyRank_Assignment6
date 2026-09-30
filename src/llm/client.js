import OpenAI from "openai";

export function createLlmClient(env = process.env) {
  return new OpenAI({
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    timeout: 30000,
    maxRetries: 0
  });
}

export function isRetryableError(error) {
  const status = error?.status ?? error?.response?.status;
  return status === 429 || (status >= 500 && status <= 599) || error?.name === "APITimeoutError" || error?.code === "ETIMEDOUT";
}

export function retryAfterMs(error) {
  const value = error?.headers?.get?.("retry-after") ?? error?.headers?.["retry-after"];
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

export async function withRetries(operation, { maxAttempts = 3, sleep = setTimeout } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isRetryableError(error)) throw error;
      const retryDelay = retryAfterMs(error) ?? (1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
      await new Promise((resolve) => sleep(resolve, retryDelay));
    }
  }
  throw lastError;
}
