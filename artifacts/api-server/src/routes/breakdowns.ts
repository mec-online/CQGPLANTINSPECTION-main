import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { breakdowns, assets, sites, users, attachments } from "@workspace/db/schema";
import { eq, and, desc, asc, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Breakdown trends analytics
router.get("/trends", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId } = req.query;

  const conditions: (ReturnType<typeof eq>)[] = [];
  if (siteId) conditions.push(eq(breakdowns.siteId, siteId as string));
  if (req.user!.role === "OPERATOR" && req.user!.siteId)
    conditions.push(eq(breakdowns.siteId, req.user!.siteId));
  if (req.user!.role === "SITE_MANAGER" && req.user!.siteId)
    conditions.push(eq(breakdowns.siteId, req.user!.siteId));

  const allBreakdowns = await db.query.breakdowns.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      asset: true,
      site: true,
    },
    orderBy: asc(breakdowns.startedAt),
  });

  // By asset
  const assetMap = new Map<
    string,
    {
      assetId: string;
      assetName: string;
      plantId: string | null;
      siteCode: string;
      count: number;
      totalDowntimeMinutes: number;
      dates: Date[];
    }
  >();
  for (const b of allBreakdowns) {
    const key = b.assetId;
    if (!assetMap.has(key)) {
      assetMap.set(key, {
        assetId: b.assetId,
        assetName: b.asset?.name ?? "Unknown",
        plantId: b.asset?.plantId ?? null,
        siteCode: b.site?.code ?? "",
        count: 0,
        totalDowntimeMinutes: 0,
        dates: [],
      });
    }
    const entry = assetMap.get(key)!;
    entry.count++;
    entry.totalDowntimeMinutes += b.durationMinutes || 0;
    entry.dates.push(new Date(b.startedAt));
  }

  const byAsset = Array.from(assetMap.values())
    .map((a) => {
      const sortedDates = a.dates.sort((x, y) => x.getTime() - y.getTime());
      let mtbfDays: number | null = null;
      if (sortedDates.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < sortedDates.length; i++) {
          intervals.push(
            (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24),
          );
        }
        // Weighted average -- more recent intervals weighted higher
        let weightedSum = 0;
        let weightTotal = 0;
        intervals.forEach((interval, idx) => {
          const weight = idx + 1;
          weightedSum += interval * weight;
          weightTotal += weight;
        });
        mtbfDays = weightedSum / weightTotal;
      }
      const lastBreakdownAt =
        sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
      const predictedNextAt =
        lastBreakdownAt && mtbfDays
          ? new Date(lastBreakdownAt.getTime() + mtbfDays * 24 * 60 * 60 * 1000)
          : null;
      return {
        assetId: a.assetId,
        assetName: a.assetName,
        plantId: a.plantId,
        siteCode: a.siteCode,
        count: a.count,
        totalDowntimeMinutes: a.totalDowntimeMinutes,
        avgDowntimeMinutes:
          a.count > 0 ? Math.round(a.totalDowntimeMinutes / a.count) : 0,
        lastBreakdownAt: lastBreakdownAt?.toISOString() || null,
        mtbfDays: mtbfDays ? Math.round(mtbfDays * 10) / 10 : null,
        predictedNextAt: predictedNextAt?.toISOString() || null,
      };
    })
    .sort((a, b) => b.count - a.count);

  // By site
  const siteMap = new Map<
    string,
    {
      siteId: string;
      siteName: string;
      siteCode: string;
      count: number;
      totalDowntimeMinutes: number;
    }
  >();
  for (const b of allBreakdowns) {
    if (!siteMap.has(b.siteId)) {
      siteMap.set(b.siteId, {
        siteId: b.siteId,
        siteName: b.site?.name ?? "",
        siteCode: b.site?.code ?? "",
        count: 0,
        totalDowntimeMinutes: 0,
      });
    }
    const entry = siteMap.get(b.siteId)!;
    entry.count++;
    entry.totalDowntimeMinutes += b.durationMinutes || 0;
  }
  const bySite = Array.from(siteMap.values()).sort((a, b) => b.count - a.count);

  // By month (last 12 months)
  const monthMap = new Map<
    string,
    { month: string; count: number; totalDowntimeMinutes: number }
  >();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, { month: key, count: 0, totalDowntimeMinutes: 0 });
  }
  for (const b of allBreakdowns) {
    const d = new Date(b.startedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthMap.has(key)) {
      const entry = monthMap.get(key)!;
      entry.count++;
      entry.totalDowntimeMinutes += b.durationMinutes || 0;
    }
  }
  const byMonth = Array.from(monthMap.values());

  // By cause
  const causeMap = new Map<string, number>();
  for (const b of allBreakdowns) {
    const cause = b.cause || "Unknown";
    causeMap.set(cause, (causeMap.get(cause) || 0) + 1);
  }
  const byCause = Array.from(causeMap.entries())
    .map(([cause, cnt]) => ({ cause, count: cnt }))
    .sort((a, b) => b.count - a.count);

  res.json({ byAsset, bySite, byMonth, byCause, total: allBreakdowns.length });
});

