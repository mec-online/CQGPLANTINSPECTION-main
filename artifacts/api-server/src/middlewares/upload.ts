import multer from "multer";
import sharp from "sharp";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

export async function compressImage(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.file) {
    next();
    return;
  }

  try {
    const compressed = await sharp(req.file.buffer)
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    req.file.buffer = compressed;
    req.file.mimetype = "image/jpeg";
    req.file.size = compressed.length;
  } catch {
    logger.warn("Image compression failed, passing through original buffer");
  }

  next();
}
