import { unlink } from "node:fs/promises";
import { eq, lte } from "drizzle-orm";
import { db, pendingFileDeletionsTable } from "@workspace/db";
import { logger } from "./logger";

export async function processPendingFileDeletions(): Promise<void> {
  const pending = await db
    .select()
    .from(pendingFileDeletionsTable)
    .where(lte(pendingFileDeletionsTable.nextAttemptAt, new Date()));
  for (const item of pending) {
    try {
      await unlink(item.storagePath);
      await db
        .delete(pendingFileDeletionsTable)
        .where(eq(pendingFileDeletionsTable.id, item.id));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        await db
          .delete(pendingFileDeletionsTable)
          .where(eq(pendingFileDeletionsTable.id, item.id));
        continue;
      }
      logger.error(
        { error, cleanupId: item.id, storagePath: item.storagePath, attempts: item.attempts + 1 },
        "Pending report file deletion will be retried",
      );
      const attempts = item.attempts + 1;
      const delayMs = Math.min(60 * 60 * 1000, 60 * 1000 * 2 ** Math.min(attempts - 1, 6));
      await db
        .update(pendingFileDeletionsTable)
        .set({
          attempts,
          nextAttemptAt: new Date(Date.now() + delayMs),
          lastError: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
        })
        .where(eq(pendingFileDeletionsTable.id, item.id));
    }
  }
}

export function startPendingFileDeletionWorker(): void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void processPendingFileDeletions()
      .catch((error) => logger.error({ error }, "Pending file deletion worker failed"))
      .finally(() => {
        running = false;
      });
  }, 60_000);
  timer.unref();
}