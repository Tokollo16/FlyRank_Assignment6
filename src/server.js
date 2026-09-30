import express from "express";
import { triageRouter } from "./routes/triage.js";

const app = express();
app.use(express.json({ limit: "8kb" }));
app.use(triageRouter);
app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Unexpected server error" });
});

const port = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log(`Triage API listening on http://localhost:${port}`));
}

export default app;
