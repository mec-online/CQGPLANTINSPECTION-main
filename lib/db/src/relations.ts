import { relations } from "drizzle-orm";
import { sites } from "./schema/sites.js";
import { areas } from "./schema/areas.js";
import { users } from "./schema/users.js";
import { assets } from "./schema/assets.js";
import { inspectionTemplates } from "./schema/inspection-templates.js";
import { templateSections } from "./schema/template-sections.js";
import { templateQuestions } from "./schema/template-questions.js";
import { inspectionSchedules } from "./schema/inspection-schedules.js";
import { inspections } from "./schema/inspections.js";
import { inspectionAnswers } from "./schema/inspection-answers.js";
import { workOrders } from "./schema/work-orders.js";
import { breakdowns } from "./schema/breakdowns.js";
import { ppmSchedules } from "./schema/ppm-schedules.js";
import { ppmCompletions } from "./schema/ppm-completions.js";
import { assetMovements } from "./schema/asset-movements.js";
import { attachments } from "./schema/attachments.js";
import { assetScans } from "./schema/asset-scans.js";

// ── Site relations ──────────────────────────────────────────────────
export const sitesRelations = relations(sites, ({ many }) => ({
  areas: many(areas),
  assets: many(assets),
  inspections: many(inspections),
  workOrders: many(workOrders),
  breakdowns: many(breakdowns),
  movements: many(assetMovements, { relationName: "movementToSite" }),
  users: many(users),
}));

// ── Area relations ──────────────────────────────────────────────────
export const areasRelations = relations(areas, ({ one, many }) => ({
  site: one(sites, { fields: [areas.siteId], references: [sites.id] }),
  assets: many(assets),
}));

// ── User relations ──────────────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
  site: one(sites, { fields: [users.siteId], references: [sites.id] }),
  completedInspections: many(inspections, {
    relationName: "inspectionCompletedBy",
  }),
  answeredInspections: many(inspectionAnswers, {
    relationName: "answerAnsweredBy",
  }),
  assignedWorkOrders: many(workOrders, {
    relationName: "workOrderAssignedTo",
  }),
  createdWorkOrders: many(workOrders, { relationName: "workOrderCreatedBy" }),
  verifiedWorkOrders: many(workOrders, {
    relationName: "workOrderVerifiedBy",
  }),
  breakdowns: many(breakdowns, { relationName: "breakdownReportedBy" }),
  ppmCompletions: many(ppmCompletions, {
    relationName: "ppmCompletionCompletedBy",
  }),
  movements: many(assetMovements, { relationName: "movementMovedBy" }),
  attachments: many(attachments, { relationName: "attachmentUploadedBy" }),
  assetScans: many(assetScans, { relationName: "assetScanScannedBy" }),
}));

// ── Asset relations ─────────────────────────────────────────────────
export const assetsRelations = relations(assets, ({ one, many }) => ({
  site: one(sites, { fields: [assets.siteId], references: [sites.id] }),
  area: one(areas, { fields: [assets.areaId], references: [areas.id] }),
  inspections: many(inspections),
  workOrders: many(workOrders),
  breakdowns: many(breakdowns),
  ppmSchedules: many(ppmSchedules),
  movements: many(assetMovements),
  assetScans: many(assetScans),
}));

// ── InspectionTemplate relations ────────────────────────────────────
export const inspectionTemplatesRelations = relations(
  inspectionTemplates,
  ({ one, many }) => ({
    site: one(sites, {
      fields: [inspectionTemplates.siteId],
      references: [sites.id],
    }),
    sections: many(templateSections),
    inspections: many(inspections),
    schedules: many(inspectionSchedules),
    ppmSchedules: many(ppmSchedules),
  }),
);

// ── TemplateSection relations ───────────────────────────────────────
export const templateSectionsRelations = relations(
  templateSections,
  ({ one, many }) => ({
    template: one(inspectionTemplates, {
      fields: [templateSections.templateId],
      references: [inspectionTemplates.id],
    }),
    questions: many(templateQuestions),
  }),
);

// ── TemplateQuestion relations ──────────────────────────────────────
export const templateQuestionsRelations = relations(
  templateQuestions,
  ({ one, many }) => ({
    section: one(templateSections, {
      fields: [templateQuestions.sectionId],
      references: [templateSections.id],
    }),
    answers: many(inspectionAnswers),
  }),
);

// ── InspectionSchedule relations ────────────────────────────────────
export const inspectionSchedulesRelations = relations(
  inspectionSchedules,
  ({ one }) => ({
    template: one(inspectionTemplates, {
      fields: [inspectionSchedules.templateId],
      references: [inspectionTemplates.id],
    }),
    asset: one(assets, {
      fields: [inspectionSchedules.assetId],
      references: [assets.id],
    }),
    site: one(sites, {
      fields: [inspectionSchedules.siteId],
      references: [sites.id],
    }),
  }),
);

// ── Inspection relations ────────────────────────────────────────────
export const inspectionsRelations = relations(
  inspections,
  ({ one, many }) => ({
    template: one(inspectionTemplates, {
      fields: [inspections.templateId],
      references: [inspectionTemplates.id],
    }),
    asset: one(assets, {
      fields: [inspections.assetId],
      references: [assets.id],
    }),
    site: one(sites, {
      fields: [inspections.siteId],
      references: [sites.id],
    }),
    completedBy: one(users, {
      fields: [inspections.completedById],
      references: [users.id],
      relationName: "inspectionCompletedBy",
    }),
    answers: many(inspectionAnswers),
    workOrders: many(workOrders),
    preMovements: many(assetMovements, {
      relationName: "movementPreInspection",
    }),
    postMovements: many(assetMovements, {
      relationName: "movementPostInspection",
    }),
  }),
);

