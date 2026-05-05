import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  assets,
  sites,
  areas,
  assetMovements,
  inspections,
  workOrders,
  breakdowns,
  ppmSchedules,
  ppmCompletions,
} from "@workspace/db/schema";
import { eq, and, or, asc, desc, count, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId, isActive } = req.query;

  // Build conditions
  const conditions: (ReturnType<typeof eq>)[] = [];
  if (siteId) conditions.push(eq(assets.siteId, siteId as string));
  if (isActive !== undefined) conditions.push(eq(assets.isActive, isActive === "true"));

  // Operators and site managers see their own site plus all mobile assets
  if (
    (req.user!.role === "OPERATOR" || req.user!.role === "SITE_MANAGER") &&
    req.user!.siteId
  ) {
    conditions.push(
      or(eq(assets.siteId, req.user!.siteId), eq(assets.isMobile, true))!,
    );
  }

  const result = await db.query.assets.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      site: true,
      area: true,
      movements: {
        orderBy: desc(assetMovements.movedAt),
        limit: 1,
        with: {
          toSite: true,
        },
      },
    },
    orderBy: asc(assets.name),
  });

  const enriched = result.map((a) => ({
    id: a.id,
    name: a.name,
    plantId: a.plantId,
    serialNumber: a.serialNumber,
    manufacturer: a.manufacturer,
    model: a.model,
    criticality: a.criticality,
    isMobile: a.isMobile,
    isActive: a.isActive,
    site: a.site ? { id: a.site.id, name: a.site.name, code: a.site.code } : null,
    area: a.area ? { id: a.area.id, name: a.area.name } : null,
    currentSite: a.movements?.[0]?.toSite
      ? { name: a.movements[0].toSite.name, code: a.movements[0].toSite.code }
      : null,
  }));

  res.json(enriched);
});

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "SITE_MANAGER"),
  async (req: Request, res: Response): Promise<void> => {
    let {
      siteId,
      areaId,
      name,
      plantId,
      serialNumber,
      manufacturer,
      model,
      installDate,
      criticality,
      isMobile,
      notes,
    } = req.body;

    // SITE_MANAGER can only create assets for their own site
    if (req.user!.role === "SITE_MANAGER" && req.user!.siteId) {
      siteId = req.user!.siteId;
    }

    if (!siteId || !name) {
      res.status(400).json({ error: "siteId and name required" });
      return;
    }

    const [asset] = await db
      .insert(assets)
      .values({
        siteId,
        areaId: areaId || null,
        name,
        plantId: plantId || null,
        serialNumber: serialNumber || null,
        manufacturer: manufacturer || null,
        model: model || null,
        installDate: installDate ? new Date(installDate) : null,
        criticality: criticality || "MEDIUM",
        isMobile: isMobile || false,
        notes: notes || null,
      })
      .returning();

    const full = await db.query.assets.findFirst({
      where: eq(assets.id, asset.id),
      with: {
        site: true,
        area: true,
      },
    });

    res.status(201).json({
      ...full,
      site: full?.site ? { id: full.site.id, name: full.site.name, code: full.site.code } : null,
      area: full?.area ? { id: full.area.id, name: full.area.name } : null,
    });
  },
);

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "SITE_MANAGER"),
  async (req: Request, res: Response): Promise<void> => {
    const {
      name,
      areaId,
      plantId,
      serialNumber,
      manufacturer,
      model,
      installDate,
      criticality,
      isMobile,
      isActive: isActiveVal,
      notes,
    } = req.body;

    await db
      .update(assets)
      .set({
        name,
        areaId: areaId || null,
        plantId: plantId || null,
        serialNumber: serialNumber || null,
        manufacturer: manufacturer || null,
        model: model || null,
        installDate: installDate ? new Date(installDate) : null,
        criticality,
        isMobile,
        isActive: isActiveVal,
        notes: notes || null,
      })
      .where(eq(assets.id, req.params.id));

    const full = await db.query.assets.findFirst({
      where: eq(assets.id, req.params.id),
      with: {
        site: true,
        area: true,
      },
    });

    res.json({
      ...full,
      site: full?.site ? { id: full.site.id, name: full.site.name, code: full.site.code } : null,
      area: full?.area ? { id: full.area.id, name: full.area.name } : null,
    });
  },
);

router.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, req.params.id),
    with: {
      site: true,
      area: true,
      ppmSchedules: {
        with: {
          completions: true,
        },
      },
    },
  });

  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  // Enrich PPM schedules with completion count
  const enriched = {
    ...asset,
    site: asset.site ? { id: asset.site.id, name: asset.site.name, code: asset.site.code } : null,
    area: asset.area ? { id: asset.area.id, name: asset.area.name } : null,
    ppmSchedules: asset.ppmSchedules.map((s) => ({
      ...s,
      completions: undefined,
      _count: { completions: s.completions.length },
    })),
  };

  res.json(enriched);
});

router.get("/:id/history", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const assetId = req.params.id;

  const [inspectionsList, workOrdersList, breakdownsList, movementsList] = await Promise.all([
    db.query.inspections.findMany({
      where: eq(inspections.assetId, assetId),
      with: {
        template: true,
        completedBy: true,
      },
      orderBy: desc(inspections.startedAt),
      limit: 50,
    }),
    db.query.workOrders.findMany({
      where: eq(workOrders.assetId, assetId),
      with: {
        createdBy: true,
        assignedTo: true,
      },
      orderBy: desc(workOrders.createdAt),
      limit: 50,
    }),
    db.query.breakdowns.findMany({
      where: eq(breakdowns.assetId, assetId),
      with: {
        reportedBy: true,
      },
      orderBy: desc(breakdowns.startedAt),
      limit: 20,
    }),
    db.query.assetMovements.findMany({
      where: eq(assetMovements.assetId, assetId),
      with: {
        toSite: true,
        movedBy: true,
      },
      orderBy: desc(assetMovements.movedAt),
      limit: 20,
    }),
  ]);

  res.json({
    inspections: inspectionsList.map((i) => ({
      id: i.id,
      startedAt: i.startedAt,
      completedAt: i.completedAt,
      status: i.status,
      overallResult: i.overallResult,
      template: i.template ? { name: i.template.name, type: i.template.type } : null,
      completedBy: i.completedBy ? { name: i.completedBy.name } : null,
    })),
    workOrders: workOrdersList.map((wo) => ({
      id: wo.id,
      title: wo.title,
      priority: wo.priority,
      status: wo.status,
      createdAt: wo.createdAt,
      completedAt: wo.completedAt,
      createdBy: wo.createdBy ? { name: wo.createdBy.name } : null,
      assignedTo: wo.assignedTo ? { name: wo.assignedTo.name } : null,
    })),
    breakdowns: breakdownsList.map((b) => ({
      id: b.id,
      startedAt: b.startedAt,
      resolvedAt: b.resolvedAt,
      durationMinutes: b.durationMinutes,
      description: b.description,
      cause: b.cause,
      reportedBy: b.reportedBy ? { name: b.reportedBy.name } : null,
    })),
    movements: movementsList.map((m) => ({
      id: m.id,
      movedAt: m.movedAt,
      fromSiteId: m.fromSiteId,
      site: m.toSite ? { name: m.toSite.name, code: m.toSite.code } : null,
      movedBy: m.movedBy ? { name: m.movedBy.name } : null,
      notes: m.notes,
    })),
  });
});

export default router;
