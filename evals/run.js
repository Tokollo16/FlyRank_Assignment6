import { readFile } from "node:fs/promises";

const cases = JSON.parse(await readFile(new URL("./cases.json", import.meta.url), "utf8"));
const baseUrl = process.env.EVAL_URL || "http://127.0.0.1:3000";
let matched = 0;
const failures = [];

for (const item of cases) {
  const response = await fetch(`${baseUrl}/triage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: item.text })
  });
  const result = await response.json();
  if (result.category === item.category) matched += 1;
  else failures.push({ text: item.text, expected: item.category, actual: result.category });
}

console.log(JSON.stringify({ matched, total: cases.length, score: `${matched}/${cases.length}`, failures }, null, 2));
