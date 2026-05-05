import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  inspections,
  inspectionAnswers,
  sites,
  workOrders,
  breakdowns,
  ppmCompletions,
  ppmSchedules,
  assets,
  templateQuestions,
} from "@workspace/db/schema";
import { eq, and, gte, lte, desc, asc, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/compliance", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId, from, to } = req.query;

  const startDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = to ? new Date(to as string) : new Date();

  const conditions: (ReturnType<typeof eq>)[] = [
    gte(inspections.startedAt, startDate),
    lte(inspections.startedAt, endDate),
  ];
  if (siteId) conditions.push(eq(inspections.siteId, siteId as string));

  const [allSites, allInspections] = await Promise.all([
    siteId
      ? db.query.sites.findMany({ where: eq(sites.id, siteId as string) })
      : db.query.sites.findMany({ where: eq(sites.isActive, true) }),
    db.query.inspections.findMany({
      where: and(...conditions),
      with: {
        template: true,
      },
    }),
  ]);

  const bySite = allSites.map((site) => {
    const siteInspections = allInspections.filter((i) => i.siteId === site.id);
    const completed = siteInspections.filter((i) => i.status === "COMPLETED");
    const passed = completed.filter((i) => i.overallResult === "PASS");
    const failed = completed.filter((i) => i.overallResult === "FAIL");
    const monitored = completed.filter((i) => i.overallResult === "MONITOR");

    return {
      site: { id: site.id, name: site.name, code: site.code },
      total: siteInspections.length,
      completed: completed.length,
      passed: passed.length,
      failed: failed.length,
      monitored: monitored.length,
      complianceRate:
        completed.length > 0
          ? Math.round((passed.length / completed.length) * 100)
          : null,
    };
  });

  res.json({ period: { from: startDate, to: endDate }, bySite });
});

router.get("/failures", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId, from, to } = req.query;

  const startDate = from
    ? new Date(from as string)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const endDate = to ? new Date(to as string) : new Date();

  const answerConditions: (ReturnType<typeof eq>)[] = [
    eq(inspectionAnswers.result, "FAIL"),
    gte(inspectionAnswers.answeredAt, startDate),
    lte(inspectionAnswers.answeredAt, endDate),
  ];

  const failedAnswers = await db.query.inspectionAnswers.findMany({
    where: and(...answerConditions),
    with: {
      question: true,
      inspection: {
        with: {
          asset: true,
          site: true,
        },
      },
    },
  });

  // Filter by siteId if specified
  const filtered = siteId
    ? failedAnswers.filter((a) => a.inspection?.siteId === siteId)
    : failedAnswers;

  const woConditions: (ReturnType<typeof eq>)[] = [
    gte(workOrders.createdAt, startDate),
    lte(workOrders.createdAt, endDate),
  ];
  if (siteId) woConditions.push(eq(workOrders.siteId, siteId as string));

  const allWorkOrders = await db.query.workOrders.findMany({
    where: and(...woConditions),
    columns: { id: true, inspectionAnswerId: true, assetId: true },
  });

  // Group by asset
  type AssetEntry = {
    assetId: string;
    assetName: string;
    plantId: string | null;
    siteCode: string;
    failCount: number;
    workOrderCount: number;
    questionCounts: Record<string, number>;
  };
  const byAsset: Record<string, AssetEntry> = {};

  for (const answer of filtered) {
    const assetId = answer.inspection?.assetId || "no-asset";
    if (!byAsset[assetId]) {
      byAsset[assetId] = {
        assetId,
        assetName: answer.inspection?.asset?.name || "Unknown",
        plantId: answer.inspection?.asset?.plantId || null,
        siteCode: answer.inspection?.site?.code || "",
        failCount: 0,
        workOrderCount: 0,
        questionCounts: {},
      };
    }
    byAsset[assetId].failCount++;
    const qt = answer.question?.text || "Unknown";
    byAsset[assetId].questionCounts[qt] = (byAsset[assetId].questionCounts[qt] || 0) + 1;
  }

  for (const wo of allWorkOrders) {
    const assetId = wo.assetId || "no-asset";
    if (byAsset[assetId]) byAsset[assetId].workOrderCount++;
  }

  const ranked = Object.values(byAsset)
    .sort((a, b) => b.failCount - a.failCount)
    .slice(0, 20)
    .map(({ questionCounts, ...rest }) => ({
      ...rest,
      questions: Object.entries(questionCounts)
        .map(([text, cnt]) => ({ text, count: cnt }))
        .sort((a, b) => b.count - a.count),
    }));

  res.json(ranked);
});

