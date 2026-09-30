import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/server.js";

let server;
test.before(() => { server = app.listen(0); });
test.after(() => server.close());

async function post(body) {
  const address = server.address();
  return fetch(`http://127.0.0.1:${address.port}/triage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("stub mode returns the closed output schema without a provider", async () => {
  const previous = process.env.LLM_STUB;
  process.env.LLM_STUB = "1";
  const response = await post({ text: "The search page is confusing." });
  const body = await response.json();
  if (previous === undefined) delete process.env.LLM_STUB; else process.env.LLM_STUB = previous;
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body).sort(), ["category", "confidence", "reason", "urgency"]);
  assert.equal(body.category, "other");
});

test("invalid input returns 400 and names the field", async () => {
  const response = await post({ text: "" });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.fields[0].field, "text");
});
