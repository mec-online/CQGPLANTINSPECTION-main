import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  inspections,
  inspectionAnswers,
  inspectionSchedules,
  inspectionTemplates,
  templateSections,
  templateQuestions,
  assets,
  sites,
  users,
  workOrders,
  attachments,
} from "@workspace/db/schema";
import { eq, and, lt, desc, asc, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

function criticalityToPriority(criticality: string): string {
  switch (criticality) {
    case "HIGH":
      return "HIGH";
    case "LOW":
      return "LOW";
    default:
      return "MEDIUM";
  }
}

router.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId, assetId, status, templateId, limit = "50", offset = "0" } = req.query;

  const conditions: (ReturnType<typeof eq>)[] = [];
  if (siteId) conditions.push(eq(inspections.siteId, siteId as string));
  if (assetId) conditions.push(eq(inspections.assetId, assetId as string));
  if (status) conditions.push(eq(inspections.status, status as string));
  if (templateId) conditions.push(eq(inspections.templateId, templateId as string));

  // Operators see only their own site
  if (req.user!.role === "OPERATOR" && req.user!.siteId) {
    conditions.push(eq(inspections.siteId, req.user!.siteId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db.query.inspections.findMany({
      where,
      with: {
        template: true,
        asset: true,
        site: true,
        completedBy: true,
        answers: true,
        workOrders: true,
      },
      orderBy: desc(inspections.startedAt),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    }),
    db.select({ count: count() }).from(inspections).where(where),
  ]);

  const result = rows.map((i) => ({
    id: i.id,
    startedAt: i.startedAt,
    completedAt: i.completedAt,
    status: i.status,
    overallResult: i.overallResult,
    template: i.template
      ? { id: i.template.id, name: i.template.name, type: i.template.type }
      : null,
    asset: i.asset
      ? { id: i.asset.id, name: i.asset.name, plantId: i.asset.plantId }
      : null,
    site: i.site ? { id: i.site.id, name: i.site.name, code: i.site.code } : null,
    completedBy: i.completedBy ? { id: i.completedBy.id, name: i.completedBy.name } : null,
    _count: {
      answers: i.answers.length,
      workOrders: i.workOrders.length,
    },
  }));

  res.json({ inspections: result, total: totalRow?.count ?? 0 });
});

router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { templateId, assetId, siteId, locationLat, locationLng } = req.body;

  if (!templateId || !siteId) {
    res.status(400).json({ error: "templateId and siteId required" });
    return;
  }

  const [inspection] = await db
    .insert(inspections)
    .values({
      templateId,
      assetId: assetId || null,
      siteId,
      locationLat: locationLat || null,
      locationLng: locationLng || null,
      status: "IN_PROGRESS",
    })
    .returning();

  const full = await db.query.inspections.findFirst({
    where: eq(inspections.id, inspection.id),
    with: {
      template: {
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
      },
      asset: true,
      site: true,
    },
  });

  res.status(201).json({
    ...full,
    asset: full?.asset
      ? { id: full.asset.id, name: full.asset.name, plantId: full.asset.plantId, criticality: full.asset.criticality }
      : null,
    site: full?.site
      ? { id: full.site.id, name: full.site.name, code: full.site.code }
      : null,
  });
});

router.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const inspection = await db.query.inspections.findFirst({
    where: eq(inspections.id, req.params.id),
    with: {
      template: {
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
      },
      asset: true,
      site: true,
      completedBy: true,
      answers: {
        with: {
          question: true,
          answeredBy: true,
          attachments: true,
        },
      },
      workOrders: true,
    },
  });

  if (!inspection) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  res.json({
    ...inspection,
    asset: inspection.asset
      ? { id: inspection.asset.id, name: inspection.asset.name, plantId: inspection.asset.plantId, criticality: inspection.asset.criticality }
      : null,
    site: inspection.site
      ? { id: inspection.site.id, name: inspection.site.name, code: inspection.site.code }
      : null,
    completedBy: inspection.completedBy
      ? { id: inspection.completedBy.id, name: inspection.completedBy.name }
      : null,
    answers: inspection.answers.map((a) => ({
      ...a,
      question: a.question
        ? { id: a.question.id, text: a.question.text, order: a.question.order, sectionId: a.question.sectionId }
        : null,
      answeredBy: a.answeredBy ? { id: a.answeredBy.id, name: a.answeredBy.name } : null,
      attachments: a.attachments.map((att) => ({
        id: att.id,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        uploadedAt: att.uploadedAt,
      })),
    })),
    workOrders: inspection.workOrders.map((wo) => ({
      id: wo.id,
      title: wo.title,
      priority: wo.priority,
      status: wo.status,
      createdAt: wo.createdAt,
    })),
  });
});

