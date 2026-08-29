import app from "./app";
import { seedAdminUser } from "./lib/auth";
import {
  processPendingFileDeletions,
  startPendingFileDeletionWorker,
} from "./lib/file-cleanup";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await seedAdminUser();
await processPendingFileDeletions();
startPendingFileDeletionWorker();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