router.get("/work-orders", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId, from, to } = req.query;

  const startDate = from
    ? new Date(from as string)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = to ? new Date(to as string) : new Date();

  const conditions: (ReturnType<typeof eq>)[] = [
    gte(workOrders.createdAt, startDate),
    lte(workOrders.createdAt, endDate),
  ];
  if (siteId) conditions.push(eq(workOrders.siteId, siteId as string));

  const now = new Date();

  const [allWorkOrders, allSites] = await Promise.all([
    db.query.workOrders.findMany({
      where: and(...conditions),
      with: {
        site: true,
      },
    }),
    siteId
      ? db.query.sites.findMany({ where: eq(sites.id, siteId as string) })
      : db.query.sites.findMany({ where: eq(sites.isActive, true) }),
  ]);

  const isOverdue = (wo: { status: string; createdAt: Date }) =>
    ["OPEN", "IN_PROGRESS", "WAITING_PARTS"].includes(wo.status) &&
    now.getTime() - new Date(wo.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000;

  const summary = {
    total: allWorkOrders.length,
    open: allWorkOrders.filter((w) => w.status === "OPEN").length,
    inProgress: allWorkOrders.filter((w) => w.status === "IN_PROGRESS").length,
    waitingParts: allWorkOrders.filter((w) => w.status === "WAITING_PARTS").length,
    completed: allWorkOrders.filter((w) => w.status === "COMPLETED").length,
    verified: allWorkOrders.filter((w) => w.status === "VERIFIED").length,
    overdue: allWorkOrders.filter(isOverdue).length,
  };

  const bySite = allSites.map((site) => {
    const siteWOs = allWorkOrders.filter((w) => w.siteId === site.id);
    return {
      siteCode: site.code,
      siteName: site.name,
      open: siteWOs.filter((w) => w.status === "OPEN").length,
      inProgress: siteWOs.filter((w) => w.status === "IN_PROGRESS").length,
      completed: siteWOs.filter(
        (w) => w.status === "COMPLETED" || w.status === "VERIFIED",
      ).length,
      overdue: siteWOs.filter(isOverdue).length,
    };
  });

  const priorityCounts: Record<string, number> = {};
  for (const wo of allWorkOrders.filter((w) =>
    ["OPEN", "IN_PROGRESS", "WAITING_PARTS"].includes(w.status),
  )) {
    priorityCounts[wo.priority] = (priorityCounts[wo.priority] || 0) + 1;
  }
  const byPriority = Object.entries(priorityCounts).map(([priority, cnt]) => ({
    priority,
    count: cnt,
  }));

  res.json({ period: { from: startDate, to: endDate }, summary, bySite, byPriority });
});