router.put("/:id/answers", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { answers } = req.body;

  if (!Array.isArray(answers)) {
    res.status(400).json({ error: "answers must be an array" });
    return;
  }

  const inspection = await db.query.inspections.findFirst({
    where: eq(inspections.id, req.params.id),
    with: {
      asset: true,
    },
  });

  if (!inspection) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  if (inspection.status !== "IN_PROGRESS") {
    res.status(400).json({ error: "Inspection is not in progress" });
    return;
  }

  const savedAnswers = [];
  for (const ans of answers) {
    // Check for existing answer
    const existing = await db.query.inspectionAnswers.findFirst({
      where: and(
        eq(inspectionAnswers.inspectionId, req.params.id),
        eq(inspectionAnswers.questionId, ans.questionId),
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(inspectionAnswers)
        .set({
          result: ans.result,
          notes: ans.notes || null,
          answeredById: req.user!.id,
          answeredAt: new Date(),
          locationLat: ans.locationLat ?? existing.locationLat,
          locationLng: ans.locationLng ?? existing.locationLng,
        })
        .where(eq(inspectionAnswers.id, existing.id))
        .returning();
      savedAnswers.push(updated);
    } else {
      const [created] = await db
        .insert(inspectionAnswers)
        .values({
          inspectionId: req.params.id,
          questionId: ans.questionId,
          result: ans.result,
          notes: ans.notes || null,
          answeredById: req.user!.id,
          locationLat: ans.locationLat ?? null,
          locationLng: ans.locationLng ?? null,
        })
        .returning();
      savedAnswers.push(created);

      // Auto-create work order on FAIL
      if (ans.result === "FAIL" && inspection.asset) {
        const question = await db.query.templateQuestions.findFirst({
          where: eq(templateQuestions.id, ans.questionId),
        });

        const dueDate = new Date();
        dueDate.setDate(
          dueDate.getDate() +
            (inspection.asset.criticality === "HIGH"
              ? 1
              : inspection.asset.criticality === "MEDIUM"
                ? 7
                : 14),
        );

        await db.insert(workOrders).values({
          inspectionId: req.params.id,
          inspectionAnswerId: created.id,
          assetId: inspection.assetId,
          siteId: inspection.siteId,
          title: `FAIL: ${question?.text || "Inspection item failed"}`,
          description: ans.notes || null,
          priority: criticalityToPriority(inspection.asset.criticality),
          status: "OPEN",
          createdById: req.user!.id,
          dueDate,
        });
      }
    }
  }

  res.json({ answers: savedAnswers });
});

router.post("/:id/complete", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const inspection = await db.query.inspections.findFirst({
    where: eq(inspections.id, req.params.id),
    with: {
      answers: true,
      asset: true,
    },
  });

  if (!inspection) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  if (inspection.status !== "IN_PROGRESS") {
    res.status(400).json({ error: "Inspection is not in progress" });
    return;
  }

  // Determine overall result
  const results = inspection.answers.map((a) => a.result);
  let overallResult: "PASS" | "FAIL" | "MONITOR" = "PASS";
  if (results.includes("FAIL")) {
    overallResult = "FAIL";
  } else if (results.includes("MONITOR")) {
    overallResult = "MONITOR";
  }

  // Auto-create work orders for any FAIL answers that don't already have one
  const failAnswers = inspection.answers.filter((a) => a.result === "FAIL");
  for (const answer of failAnswers) {
    const existingWO = await db.query.workOrders.findFirst({
      where: eq(workOrders.inspectionAnswerId, answer.id),
    });
    if (!existingWO) {
      const question = await db.query.templateQuestions.findFirst({
        where: eq(templateQuestions.id, answer.questionId),
      });
      const dueDate = new Date();
      dueDate.setDate(
        dueDate.getDate() +
          (inspection.asset?.criticality === "HIGH"
            ? 1
            : inspection.asset?.criticality === "MEDIUM"
              ? 7
              : 14),
      );
      await db.insert(workOrders).values({
        inspectionId: req.params.id,
        inspectionAnswerId: answer.id,
        assetId: inspection.assetId,
        siteId: inspection.siteId,
        title: `FAIL: ${question?.text || "Inspection item failed"}`,
        description: answer.notes || null,
        priority: inspection.asset
          ? criticalityToPriority(inspection.asset.criticality)
          : "MEDIUM",
        status: "OPEN",
        createdById: req.user!.id,
        dueDate,
      });
    }
  }

  const [completed] = await db
    .update(inspections)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: req.user!.id,
      overallResult,
    })
    .where(eq(inspections.id, req.params.id))
    .returning();

  res.json(completed);
});

