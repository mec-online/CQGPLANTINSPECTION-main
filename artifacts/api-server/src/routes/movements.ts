import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { assetMovements, assets } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { assetId, fromSiteId, toSiteId, preInspectionId, notes } = req.body;

  if (!assetId || !toSiteId) {
    res.status(400).json({ error: "assetId and toSiteId required" });
    return;
  }

  const [movement] = await db
    .insert(assetMovements)
    .values({
      assetId,
      fromSiteId: fromSiteId || null,
      toSiteId,
      movedById: req.user!.id,
      preInspectionId: preInspectionId || null,
      notes: notes || null,
    })
    .returning();

  const full = await db.query.assetMovements.findFirst({
    where: eq(assetMovements.id, movement.id),
    with: {
      asset: true,
      toSite: true,
      movedBy: true,
    },
  });

  // Update asset siteId
  await db.update(assets).set({ siteId: toSiteId }).where(eq(assets.id, assetId));

  res.status(201).json({
    ...full,
    asset: full?.asset
      ? { id: full.asset.id, name: full.asset.name, plantId: full.asset.plantId }
      : null,
    site: full?.toSite
      ? { id: full.toSite.id, name: full.toSite.name, code: full.toSite.code }
      : null,
    movedBy: full?.movedBy ? { id: full.movedBy.id, name: full.movedBy.name } : null,
  });
});

router.put("/:id/arrive", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { postInspectionId, notes } = req.body;

  const updateData: Record<string, unknown> = {};
  if (postInspectionId) updateData.postInspectionId = postInspectionId;
  if (notes) updateData.notes = notes;

  const [movement] = await db
    .update(assetMovements)
    .set(updateData)
    .where(eq(assetMovements.id, req.params.id))
    .returning();

  res.json(movement);
});

export default router;
