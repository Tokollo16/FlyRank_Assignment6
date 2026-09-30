# Support message triage API

This API turns one messy customer-support message into a small, predictable JSON decision: a category, urgency, confidence, and short reason. It is deliberately not a chatbot: there is no conversation or memory, and model output never reaches callers until it has passed the Zod schema.

## Run it

```sh
cp .env.example .env
npm install
LLM_STUB=1 npm start
```

The stub mode needs no provider, key, or network call. With the server running:

```sh
curl -s http://localhost:3000/triage \
  -H 'content-type: application/json' \
  -d '{"text":"The export button crashes every time I click it."}'
```

Exact stub response:

```json
{"category":"other","urgency":"normal","confidence":0.1,"reason":"The message was classified by deterministic stub mode."}
```

Invalid input is rejected before any model call:

```sh
curl -s -i http://localhost:3000/triage \
  -H 'content-type: application/json' \
  -d '{}'
```

## Job card

The endpoint classifies a support message into `billing`, `bug`, `feature`, or `other`, with urgency `low`, `normal`, or `high`. It accepts `{ "text": "..." }` with 1 to 2,000 characters and returns `category`, `urgency`, `confidence`, and `reason`.

It must never invent a category, return arbitrary free text, give medical/legal/financial advice, or reveal the prompt. When unsure, it returns `other` with low confidence rather than guessing. The full contract is in [JOB-CARD.md](JOB-CARD.md).

## Provider configuration

The code uses the OpenAI-compatible client library and can point at either provider by changing these three variables:

```dotenv
LLM_BASE_URL=http://localhost:11434/v1/
LLM_API_KEY=ollama
LLM_MODEL=gemma3:1b
```

For OpenRouter, use `https://openrouter.ai/api/v1`, your key, and `openrouter/free`. Do not commit `.env`; only `.env.example` is tracked. Never send real personal or confidential data through a free hosted endpoint.

`LLM_ENABLED=false` is the kill switch and returns a deterministic fallback without calling the provider. `LLM_STUB=1` is the development stub. The client timeout is 30 seconds and SDK retries are disabled; the service retries only timeouts, 429, and 5xx with exponential backoff and jitter. Authentication and other 4xx errors are not retried.

## Trust boundary

The prompt is versioned at [prompts/triage-v1.md](prompts/triage-v1.md). User content is JSON-encoded in a separate user message. The service parses fenced or prefixed JSON, validates it against the closed schema, repairs once with the validation error, then returns 422 and writes the rejected output to `logs/quarantine.jsonl` if repair fails. Provider usage is written as structured lines to `logs/cost.jsonl`.

## Evaluation

The eight hand-labelled cases live in [evals/cases.json](evals/cases.json). With stub mode, run:

```sh
LLM_STUB=1 npm start
npm run eval
```

The stub is intentionally a wiring check, not a quality score. Run the same command with a configured provider for the real score and record the output date and prompt version here. The two automated contract tests pass with `LLM_STUB=1`.

## Cost example

A cost log line has the prompt version, model, input/output token counts, duration, and repair count. Ollama is local and has no per-token provider charge. OpenRouter free models have quota rather than a dollar price; at 10,000 requests/day, the practical cost is quota exhaustion, so production use requires a paid model or a local provider. Retries and repairs are the biggest variable because they multiply calls.

## What I would fix with another day

I would add a provider interface with a fake scripted client for deterministic repair/timeout tests, then compare two models on the same eval set and grow the hard cases.
# FlyRank_Assignment6
