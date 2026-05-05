import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  inspectionTemplates,
  templateSections,
  templateQuestions,
  inspections,
} from "@workspace/db/schema";
import { eq, and, or, asc, isNull, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const conditions: (ReturnType<typeof eq>)[] = [eq(inspectionTemplates.isActive, true)];

  if (
    (user.role === "SITE_MANAGER" || user.role === "OPERATOR") &&
    user.siteId
  ) {
    conditions.push(
      or(isNull(inspectionTemplates.siteId), eq(inspectionTemplates.siteId, user.siteId))!,
    );
  }

  const templates = await db.query.inspectionTemplates.findMany({
    where: and(...conditions),
    with: {
      sections: {
        orderBy: asc(templateSections.order),
        with: {
          questions: {
            orderBy: asc(templateQuestions.order),
          },
        },
      },
    },
    orderBy: asc(inspectionTemplates.name),
  });

  // Get inspection counts
  const inspCounts = await db
    .select({ templateId: inspections.templateId, count: count() })
    .from(inspections)
    .groupBy(inspections.templateId);
  const inspMap = Object.fromEntries(inspCounts.map((r) => [r.templateId, r.count]));

  const enriched = templates.map((t) => ({
    ...t,
    _count: { inspections: inspMap[t.id] ?? 0 },
  }));

  res.json(enriched);
});

router.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const template = await db.query.inspectionTemplates.findFirst({
    where: eq(inspectionTemplates.id, req.params.id),
    with: {
      sections: {
        orderBy: asc(templateSections.order),
        with: {
          questions: {
            orderBy: asc(templateQuestions.order),
          },
        },
      },
    },
  });

  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  res.json(template);
});

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "SITE_MANAGER"),
  async (req: Request, res: Response): Promise<void> => {
    const { name, type, sections } = req.body;
    let { siteId } = req.body;

    if (!name || !type) {
      res.status(400).json({ error: "name and type required" });
      return;
    }

    // SITE_MANAGER always gets their own site
    if (req.user!.role === "SITE_MANAGER") {
      siteId = req.user!.siteId;
    }

    // Create template
    const [template] = await db
      .insert(inspectionTemplates)
      .values({
        name,
        type,
        siteId: siteId || null,
        isActive: true,
      })
      .returning();

    // Create sections and questions
    for (const sec of sections || []) {
      const [section] = await db
        .insert(templateSections)
        .values({
          templateId: template.id,
          title: sec.title,
          order: sec.order,
        })
        .returning();

      for (const q of sec.questions || []) {
        await db.insert(templateQuestions).values({
          sectionId: section.id,
          text: q.text,
          order: q.order,
          requiresEvidenceOnFail: q.requiresEvidenceOnFail || false,
          allowMonitor: q.allowMonitor !== false,
          helpText: q.helpText || null,
        });
      }
    }

    // Fetch complete template
    const full = await db.query.inspectionTemplates.findFirst({
      where: eq(inspectionTemplates.id, template.id),
      with: {
        sections: {
          orderBy: asc(templateSections.order),
          with: {
            questions: {
              orderBy: asc(templateQuestions.order),
            },
          },
        },
      },
    });

    res.status(201).json(full);
  },
);

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "SITE_MANAGER"),
  async (req: Request, res: Response): Promise<void> => {
    const { name, type, isActive, sections } = req.body;
    let { siteId } = req.body;

    // SITE_MANAGER: verify they own the template
    if (req.user!.role === "SITE_MANAGER") {
      const existing = await db.query.inspectionTemplates.findFirst({
        where: eq(inspectionTemplates.id, req.params.id),
      });
      if (!existing) {
        res.status(404).json({ error: "Template not found" });
        return;
      }
      if (existing.siteId !== req.user!.siteId) {
        res.status(403).json({ error: "You can only edit templates for your own site" });
        return;
      }
      siteId = req.user!.siteId;
    }

    // Delete existing sections (cascade deletes questions via DB FK)
    // First get section ids to delete questions
    const existingSections = await db
      .select({ id: templateSections.id })
      .from(templateSections)
      .where(eq(templateSections.templateId, req.params.id));

    for (const sec of existingSections) {
      await db.delete(templateQuestions).where(eq(templateQuestions.sectionId, sec.id));
    }
    await db.delete(templateSections).where(eq(templateSections.templateId, req.params.id));

    // Update template
    await db
      .update(inspectionTemplates)
      .set({
        name,
        type,
        siteId: siteId || null,
        isActive: isActive !== undefined ? isActive : true,
      })
      .where(eq(inspectionTemplates.id, req.params.id));

    // Recreate sections and questions
    for (const sec of sections || []) {
      const [section] = await db
        .insert(templateSections)
        .values({
          templateId: req.params.id,
          title: sec.title,
          order: sec.order,
        })
        .returning();

      for (const q of sec.questions || []) {
        await db.insert(templateQuestions).values({
          sectionId: section.id,
          text: q.text,
          order: q.order,
          requiresEvidenceOnFail: q.requiresEvidenceOnFail || false,
          allowMonitor: q.allowMonitor !== false,
          helpText: q.helpText || null,
        });
      }
    }

    // Fetch complete template
    const full = await db.query.inspectionTemplates.findFirst({
      where: eq(inspectionTemplates.id, req.params.id),
      with: {
        sections: {
          orderBy: asc(templateSections.order),
          with: {
            questions: {
              orderBy: asc(templateQuestions.order),
            },
          },
        },
      },
    });

    res.json(full);
  },
);

export default router;
