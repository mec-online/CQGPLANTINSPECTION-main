import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sites, areas, assets, inspections, workOrders } from "@workspace/db/schema";
import { eq, count, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const allSites = await db.query.sites.findMany({
    where: eq(sites.isActive, true),
    with: {
      areas: true,
    },
    orderBy: asc(sites.name),
  });

  // Get counts per site
  const assetCounts = await db
    .select({ siteId: assets.siteId, count: count() })
    .from(assets)
    .groupBy(assets.siteId);
  const inspectionCounts = await db
    .select({ siteId: inspections.siteId, count: count() })
    .from(inspections)
    .groupBy(inspections.siteId);
  const woCounts = await db
    .select({ siteId: workOrders.siteId, count: count() })
    .from(workOrders)
    .groupBy(workOrders.siteId);

  const assetMap = Object.fromEntries(assetCounts.map((r) => [r.siteId, r.count]));
  const inspMap = Object.fromEntries(inspectionCounts.map((r) => [r.siteId, r.count]));
  const woMap = Object.fromEntries(woCounts.map((r) => [r.siteId, r.count]));

  const enriched = allSites.map((s) => ({
    ...s,
    _count: {
      assets: assetMap[s.id] ?? 0,
      inspections: inspMap[s.id] ?? 0,
      workOrders: woMap[s.id] ?? 0,
    },
  }));

  res.json(enriched);
});

router.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const site = await db.query.sites.findFirst({
    where: eq(sites.id, req.params.id),
    with: {
      areas: true,
    },
  });

  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  const [assetCount] = await db
    .select({ count: count() })
    .from(assets)
    .where(eq(assets.siteId, req.params.id));
  const [inspCount] = await db
    .select({ count: count() })
    .from(inspections)
    .where(eq(inspections.siteId, req.params.id));
  const [woCount] = await db
    .select({ count: count() })
    .from(workOrders)
    .where(eq(workOrders.siteId, req.params.id));

  res.json({
    ...site,
    _count: {
      assets: assetCount?.count ?? 0,
      inspections: inspCount?.count ?? 0,
      workOrders: woCount?.count ?? 0,
    },
  });
});

router.get("/:id/areas", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const result = await db
    .select()
    .from(areas)
    .where(eq(areas.siteId, req.params.id))
    .orderBy(asc(areas.name));

  res.json(result);
});

router.get("/:id/assets", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const result = await db.query.assets.findMany({
    where: (a, { eq: e, and }) => and(e(a.siteId, req.params.id), e(a.isActive, true)),
    with: {
      area: true,
    },
    orderBy: asc(assets.name),
  });

  // Get counts per asset
  const assetIds = result.map((a) => a.id);
  const woCounts = assetIds.length
    ? await db
        .select({ assetId: workOrders.assetId, count: count() })
        .from(workOrders)
        .where(
          assetIds.length === 1
            ? eq(workOrders.assetId, assetIds[0])
            : undefined as never,
        )
        .groupBy(workOrders.assetId)
    : [];
  const inspCounts = assetIds.length
    ? await db
        .select({ assetId: inspections.assetId, count: count() })
        .from(inspections)
        .where(
          assetIds.length === 1
            ? eq(inspections.assetId, assetIds[0])
            : undefined as never,
        )
        .groupBy(inspections.assetId)
    : [];

  const woMap = Object.fromEntries(woCounts.map((r) => [r.assetId, r.count]));
  const inspMap = Object.fromEntries(inspCounts.map((r) => [r.assetId, r.count]));

  const enriched = result.map((a) => ({
    ...a,
    area: a.area ? { id: a.area.id, name: a.area.name } : null,
    _count: {
      workOrders: woMap[a.id] ?? 0,
      inspections: inspMap[a.id] ?? 0,
    },
  }));

  res.json(enriched);
});

export default router;
