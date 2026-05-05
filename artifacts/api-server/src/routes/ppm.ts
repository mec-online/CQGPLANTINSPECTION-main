import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { ppmSchedules, ppmCompletions, assets } from "@workspace/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

async function fetchScheduleWithRelations(id: string) {
  return db.query.ppmSchedules.findFirst({
    where: eq(ppmSchedules.id, id),
    with: {
      asset: {
        with: {
          site: true,
        },
      },
      template: true,
      completions: {
        orderBy: desc(ppmCompletions.completedAt),
        limit: 3,
        with: {
          completedBy: true,
        },
      },
    },
  });
}

function formatSchedule(s: NonNullable<Awaited<ReturnType<typeof fetchScheduleWithRelations>>>) {
  return {
    ...s,
    asset: s.asset
      ? {
          id: s.asset.id,
          name: s.asset.name,
          plantId: s.asset.plantId,
          site: s.asset.site
            ? { id: s.asset.site.id, name: s.asset.site.name, code: s.asset.site.code }
            : null,
        }
      : null,
    template: s.template
      ? { id: s.template.id, name: s.template.name, type: s.template.type }
      : null,
    completions: s.completions.map((c) => ({
      ...c,
      completedBy: c.completedBy ? { id: c.completedBy.id, name: c.completedBy.name } : null,
    })),
  };
}

router.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId } = req.query;

  // We need to filter by asset.siteId which requires a join approach
  // Use relational query and filter in app
  const schedules = await db.query.ppmSchedules.findMany({
    with: {
      asset: {
        with: {
          site: true,
        },
      },
      template: true,
      completions: {
        orderBy: desc(ppmCompletions.completedAt),
        limit: 3,
        with: {
          completedBy: true,
        },
      },
    },
    orderBy: asc(ppmSchedules.nextDueAt),
  });

  // Filter by site
  let filtered = schedules;
  const effectiveSiteId =
    siteId as string | undefined ??
    ((req.user!.role === "OPERATOR" || req.user!.role === "SITE_MANAGER") && req.user!.siteId
      ? req.user!.siteId
      : undefined);

  if (effectiveSiteId) {
    filtered = schedules.filter((s) => s.asset?.site?.id === effectiveSiteId);
  }

  res.json(filtered.map((s) => formatSchedule(s as NonNullable<typeof s>)));
});

router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!["ADMIN", "SITE_MANAGER"].includes(req.user!.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { assetId, templateId, taskName, description, frequency, nextDueAt, notes } = req.body;

  if (!assetId || !taskName || !frequency || !nextDueAt) {
    res.status(400).json({ error: "assetId, taskName, frequency and nextDueAt required" });
    return;
  }

  // SITE_MANAGER: verify asset belongs to their site
  if (req.user!.role === "SITE_MANAGER" && req.user!.siteId) {
    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    });
    if (!asset || asset.siteId !== req.user!.siteId) {
      res.status(403).json({ error: "Asset not in your site" });
      return;
    }
  }

  const [schedule] = await db
    .insert(ppmSchedules)
    .values({
      assetId,
      templateId: templateId || null,
      taskName,
      description: description || null,
      frequency,
      nextDueAt: new Date(nextDueAt),
      notes: notes || null,
    })
    .returning();

  const full = await fetchScheduleWithRelations(schedule.id);
  res.status(201).json(formatSchedule(full!));
});

router.put("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!["ADMIN", "SITE_MANAGER"].includes(req.user!.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { templateId, taskName, description, frequency, nextDueAt, notes } = req.body;

  const existing = await db.query.ppmSchedules.findFirst({
    where: eq(ppmSchedules.id, req.params.id),
    with: { asset: true },
  });
  if (!existing) {
    res.status(404).json({ error: "PPM schedule not found" });
    return;
  }

  if (
    req.user!.role === "SITE_MANAGER" &&
    req.user!.siteId &&
    existing.asset?.siteId !== req.user!.siteId
  ) {
    res.status(403).json({ error: "Not your site" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (templateId !== undefined) updateData.templateId = templateId || null;
  if (taskName) updateData.taskName = taskName;
  if (description !== undefined) updateData.description = description || null;
  if (frequency) updateData.frequency = frequency;
  if (nextDueAt) updateData.nextDueAt = new Date(nextDueAt);
  if (notes !== undefined) updateData.notes = notes || null;

  await db
    .update(ppmSchedules)
    .set(updateData)
    .where(eq(ppmSchedules.id, req.params.id));

  const full = await fetchScheduleWithRelations(req.params.id);
  res.json(formatSchedule(full!));
});

router.delete("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!["ADMIN", "SITE_MANAGER"].includes(req.user!.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const existing = await db.query.ppmSchedules.findFirst({
    where: eq(ppmSchedules.id, req.params.id),
    with: { asset: true },
  });
  if (!existing) {
    res.status(404).json({ error: "PPM schedule not found" });
    return;
  }

  if (
    req.user!.role === "SITE_MANAGER" &&
    req.user!.siteId &&
    existing.asset?.siteId !== req.user!.siteId
  ) {
    res.status(403).json({ error: "Not your site" });
    return;
  }

  // Delete completions first, then the schedule
  await db.delete(ppmCompletions).where(eq(ppmCompletions.ppmScheduleId, req.params.id));
  await db.delete(ppmSchedules).where(eq(ppmSchedules.id, req.params.id));

  res.status(204).end();
});

router.post("/:id/complete", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { notes } = req.body;

  const schedule = await db.query.ppmSchedules.findFirst({
    where: eq(ppmSchedules.id, req.params.id),
  });
  if (!schedule) {
    res.status(404).json({ error: "PPM schedule not found" });
    return;
  }

  const [completion] = await db
    .insert(ppmCompletions)
    .values({
      ppmScheduleId: req.params.id,
      completedById: req.user!.id,
      notes: notes || null,
    })
    .returning();

  // Calculate next due date
  const now = new Date();
  const nextDueAt = new Date(now);

  switch (schedule.frequency) {
    case "DAILY":
      nextDueAt.setDate(nextDueAt.getDate() + 1);
      break;
    case "WEEKLY":
      nextDueAt.setDate(nextDueAt.getDate() + 7);
      break;
    case "MONTHLY":
      nextDueAt.setMonth(nextDueAt.getMonth() + 1);
      break;
    case "QUARTERLY":
      nextDueAt.setMonth(nextDueAt.getMonth() + 3);
      break;
    case "ANNUAL":
      nextDueAt.setFullYear(nextDueAt.getFullYear() + 1);
      break;
  }

  await db
    .update(ppmSchedules)
    .set({ lastCompletedAt: now, nextDueAt })
    .where(eq(ppmSchedules.id, req.params.id));

  res.status(201).json(completion);
});

export default router;
