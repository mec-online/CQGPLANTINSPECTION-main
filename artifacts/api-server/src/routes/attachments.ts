import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { attachments, users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { upload, compressImage } from "../middlewares/upload.js";

const router = Router();

router.post(
  "/",
  requireAuth,
  upload.single("file"),
  compressImage,
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const {
      workOrderId,
      inspectionAnswerId,
      breakdownId,
      assetMovementId,
      lat,
      lng,
      capturedAt,
      deviceInfo,
    } = req.body;

    const [attachment] = await db
      .insert(attachments)
      .values({
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer,
        uploadedById: req.user!.id,
        workOrderId: workOrderId || null,
        inspectionAnswerId: inspectionAnswerId || null,
        breakdownId: breakdownId || null,
        assetMovementId: assetMovementId || null,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        capturedAt: capturedAt ? new Date(capturedAt) : null,
        deviceInfo: deviceInfo || null,
      })
      .returning();

    const full = await db.query.attachments.findFirst({
      where: eq(attachments.id, attachment.id),
      with: {
        uploadedBy: true,
      },
    });

    res.status(201).json({
      id: full!.id,
      filename: full!.filename,
      mimeType: full!.mimeType,
      size: full!.size,
      uploadedAt: full!.uploadedAt,
      uploadedBy: full?.uploadedBy
        ? { id: full.uploadedBy.id, name: full.uploadedBy.name }
        : null,
      previewUrl: `/attachments/${full!.id}`,
    });
  },
);

router.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, req.params.id),
    columns: {
      id: true,
      filename: true,
      mimeType: true,
      data: true,
    },
  });

  if (!attachment) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }

  res.setHeader("Content-Type", attachment.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${attachment.filename}"`);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(attachment.data);
});

export default router;
