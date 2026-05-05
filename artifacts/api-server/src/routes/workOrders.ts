import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  workOrders,
  sites,
  assets,
  users,
  inspections,
  inspectionAnswers,
  templateQuestions,
  attachments,
} from "@workspace/db/schema";
import { eq, and, lt, notInArray, desc, asc, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { siteId, status, priority, assignedToId, limit = "50", offset = "0" } = req.query;

  const conditions: (ReturnType<typeof eq>)[] = [];
  if (siteId) conditions.push(eq(workOrders.siteId, siteId as string));
  if (status) conditions.push(eq(workOrders.status, status as string));
  if (priority) conditions.push(eq(workOrders.priority, priority as string));
  if (assignedToId) conditions.push(eq(workOrders.assignedToId, assignedToId as string));

  // Operators and site managers see only their site's work orders
  if (req.user!.role === "OPERATOR" && req.user!.siteId) {
    conditions.push(eq(workOrders.siteId, req.user!.siteId));
  }
  if (req.user!.role === "SITE_MANAGER" && req.user!.siteId) {
    conditions.push(eq(workOrders.siteId, req.user!.siteId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db.query.workOrders.findMany({
      where,
      with: {
        site: true,
        asset: true,
        assignedTo: true,
        createdBy: true,
        attachments: true,
      },
      orderBy: desc(workOrders.createdAt),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    }),
    db.select({ count: count() }).from(workOrders).where(where),
  ]);

  const enriched = rows.map((wo) => ({
    id: wo.id,
    title: wo.title,
    description: wo.description,
    priority: wo.priority,
    status: wo.status,
    createdAt: wo.createdAt,
    dueDate: wo.dueDate,
    completedAt: wo.completedAt,
    verifiedAt: wo.verifiedAt,
    site: wo.site ? { id: wo.site.id, name: wo.site.name, code: wo.site.code } : null,
    asset: wo.asset
      ? { id: wo.asset.id, name: wo.asset.name, plantId: wo.asset.plantId }
      : null,
    assignedTo: wo.assignedTo
      ? { id: wo.assignedTo.id, name: wo.assignedTo.name }
      : null,
    createdBy: wo.createdBy
      ? { id: wo.createdBy.id, name: wo.createdBy.name }
      : null,
    _count: { attachments: wo.attachments.length },
    isOverdue: wo.dueDate
      ? new Date(wo.dueDate) < new Date() &&
        !["COMPLETED", "VERIFIED"].includes(wo.status)
      : false,
  }));

  res.json({ workOrders: enriched, total: totalRow?.count ?? 0 });
});

router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const {
    title,
    description,
    priority,
    siteId,
    assetId,
    assignedToId,
    inspectionId,
    inspectionAnswerId,
    dueDate,
  } = req.body;

  if (!title || !siteId) {
    res.status(400).json({ error: "title and siteId required" });
    return;
  }

  const [workOrder] = await db
    .insert(workOrders)
    .values({
      title,
      description: description || null,
      priority: priority || "MEDIUM",
      status: "OPEN",
      siteId,
      assetId: assetId || null,
      assignedToId: assignedToId || null,
      inspectionId: inspectionId || null,
      inspectionAnswerId: inspectionAnswerId || null,
      createdById: req.user!.id,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();

  const full = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, workOrder.id),
    with: {
      site: true,
      asset: true,
      createdBy: true,
    },
  });

  res.status(201).json({
    ...full,
    site: full?.site ? { id: full.site.id, name: full.site.name, code: full.site.code } : null,
    asset: full?.asset
      ? { id: full.asset.id, name: full.asset.name, plantId: full.asset.plantId }
      : null,
    createdBy: full?.createdBy
      ? { id: full.createdBy.id, name: full.createdBy.name }
      : null,
  });
});

