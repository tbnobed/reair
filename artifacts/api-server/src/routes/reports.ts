import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  clipsTable,
  pendingFileDeletionsTable,
  reportsTable,
  usersTable,
} from "@workspace/db";
import {
  DeleteReportParams,
  ListClipsResponse,
  ListReportsResponse,
  UploadReportBody,
  UploadReportResponse,
} from "@workspace/api-zod";
import { parseReport, type ParsedClip, type ParsedNote } from "../lib/csv";
import { isAdministrator, normalizeUserRole, requireReportEditor, requireUser } from "../lib/auth";
import { processPendingFileDeletions } from "../lib/file-cleanup";

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

function hasValidIngestionToken(request: Request): boolean {
  const expected = process.env.REPORT_INGEST_API_KEY?.trim();
  const authorization = request.header("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!expected || !match) return false;

  const provided = Buffer.from(match[1]);
  const configured = Buffer.from(expected);
  return provided.length === configured.length && timingSafeEqual(provided, configured);
}

function requireReportIngestToken(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (!hasValidIngestionToken(request)) {
    response.status(401).json({ error: "A valid report ingestion token is required." });
    return;
  }
  next();
}

async function configuredIngestionUserId(): Promise<number | null> {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!configuredEmail) return null;

  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.email, configuredEmail))
    .limit(1);

  return user && isAdministrator({
    email: user.email,
    role: normalizeUserRole(user.role),
  }) ? user.id : null;
}

async function persistReport(
  userId: number,
  data: { name: string; content: string },
  clips: ParsedClip[],
  request: Request,
) {
  const storagePath = `${storageRoot}/${userId}-${randomUUID()}.csv`;
  const reportName = data.name.trim();

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
      await writeFile(storagePath, data.content, "utf8");
      const [created] = await transaction
        .insert(reportsTable)
        .values({
          userId,
          name: reportName,
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
          source: reportName,
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

    return { report, clipCount: clips.length };
  } catch (error) {
    await unlink(storagePath).catch(() => undefined);
    request.log.error({ err: error }, "Unable to persist report");
    throw error;
  }
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

router.post("/reports/ingest", requireReportIngestToken, async (request, response): Promise<void> => {
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

  const userId = await configuredIngestionUserId();
  if (!userId) {
    response.status(503).json({
      error: "Direct report ingestion is unavailable until ADMIN_EMAIL identifies the configured administrator.",
    });
    return;
  }

  const created = await persistReport(userId, parsed.data, clips, request);
  response.status(201).json(
    UploadReportResponse.parse(reportResponse(created.report, created.clipCount)),
  );
});

router.use(requireUser);

router.get("/reports", async (request, response): Promise<void> => {
  const reports = await db
    .select()
    .from(reportsTable)
    .orderBy(desc(reportsTable.uploadedAt));
  const counts = await db
    .select({
      reportId: clipsTable.reportId,
      count: sql<number>`count(${clipsTable.id})`,
    })
    .from(clipsTable)
    .groupBy(clipsTable.reportId);
  const countByReport = new Map(counts.map((row) => [row.reportId, Number(row.count)]));
  response.json(
    ListReportsResponse.parse(
      reports.map((report) => reportResponse(report, countByReport.get(report.id) ?? 0)),
    ),
  );
});

router.post("/reports", requireReportEditor, async (request, response): Promise<void> => {
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
  const created = await persistReport(userId, parsed.data, clips, request);
  response.status(201).json(
    UploadReportResponse.parse(reportResponse(created.report, created.clipCount)),
  );
});

router.delete("/reports/:reportId", requireReportEditor, async (request, response): Promise<void> => {
  const params = DeleteReportParams.safeParse(request.params);
  if (!params.success) {
    response.status(400).json({ error: "Invalid report id." });
    return;
  }

  const deleted = await db.transaction(async (transaction) => {
    const [report] = await transaction
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.id, params.data.reportId))
      .for("update");
    if (!report) return false;

    await transaction
      .insert(pendingFileDeletionsTable)
      .values({ storagePath: report.storagePath })
      .onConflictDoNothing({ target: pendingFileDeletionsTable.storagePath });
    await transaction.delete(reportsTable).where(eq(reportsTable.id, report.id));
    return true;
  });
  if (!deleted) {
    response.status(404).json({ error: "Report not found." });
    return;
  }

  await processPendingFileDeletions();
  response.sendStatus(204);
});

router.get("/clips", async (_request, response): Promise<void> => {
  const rows = await db
    .select({ clip: clipsTable })
    .from(clipsTable)
    .orderBy(desc(clipsTable.id));
  response.json(ListClipsResponse.parse(rows.map((row) => clipResponse(row.clip))));
});

export default router;