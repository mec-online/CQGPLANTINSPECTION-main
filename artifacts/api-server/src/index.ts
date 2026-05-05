import { app } from "./app.js";
import { logger } from "./lib/logger.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);

app.listen(PORT, () => {
  logger.info({ port: PORT }, "API server listening");
});