router.get("/overdue", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const conditions: (ReturnType<typeof eq>)[] = [
    lt(workOrders.dueDate, new Date()),
    notInArray(workOrders.status, ["COMPLETED", "VERIFIED"]),
  ];
  if (req.user!.role === "OPERATOR" && req.user!.siteId)
    conditions.push(eq(workOrders.siteId, req.user!.siteId));
  if (req.user!.role === "SITE_MANAGER" && req.user!.siteId)
    conditions.push(eq(workOrders.siteId, req.user!.siteId));

  const rows = await db.query.workOrders.findMany({
    where: and(...conditions),
    with: {
      site: true,
      asset: true,
    },
    orderBy: asc(workOrders.dueDate),
    limit: 20,
  });

  const result = rows.map((wo) => ({
    id: wo.id,
    title: wo.title,
    priority: wo.priority,
    status: wo.status,
    dueDate: wo.dueDate,
    site: wo.site ? { code: wo.site.code } : null,
    asset: wo.asset ? { name: wo.asset.name } : null,
  }));

  res.json(result);
});

router.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const workOrder = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, req.params.id),
    with: {
      site: true,
      asset: true,
      assignedTo: true,
      createdBy: true,
      verifiedBy: true,
      inspection: true,
      inspectionAnswer: {
        with: {
          question: true,
        },
      },
      attachments: {
        with: {
          uploadedBy: true,
        },
      },
    },
  });

  if (!workOrder) {
    res.status(404).json({ error: "Work order not found" });
    return;
  }

  res.json({
    ...workOrder,
    site: workOrder.site
      ? { id: workOrder.site.id, name: workOrder.site.name, code: workOrder.site.code }
      : null,
    asset: workOrder.asset
      ? {
          id: workOrder.asset.id,
          name: workOrder.asset.name,
          plantId: workOrder.asset.plantId,
          manufacturer: workOrder.asset.manufacturer,
          model: workOrder.asset.model,
        }
      : null,
    assignedTo: workOrder.assignedTo
      ? { id: workOrder.assignedTo.id, name: workOrder.assignedTo.name, email: workOrder.assignedTo.email }
      : null,
    createdBy: workOrder.createdBy
      ? { id: workOrder.createdBy.id, name: workOrder.createdBy.name }
      : null,
    verifiedBy: workOrder.verifiedBy
      ? { id: workOrder.verifiedBy.id, name: workOrder.verifiedBy.name }
      : null,
    inspection: workOrder.inspection
      ? { id: workOrder.inspection.id, startedAt: workOrder.inspection.startedAt, overallResult: workOrder.inspection.overallResult }
      : null,
    inspectionAnswer: workOrder.inspectionAnswer
      ? {
          ...workOrder.inspectionAnswer,
          question: workOrder.inspectionAnswer.question
            ? { text: workOrder.inspectionAnswer.question.text }
            : null,
        }
      : null,
    attachments: workOrder.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      uploadedAt: a.uploadedAt,
      uploadedBy: a.uploadedBy ? { name: a.uploadedBy.name } : null,
      previewUrl: `/attachments/${a.id}`,
    })),
  });
});

router.put("/:id/status", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { status, assignedToId } = req.body;

  const updateData: Record<string, unknown> = { status };
  if (assignedToId) updateData.assignedToId = assignedToId;

  const [workOrder] = await db
    .update(workOrders)
    .set(updateData)
    .where(eq(workOrders.id, req.params.id))
    .returning();

  res.json(workOrder);
});

router.put("/:id/complete", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { notes } = req.body;

  const updateData: Record<string, unknown> = {
    status: "COMPLETED",
    completedAt: new Date(),
  };
  if (notes) updateData.description = notes;

  const [workOrder] = await db
    .update(workOrders)
    .set(updateData)
    .where(eq(workOrders.id, req.params.id))
    .returning();

  res.json(workOrder);
});

router.put("/:id/verify", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [workOrder] = await db
    .update(workOrders)
    .set({
      status: "VERIFIED",
      verifiedAt: new Date(),
      verifiedById: req.user!.id,
    })
    .where(eq(workOrders.id, req.params.id))
    .returning();

  res.json(workOrder);
});

export default router;