router.get("/audit", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { type, siteId, assetId, from, to } = req.query;

  // Role-based site scoping
  const effectiveSiteId =
    req.user!.role === "OPERATOR" || req.user!.role === "SITE_MANAGER"
      ? req.user!.siteId
      : (siteId as string | undefined);

  const startDate = from
    ? new Date(from as string)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const endDate = to ? new Date(to as string) : new Date();
  const types = type
    ? (type as string).split(",")
    : ["INSPECTION", "WORK_ORDER", "BREAKDOWN", "PPM"];

  const results: Array<{
    id: string;
    type: string;
    title: string;
    assetName: string | null;
    siteName: string;
    siteCode: string;
    dueDate: string | null;
    completedAt: string | null;
    status: string;
    daysToClose: number | null;
    isOverdue: boolean;
    priority?: string;
    manHours?: number | null;
    partsCost?: number | null;
  }> = [];

  // INSPECTIONS
  if (types.includes("INSPECTION")) {
    const conditions: (ReturnType<typeof eq>)[] = [
      gte(inspections.startedAt, startDate),
      lte(inspections.startedAt, endDate),
    ];
    if (effectiveSiteId) conditions.push(eq(inspections.siteId, effectiveSiteId));
    if (assetId) conditions.push(eq(inspections.assetId, assetId as string));

    const rows = await db.query.inspections.findMany({
      where: and(...conditions),
      with: {
        template: true,
        asset: true,
        site: true,
      },
      orderBy: desc(inspections.startedAt),
      limit: 500,
    });

    for (const i of rows) {
      const daysToClose = i.completedAt
        ? Math.round(
            ((new Date(i.completedAt).getTime() - new Date(i.startedAt).getTime()) /
              (1000 * 60 * 60 * 24)) *
              10,
          ) / 10
        : null;
      results.push({
        id: i.id,
        type: "INSPECTION",
        title: `${i.template?.name ?? "Unknown"} (${i.template?.type ?? ""})`,
        assetName: i.asset?.name || null,
        siteName: i.site?.name ?? "",
        siteCode: i.site?.code ?? "",
        dueDate: new Date(i.startedAt).toISOString(),
        completedAt: i.completedAt ? new Date(i.completedAt).toISOString() : null,
        status:
          i.status === "COMPLETED" ? i.overallResult || "COMPLETED" : i.status,
        daysToClose,
        isOverdue: i.status === "IN_PROGRESS",
      });
    }
  }

  // WORK ORDERS
  if (types.includes("WORK_ORDER")) {
    const conditions: (ReturnType<typeof eq>)[] = [
      gte(workOrders.createdAt, startDate),
      lte(workOrders.createdAt, endDate),
    ];
    if (effectiveSiteId) conditions.push(eq(workOrders.siteId, effectiveSiteId));
    if (assetId) conditions.push(eq(workOrders.assetId, assetId as string));

    const wos = await db.query.workOrders.findMany({
      where: and(...conditions),
      with: {
        asset: true,
        site: true,
      },
      orderBy: desc(workOrders.createdAt),
      limit: 500,
    });

    for (const wo of wos) {
      const refDate = wo.dueDate || wo.createdAt;
      const closeDate = wo.completedAt;
      const daysToClose = closeDate
        ? Math.round(
            ((new Date(closeDate).getTime() - new Date(wo.createdAt).getTime()) /
              (1000 * 60 * 60 * 24)) *
              10,
          ) / 10
        : null;
      const isOvd =
        !["COMPLETED", "VERIFIED"].includes(wo.status) && wo.dueDate
          ? new Date(wo.dueDate) < new Date()
          : false;
      results.push({
        id: wo.id,
        type: "WORK_ORDER",
        title: wo.title,
        assetName: wo.asset?.name || null,
        siteName: wo.site?.name ?? "",
        siteCode: wo.site?.code ?? "",
        dueDate: new Date(refDate).toISOString(),
        completedAt: closeDate ? new Date(closeDate).toISOString() : null,
        status: wo.status,
        priority: wo.priority,
        daysToClose,
        isOverdue: isOvd,
      });
    }
  }

  // BREAKDOWNS
  if (types.includes("BREAKDOWN")) {
    const conditions: (ReturnType<typeof eq>)[] = [
      gte(breakdowns.startedAt, startDate),
      lte(breakdowns.startedAt, endDate),
    ];
    if (effectiveSiteId) conditions.push(eq(breakdowns.siteId, effectiveSiteId));
    if (assetId) conditions.push(eq(breakdowns.assetId, assetId as string));

    const rows = await db.query.breakdowns.findMany({
      where: and(...conditions),
      with: {
        asset: true,
        site: true,
      },
      orderBy: desc(breakdowns.startedAt),
      limit: 500,
    });

    for (const b of rows) {
      const daysToClose =
        b.durationMinutes != null
          ? Math.round((b.durationMinutes / 1440) * 10) / 10
          : null;
      results.push({
        id: b.id,
        type: "BREAKDOWN",
        title: b.description.slice(0, 80),
        assetName: b.asset?.name || null,
        siteName: b.site?.name ?? "",
        siteCode: b.site?.code ?? "",
        dueDate: new Date(b.startedAt).toISOString(),
        completedAt: b.resolvedAt ? new Date(b.resolvedAt).toISOString() : null,
        status: b.resolvedAt ? "RESOLVED" : "OPEN",
        daysToClose,
        isOverdue: !b.resolvedAt,
        manHours: b.manHours,
        partsCost: b.partsCost,
      });
    }
  }

  // PPM COMPLETIONS
  if (types.includes("PPM")) {
    const ppmConditions: (ReturnType<typeof eq>)[] = [
      gte(ppmCompletions.completedAt, startDate),
      lte(ppmCompletions.completedAt, endDate),
    ];

    const completions = await db.query.ppmCompletions.findMany({
      where: and(...ppmConditions),
      with: {
        completedBy: true,
        schedule: {
          with: {
            asset: {
              with: {
                site: true,
              },
            },
          },
        },
      },
      orderBy: desc(ppmCompletions.completedAt),
      limit: 500,
    });

    const filteredCompletions = completions.filter((c) => {
      if (effectiveSiteId && c.schedule?.asset?.site?.id !== effectiveSiteId) return false;
      if (assetId) return false; // can't filter by assetId easily here
      return true;
    });

    for (const c of filteredCompletions) {
      results.push({
        id: c.id,
        type: "PPM",
        title: c.schedule?.taskName ?? "PPM Task",
        assetName: c.schedule?.asset?.name ?? null,
        siteName: c.schedule?.asset?.site?.name ?? "",
        siteCode: c.schedule?.asset?.site?.code ?? "",
        dueDate: null,
        completedAt: new Date(c.completedAt).toISOString(),
        status: "COMPLETED",
        daysToClose: 0,
        isOverdue: false,
      });
    }
  }

  // Sort by dueDate desc (nulls last)
  results.sort((a, b) => {
    const da = a.dueDate || a.completedAt || "";
    const db_ = b.dueDate || b.completedAt || "";
    return db_.localeCompare(da);
  });

  // Summary stats
  const closed = results.filter((r) => r.completedAt);
  const openOverdue = results.filter((r) => r.isOverdue);
  const closedDays = closed
    .filter((r) => r.daysToClose != null)
    .map((r) => r.daysToClose!);
  const avgDaysToClose =
    closedDays.length > 0
      ? Math.round(
          (closedDays.reduce((a, b) => a + b, 0) / closedDays.length) * 10,
        ) / 10
      : null;

  res.json({
    items: results,
    total: results.length,
    summary: {
      total: results.length,
      closed: closed.length,
      openOrOverdue: openOverdue.length,
      avgDaysToClose,
      pctClosed:
        results.length > 0
          ? Math.round((closed.length / results.length) * 100)
          : null,
    },
    period: { from: startDate, to: endDate },
  });
});