// Overdue inspection schedules
router.get(
  "/schedules/overdue",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const conditions: (ReturnType<typeof eq>)[] = [
      lt(inspectionSchedules.nextDueAt, new Date()),
    ];
    if (req.user!.role === "OPERATOR" && req.user!.siteId)
      conditions.push(eq(inspectionSchedules.siteId, req.user!.siteId));
    if (req.user!.role === "SITE_MANAGER" && req.user!.siteId)
      conditions.push(eq(inspectionSchedules.siteId, req.user!.siteId));

    const schedules = await db.query.inspectionSchedules.findMany({
      where: and(...conditions),
      with: {
        template: true,
      },
      orderBy: asc(inspectionSchedules.nextDueAt),
      limit: 20,
    });

    const result = schedules.map((s) => ({
      ...s,
      template: s.template
        ? { id: s.template.id, name: s.template.name, type: s.template.type }
        : null,
    }));

    res.json(result);
  },
);

// List schedules
router.get("/schedules", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId, assetId } = req.query;
  const conditions: (ReturnType<typeof eq>)[] = [];
  if (siteId) conditions.push(eq(inspectionSchedules.siteId, siteId as string));
  if (assetId) conditions.push(eq(inspectionSchedules.assetId, assetId as string));
  if (req.user!.role === "SITE_MANAGER" && req.user!.siteId)
    conditions.push(eq(inspectionSchedules.siteId, req.user!.siteId));
  if (req.user!.role === "OPERATOR" && req.user!.siteId)
    conditions.push(eq(inspectionSchedules.siteId, req.user!.siteId));

  const schedules = await db.query.inspectionSchedules.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      template: true,
    },
    orderBy: asc(inspectionSchedules.nextDueAt),
  });

  const result = schedules.map((s) => ({
    ...s,
    template: s.template
      ? { id: s.template.id, name: s.template.name, type: s.template.type }
      : null,
  }));

  res.json(result);
});

// Create schedule
router.post(
  "/schedules",
  requireAuth,
  requireRole("ADMIN", "SITE_MANAGER"),
  async (req: Request, res: Response): Promise<void> => {
    const { templateId, assetId, siteId, frequency, nextDueAt, assignedRoleId } = req.body;
    if (!templateId || !siteId || !frequency || !nextDueAt) {
      res.status(400).json({ error: "templateId, siteId, frequency, nextDueAt required" });
      return;
    }
    const [schedule] = await db
      .insert(inspectionSchedules)
      .values({
        templateId,
        assetId: assetId || null,
        siteId,
        frequency,
        nextDueAt: new Date(nextDueAt),
        assignedRoleId: assignedRoleId || null,
      })
      .returning();

    const full = await db.query.inspectionSchedules.findFirst({
      where: eq(inspectionSchedules.id, schedule.id),
      with: { template: true },
    });

    res.status(201).json({
      ...full,
      template: full?.template
        ? { id: full.template.id, name: full.template.name, type: full.template.type }
        : null,
    });
  },
);

// Delete schedule
router.delete(
  "/schedules/:id",
  requireAuth,
  requireRole("ADMIN", "SITE_MANAGER"),
  async (req: Request, res: Response): Promise<void> => {
    await db.delete(inspectionSchedules).where(eq(inspectionSchedules.id, req.params.id));
    res.status(204).send();
  },
);

export default router;
