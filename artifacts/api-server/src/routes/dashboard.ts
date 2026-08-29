import { Router, type IRouter } from "express";
import { db, clipsTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { requireUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireUser, async (_request, response): Promise<void> => {
  const rows = await db
    .select({ clip: clipsTable })
    .from(clipsTable);
  const dates = rows
    .map(({ clip }) => clip.date)
    .filter((date): date is string => Boolean(date))
    .sort();
  const summary = {
    reportCount: new Set(rows.map(({ clip }) => clip.reportId)).size,
    clipCount: rows.length,
    reviewCount: rows.filter(({ clip }) => clip.sensitiveNotes && Array.isArray(clip.sensitiveNotes) && clip.sensitiveNotes.length > 0).length,
    flagCount: rows.reduce((total, { clip }) => total + clip.flagCount, 0),
    earliestClipDate: dates[0] ?? null,
    latestClipDate: dates.at(-1) ?? null,
  };
  response.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;