router.get("/breakdowns", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId, from, to } = req.query;

  const startDate = from
    ? new Date(from as string)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = to ? new Date(to as string) : new Date();

  const conditions: (ReturnType<typeof eq>)[] = [
    gte(breakdowns.startedAt, startDate),
    lte(breakdowns.startedAt, endDate),
  ];
  if (siteId) conditions.push(eq(breakdowns.siteId, siteId as string));

  const allBreakdowns = await db.query.breakdowns.findMany({
    where: and(...conditions),
    with: {
      asset: true,
      site: true,
    },
  });

  const totalDowntimeMinutes = allBreakdowns.reduce(
    (sum, b) => sum + (b.durationMinutes || 0),
    0,
  );
  const resolved = allBreakdowns.filter((b) => b.resolvedAt);
  const avgDurationMinutes =
    resolved.length > 0 ? Math.round(totalDowntimeMinutes / resolved.length) : null;

  const byCause = allBreakdowns.reduce(
    (acc: Record<string, number>, b) => {
      const cause = b.cause || "Unknown";
      acc[cause] = (acc[cause] || 0) + 1;
      return acc;
    },
    {},
  );

  res.json({
    period: { from: startDate, to: endDate },
    total: allBreakdowns.length,
    resolved: resolved.length,
    totalDowntimeMinutes,
    avgDurationMinutes,
    byCause,
  });
});

export default router;
