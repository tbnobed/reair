import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, clipsTable, reportsTable, usersTable } from "@workspace/db";
import {
  DeleteReportParams,
  ListClipsResponse,
  ListReportsResponse,
  UploadReportBody,
  UploadReportResponse,
} from "@workspace/api-zod";
import { parseReport, type ParsedNote } from "../lib/csv";
import { requireUser } from "../lib/auth";

const router: IRouter = Router();
const storageRoot = process.env.STORAGE_DIR ?? "./data/uploads";

function reportResponse(
  report: { id: number; name: string; uploadedAt: Date },
  clipCount: number,
) {
  return {
    id: report.id,
    name: report.name,
    clipCount,
    uploadedAt: report.uploadedAt.toISOString(),
  };
}

function notes(value: unknown): ParsedNote[] {
  return Array.isArray(value) ? (value as ParsedNote[]) : [];
}

function clipResponse(clip: typeof clipsTable.$inferSelect) {
  return {
    id: clip.clipKey,
    reportId: clip.reportId,
    source: clip.source,
    date: clip.date,
    revision: clip.revision,
    time: clip.time,
    originalAir: clip.originalAir,
    lastAir: clip.lastAir,
    hosts: clip.hosts,
    guests: clip.guests,
    shortSynopsis: clip.shortSynopsis,
    longSynopsis: clip.longSynopsis,
    duplicateLongSynopsis: clip.duplicateLongSynopsis === "true",
    sensitiveNotes: notes(clip.sensitiveNotes),
    dateNotes: notes(clip.dateNotes),
    flagCount: clip.flagCount,
  };
}

router.use(requireUser);

router.get("/reports", async (request, response): Promise<void> => {
  const userId = request.currentUser!.id;
  const reports = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.userId, userId))
    .orderBy(desc(reportsTable.uploadedAt));
  const counts = await db
    .select({
      reportId: clipsTable.reportId,
      count: sql<number>`count(${clipsTable.id})`,
    })
    .from(clipsTable)
    .innerJoin(reportsTable, eq(reportsTable.id, clipsTable.reportId))
    .where(eq(reportsTable.userId, userId))
    .groupBy(clipsTable.reportId);
  const countByReport = new Map(counts.map((row) => [row.reportId, Number(row.count)]));
  response.json(
    ListReportsResponse.parse(
      reports.map((report) => reportResponse(report, countByReport.get(report.id) ?? 0)),
    ),
  );
});

router.post("/reports", async (request, response): Promise<void> => {
  const parsed = UploadReportBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "A report name and CSV file contents are required." });
    return;
  }

  const clips = parseReport(parsed.data.content);
  if (!clips.length) {
    response.status(400).json({ error: "No clips found. The CSV must include a ClipID column." });
    return;
  }

  const userId = request.currentUser!.id;
  const storagePath = `${storageRoot}/${userId}-${randomUUID()}.csv`;

  try {
    const report = await db.transaction(async (transaction) => {
      const [activeUser] = await transaction
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .for("update");
      if (!activeUser) {
        throw new Error("The signed-in account is no longer available.");
      }
      await mkdir(storageRoot, { recursive: true });
      await writeFile(storagePath, parsed.data.content, "utf8");
      const [created] = await transaction
        .insert(reportsTable)
        .values({
          userId,
          name: parsed.data.name.trim(),
          storagePath,
        })
        .returning();
      await transaction.insert(clipsTable).values(
        clips.map((clip) => ({
          reportId: created.id,
          clipKey: clip.clipKey,
          date: clip.date,
          revision: clip.revision,
          time: clip.time,
          originalAir: clip.originalAir,
          lastAir: clip.lastAir,
          source: parsed.data.name.trim(),
          hosts: clip.hosts,
          guests: clip.guests,
          shortSynopsis: clip.shortSynopsis,
          longSynopsis: clip.longSynopsis,
          duplicateLongSynopsis: clip.duplicateLongSynopsis ? "true" : "false",
          sensitiveNotes: clip.sensitiveNotes,
          dateNotes: clip.dateNotes,
          flagCount: clip.flagCount,
        })),
      );
      return created;
    });

    response.status(201).json(
      UploadReportResponse.parse(reportResponse(report, clips.length)),
    );
  } catch (error) {
    await unlink(storagePath).catch(() => undefined);
    request.log.error({ err: error }, "Unable to persist uploaded report");
    throw error;
  }
});

router.delete("/reports/:reportId", async (request, response): Promise<void> => {
  const params = DeleteReportParams.safeParse(request.params);
  if (!params.success) {
    response.status(400).json({ error: "Invalid report id." });
    return;
  }

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.id, params.data.reportId),
        eq(reportsTable.userId, request.currentUser!.id),
      ),
    )
    .limit(1);
  if (!report) {
    response.status(404).json({ error: "Report not found." });
    return;
  }

  await db.delete(reportsTable).where(eq(reportsTable.id, report.id));
  await unlink(report.storagePath).catch((error: unknown) => {
    request.log.warn({ err: error, reportId: report.id }, "Original report file was already missing");
  });
  response.sendStatus(204);
});

router.get("/clips", async (request, response): Promise<void> => {
  const rows = await db
    .select({ clip: clipsTable })
    .from(clipsTable)
    .innerJoin(reportsTable, eq(reportsTable.id, clipsTable.reportId))
    .where(eq(reportsTable.userId, request.currentUser!.id))
    .orderBy(desc(clipsTable.id));
  response.json(ListClipsResponse.parse(rows.map((row) => clipResponse(row.clip))));
});

export default router;