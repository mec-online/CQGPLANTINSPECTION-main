import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { app } from "./app.js";
import { logger } from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT ?? "4000", 10);

// ── Serve React frontend in production ───────────────────────────────────────
//
// Deploy package layout (assembled by GitHub Actions):
//   deploy/
//     dist/          ← compiled API (this file runs as dist/index.mjs)
//     public/        ← compiled React app (Vite output)
//     node_modules/
//     startup.sh
//
// __dirname resolves to dist/ at runtime, so ../public == deploy/public/
//
if (process.env.NODE_ENV === "production") {
  const STATIC_DIR = path.join(__dirname, "..", "public");

  // Serve JS/CSS/images/service-worker etc.
  app.use(express.static(STATIC_DIR));

  // SPA fallback — any route not matched by the API returns index.html.
  // This MUST be registered after all /api routes (which are set up in app.ts).
  app.get("*", (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });

  logger.info({ staticDir: STATIC_DIR }, "Serving frontend static files");
}

app.listen(PORT, () => {
  logger.info({ port: PORT }, "API server listening");
});