// ── InspectionAnswer relations ──────────────────────────────────────
export const inspectionAnswersRelations = relations(
  inspectionAnswers,
  ({ one, many }) => ({
    inspection: one(inspections, {
      fields: [inspectionAnswers.inspectionId],
      references: [inspections.id],
    }),
    question: one(templateQuestions, {
      fields: [inspectionAnswers.questionId],
      references: [templateQuestions.id],
    }),
    answeredBy: one(users, {
      fields: [inspectionAnswers.answeredById],
      references: [users.id],
      relationName: "answerAnsweredBy",
    }),
    workOrders: many(workOrders),
    attachments: many(attachments),
  }),
);

// ── WorkOrder relations ─────────────────────────────────────────────
export const workOrdersRelations = relations(
  workOrders,
  ({ one, many }) => ({
    inspection: one(inspections, {
      fields: [workOrders.inspectionId],
      references: [inspections.id],
    }),
    inspectionAnswer: one(inspectionAnswers, {
      fields: [workOrders.inspectionAnswerId],
      references: [inspectionAnswers.id],
    }),
    asset: one(assets, {
      fields: [workOrders.assetId],
      references: [assets.id],
    }),
    site: one(sites, {
      fields: [workOrders.siteId],
      references: [sites.id],
    }),
    assignedTo: one(users, {
      fields: [workOrders.assignedToId],
      references: [users.id],
      relationName: "workOrderAssignedTo",
    }),
    createdBy: one(users, {
      fields: [workOrders.createdById],
      references: [users.id],
      relationName: "workOrderCreatedBy",
    }),
    verifiedBy: one(users, {
      fields: [workOrders.verifiedById],
      references: [users.id],
      relationName: "workOrderVerifiedBy",
    }),
    attachments: many(attachments),
  }),
);

// ── Breakdown relations ─────────────────────────────────────────────
export const breakdownsRelations = relations(
  breakdowns,
  ({ one, many }) => ({
    asset: one(assets, {
      fields: [breakdowns.assetId],
      references: [assets.id],
    }),
    site: one(sites, {
      fields: [breakdowns.siteId],
      references: [sites.id],
    }),
    reportedBy: one(users, {
      fields: [breakdowns.reportedById],
      references: [users.id],
      relationName: "breakdownReportedBy",
    }),
    attachments: many(attachments),
  }),
);

// ── PPMSchedule relations ───────────────────────────────────────────
export const ppmSchedulesRelations = relations(
  ppmSchedules,
  ({ one, many }) => ({
    asset: one(assets, {
      fields: [ppmSchedules.assetId],
      references: [assets.id],
    }),
    template: one(inspectionTemplates, {
      fields: [ppmSchedules.templateId],
      references: [inspectionTemplates.id],
    }),
    completions: many(ppmCompletions),
  }),
);

// ── PPMCompletion relations ─────────────────────────────────────────
export const ppmCompletionsRelations = relations(
  ppmCompletions,
  ({ one }) => ({
    schedule: one(ppmSchedules, {
      fields: [ppmCompletions.ppmScheduleId],
      references: [ppmSchedules.id],
    }),
    completedBy: one(users, {
      fields: [ppmCompletions.completedById],
      references: [users.id],
      relationName: "ppmCompletionCompletedBy",
    }),
  }),
);

// ── AssetMovement relations ─────────────────────────────────────────
export const assetMovementsRelations = relations(
  assetMovements,
  ({ one, many }) => ({
    asset: one(assets, {
      fields: [assetMovements.assetId],
      references: [assets.id],
    }),
    fromSite: one(sites, {
      fields: [assetMovements.fromSiteId],
      references: [sites.id],
      relationName: "movementFromSite",
    }),
    toSite: one(sites, {
      fields: [assetMovements.toSiteId],
      references: [sites.id],
      relationName: "movementToSite",
    }),
    movedBy: one(users, {
      fields: [assetMovements.movedById],
      references: [users.id],
      relationName: "movementMovedBy",
    }),
    preInspection: one(inspections, {
      fields: [assetMovements.preInspectionId],
      references: [inspections.id],
      relationName: "movementPreInspection",
    }),
    postInspection: one(inspections, {
      fields: [assetMovements.postInspectionId],
      references: [inspections.id],
      relationName: "movementPostInspection",
    }),
    attachments: many(attachments),
  }),
);

// ── Attachment relations ────────────────────────────────────────────
export const attachmentsRelations = relations(attachments, ({ one }) => ({
  uploadedBy: one(users, {
    fields: [attachments.uploadedById],
    references: [users.id],
    relationName: "attachmentUploadedBy",
  }),
  workOrder: one(workOrders, {
    fields: [attachments.workOrderId],
    references: [workOrders.id],
  }),
  inspectionAnswer: one(inspectionAnswers, {
    fields: [attachments.inspectionAnswerId],
    references: [inspectionAnswers.id],
  }),
  breakdown: one(breakdowns, {
    fields: [attachments.breakdownId],
    references: [breakdowns.id],
  }),
  assetMovement: one(assetMovements, {
    fields: [attachments.assetMovementId],
    references: [assetMovements.id],
  }),
}));

// ── AssetScan relations ─────────────────────────────────────────────
export const assetScansRelations = relations(assetScans, ({ one }) => ({
  asset: one(assets, {
    fields: [assetScans.assetId],
    references: [assets.id],
  }),
  scannedBy: one(users, {
    fields: [assetScans.scannedById],
    references: [users.id],
    relationName: "assetScanScannedBy",
  }),
}));
