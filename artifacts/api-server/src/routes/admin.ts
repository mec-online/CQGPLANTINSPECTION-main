import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { users, sites, appSettings } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

// Users
router.get(
  "/users",
  requireAuth,
  requireRole("ADMIN", "SITE_MANAGER"),
  async (req: Request, res: Response): Promise<void> => {
    const conditions: (ReturnType<typeof eq>)[] = [];
    if (req.user!.role === "SITE_MANAGER" && req.user!.siteId) {
      conditions.push(eq(users.siteId, req.user!.siteId));
    }

    const rows = await db.query.users.findMany({
      where: conditions.length > 0 ? conditions[0] : undefined,
      with: {
        site: true,
      },
      orderBy: asc(users.name),
    });

    const result = rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      siteId: u.siteId,
      isActive: u.isActive,
      site: u.site ? { id: u.site.id, name: u.site.name, code: u.site.code } : null,
    }));

    res.json(result);
  },
);

router.post(
  "/users",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    const { name, email, password, role, siteId } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({ error: "name, email, password and role required" });
      return;
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        siteId: siteId || null,
        isActive: true,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        siteId: users.siteId,
        isActive: users.isActive,
      });

    res.status(201).json(user);
  },
);

router.put(
  "/users/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    const { name, email, password, role, siteId, isActive } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (role) updateData.role = role;
    if (siteId !== undefined) updateData.siteId = siteId || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, req.params.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        siteId: users.siteId,
        isActive: users.isActive,
      });

    res.json(user);
  },
);

// Settings
router.get("/settings", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const settings = await db.select().from(appSettings);
  res.json(settings);
});

router.put(
  "/settings/:key",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    const { value } = req.body;

    const [setting] = await db
      .insert(appSettings)
      .values({
        key: req.params.key,
        value,
        updatedById: req.user!.id,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedById: req.user!.id },
      })
      .returning();

    res.json(setting);
  },
);

export default router;