// AI prediction for an asset
router.get("/predict/:assetId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const allBreakdowns = await db.query.breakdowns.findMany({
    where: eq(breakdowns.assetId, req.params.assetId),
    with: { asset: true },
    orderBy: asc(breakdowns.startedAt),
  });

  if (allBreakdowns.length === 0) {
    res.json({
      prediction: "No breakdown history available for this asset.",
      riskLevel: "LOW",
      recommendations: ["Begin recording breakdowns to enable predictions."],
    });
    return;
  }

  const asset = allBreakdowns[0].asset;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Statistical fallback
    const intervals: number[] = [];
    for (let i = 1; i < allBreakdowns.length; i++) {
      intervals.push(
        (new Date(allBreakdowns[i].startedAt).getTime() -
          new Date(allBreakdowns[i - 1].startedAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
    }
    const mtbf =
      intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null;
    const lastBreakdown = new Date(allBreakdowns[allBreakdowns.length - 1].startedAt);
    const daysSinceLast = (Date.now() - lastBreakdown.getTime()) / (1000 * 60 * 60 * 24);
    const daysOverdue = mtbf ? daysSinceLast - mtbf : 0;

    res.json({
      prediction: mtbf
        ? `Based on ${allBreakdowns.length} historical breakdowns, average interval is ${Math.round(mtbf)} days. ${daysOverdue > 0 ? `Asset is ${Math.round(daysOverdue)} days overdue for a breakdown.` : `Next breakdown predicted in approx. ${Math.round(mtbf - daysSinceLast)} days.`}`
        : `Only 1 breakdown recorded. More data needed for prediction.`,
      riskLevel: daysOverdue > 7 ? "HIGH" : daysOverdue > 0 ? "MEDIUM" : "LOW",
      mtbfDays: mtbf ? Math.round(mtbf) : null,
      recommendations: ["Add ANTHROPIC_API_KEY to backend .env for AI-powered insights."],
    });
    return;
  }

  // Claude AI prediction
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const historyText = allBreakdowns
      .map(
        (b, i) =>
          `${i + 1}. ${new Date(b.startedAt).toLocaleDateString("en-GB")} — ${b.description}${b.cause ? ` (Cause: ${b.cause})` : ""}${b.durationMinutes ? ` — Downtime: ${b.durationMinutes} mins` : ""}${b.resolution ? ` — Resolution: ${b.resolution}` : ""}`,
      )
      .join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system:
        "You are an industrial plant maintenance analyst specialising in predictive maintenance for quarry equipment. Analyse breakdown history and provide concise, practical predictions. Always respond with valid JSON only.",
      messages: [
        {
          role: "user",
          content: `Analyse this breakdown history for ${asset?.name ?? "Unknown"} (${asset?.manufacturer || "Unknown"} ${asset?.model || ""}, criticality: ${asset?.criticality ?? "MEDIUM"}) and predict when the next breakdown is likely.\n\nBreakdown history:\n${historyText}\n\nRespond with JSON: { "prediction": "2-3 sentence prediction", "riskLevel": "LOW|MEDIUM|HIGH", "daysUntilPredicted": <number or null>, "recommendations": ["recommendation 1", "recommendation 2"] }`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}");

    res.json({
      prediction: parsed.prediction || "Unable to generate prediction.",
      riskLevel: parsed.riskLevel || "MEDIUM",
      daysUntilPredicted: parsed.daysUntilPredicted || null,
      recommendations: parsed.recommendations || [],
    });
  } catch (err) {
    req.log.error({ err }, "AI prediction error");
    res.status(500).json({ error: "Prediction failed" });
  }
});

