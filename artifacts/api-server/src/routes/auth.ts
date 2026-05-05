import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { users, sites } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      role: users.role,
      siteId: users.siteId,
      isActive: users.isActive,
      siteIdJoin: sites.id,
      siteName: sites.name,
      siteCode: sites.code,
    })
    .from(users)
    .leftJoin(sites, eq(users.siteId, sites.id))
    .where(eq(users.email, email.toLowerCase().trim()));

  const user = rows[0];

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const secret = process.env.JWT_SECRET || "changeme";
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, siteId: user.siteId },
    secret,
    { expiresIn: "8h" },
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      siteId: user.siteId,
      site: user.siteIdJoin
        ? { id: user.siteIdJoin, name: user.siteName, code: user.siteCode }
        : null,
    },
  });
});

router.get("/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      siteId: users.siteId,
      isActive: users.isActive,
      siteIdJoin: sites.id,
      siteName: sites.name,
      siteCode: sites.code,
    })
    .from(users)
    .leftJoin(sites, eq(users.siteId, sites.id))
    .where(eq(users.id, req.user!.id));

  const user = rows[0];

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    siteId: user.siteId,
    isActive: user.isActive,
    site: user.siteIdJoin
      ? { id: user.siteIdJoin, name: user.siteName, code: user.siteCode }
      : null,
  });
});

export default router;
