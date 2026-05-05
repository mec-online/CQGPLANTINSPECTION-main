import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { assetScans, assets } from "@workspace/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

// Log a scan (any authenticated user)
router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { assetId, method, lat, lng, deviceInfo } = req.body;

  if (!assetId || !method) {
    res.status(400).json({ error: "assetId and method required" });
    return;
  }

  const [scan] = await db
    .insert(assetScans)
    .values({
      assetId,
      scannedById: req.user!.id,
      method,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      deviceInfo: deviceInfo || null,
    })
    .returning();

  const full = await db.query.assetScans.findFirst({
    where: eq(assetScans.id, scan.id),
    with: {
      asset: true,
      scannedBy: true,
    },
  });

  res.status(201).json({
    ...full,
    asset: full?.asset
      ? { id: full.asset.id, name: full.asset.name, plantId: full.asset.plantId }
      : null,
    scannedBy: full?.scannedBy
      ? { id: full.scannedBy.id, name: full.scannedBy.name }
      : null,
  });
});

// Audit log (ADMIN + SITE_MANAGER)
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "SITE_MANAGER"),
  async (req: Request, res: Response): Promise<void> => {
    const { assetId, limit = "100", offset = "0" } = req.query;

    // For SITE_MANAGER filtering we need to fetch and filter
    const allScans = await db.query.assetScans.findMany({
      where: assetId ? eq(assetScans.assetId, assetId as string) : undefined,
      with: {
        asset: {
          with: {
            site: true,
          },
        },
        scannedBy: true,
      },
      orderBy: desc(assetScans.scannedAt),
      limit: parseInt(limit as string) + parseInt(offset as string),
    });

    // SITE_MANAGER: only scans for their site's assets
    let filtered = allScans;
    if (req.user!.role === "SITE_MANAGER" && req.user!.siteId) {
      filtered = allScans.filter((s) => s.asset?.siteId === req.user!.siteId);
    }

    const offsetNum = parseInt(offset as string);
    const limitNum = parseInt(limit as string);
    const paged = filtered.slice(offsetNum, offsetNum + limitNum);

    const result = paged.map((s) => ({
      ...s,
      asset: s.asset
        ? {
            id: s.asset.id,
            name: s.asset.name,
            plantId: s.asset.plantId,
            site: s.asset.site
              ? { name: s.asset.site.name, code: s.asset.site.code }
              : null,
          }
        : null,
      scannedBy: s.scannedBy ? { id: s.scannedBy.id, name: s.scannedBy.name } : null,
    }));

    res.json({ scans: result, total: filtered.length });
  },
);

export default router;