router.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId, assetId, limit = "50", offset = "0" } = req.query;

  const conditions: (ReturnType<typeof eq>)[] = [];
  if (siteId) conditions.push(eq(breakdowns.siteId, siteId as string));
  if (assetId) conditions.push(eq(breakdowns.assetId, assetId as string));
  if (req.user!.role === "OPERATOR" && req.user!.siteId) {
    conditions.push(eq(breakdowns.siteId, req.user!.siteId));
  }
  if (req.user!.role === "SITE_MANAGER" && req.user!.siteId) {
    conditions.push(eq(breakdowns.siteId, req.user!.siteId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db.query.breakdowns.findMany({
      where,
      with: {
        asset: true,
        site: true,
        reportedBy: true,
        attachments: true,
      },
      orderBy: desc(breakdowns.startedAt),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    }),
    db.select({ count: count() }).from(breakdowns).where(where),
  ]);

  const result = rows.map((b) => ({
    id: b.id,
    startedAt: b.startedAt,
    resolvedAt: b.resolvedAt,
    durationMinutes: b.durationMinutes,
    manHours: b.manHours,
    partsCost: b.partsCost,
    description: b.description,
    cause: b.cause,
    resolution: b.resolution,
    area: b.area,
    asset: b.asset ? { id: b.asset.id, name: b.asset.name, plantId: b.asset.plantId } : null,
    site: b.site ? { id: b.site.id, name: b.site.name, code: b.site.code } : null,
    reportedBy: b.reportedBy ? { id: b.reportedBy.id, name: b.reportedBy.name } : null,
    _count: { attachments: b.attachments.length },
  }));

  res.json({ breakdowns: result, total: totalRow?.count ?? 0 });
});

router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { assetId, siteId, description, cause, area, startedAt } = req.body;

  if (!assetId || !siteId || !description) {
    res.status(400).json({ error: "assetId, siteId and description required" });
    return;
  }

  const [breakdown] = await db
    .insert(breakdowns)
    .values({
      assetId,
      siteId,
      reportedById: req.user!.id,
      description,
      cause: cause || null,
      area: area || null,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
    })
    .returning();

  const full = await db.query.breakdowns.findFirst({
    where: eq(breakdowns.id, breakdown.id),
    with: {
      asset: true,
      site: true,
      reportedBy: true,
    },
  });

  res.status(201).json({
    ...full,
    asset: full?.asset
      ? { id: full.asset.id, name: full.asset.name, plantId: full.asset.plantId }
      : null,
    site: full?.site
      ? { id: full.site.id, name: full.site.name, code: full.site.code }
      : null,
    reportedBy: full?.reportedBy
      ? { id: full.reportedBy.id, name: full.reportedBy.name }
      : null,
  });
});

router.put("/:id/resolve", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { resolution, cause, manHours, partsCost, resolvedAt: resolvedAtInput } = req.body;

  const breakdown = await db.query.breakdowns.findFirst({
    where: eq(breakdowns.id, req.params.id),
  });
  if (!breakdown) {
    res.status(404).json({ error: "Breakdown not found" });
    return;
  }

  const resolvedAt = resolvedAtInput ? new Date(resolvedAtInput) : new Date();
  const durationMinutes = Math.round(
    (resolvedAt.getTime() - new Date(breakdown.startedAt).getTime()) / 60000,
  );

  await db
    .update(breakdowns)
    .set({
      resolvedAt,
      durationMinutes,
      resolution: resolution || null,
      cause: cause || breakdown.cause,
      manHours: manHours != null ? parseFloat(manHours) : null,
      partsCost: partsCost != null ? parseFloat(partsCost) : null,
    })
    .where(eq(breakdowns.id, req.params.id));

  const full = await db.query.breakdowns.findFirst({
    where: eq(breakdowns.id, req.params.id),
    with: {
      asset: true,
      site: true,
      reportedBy: true,
    },
  });

  res.json({
    ...full,
    asset: full?.asset
      ? { id: full.asset.id, name: full.asset.name, plantId: full.asset.plantId }
      : null,
    site: full?.site
      ? { id: full.site.id, name: full.site.name, code: full.site.code }
      : null,
    reportedBy: full?.reportedBy
      ? { id: full.reportedBy.id, name: full.reportedBy.name }
      : null,
  });
});

export default router;
