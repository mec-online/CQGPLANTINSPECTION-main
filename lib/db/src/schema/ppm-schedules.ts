import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { ppmFrequencyEnum } from "./enums.js";
import { assets } from "./assets.js";
import { inspectionTemplates } from "./inspection-templates.js";

export const ppmSchedules = pgTable("ppm_schedules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id),
  templateId: text("template_id").references(() => inspectionTemplates.id),
  taskName: text("task_name").notNull(),
  description: text("description"),
  frequency: ppmFrequencyEnum("frequency").notNull(),
  lastCompletedAt: timestamp("last_completed_at", { withTimezone: true }),
  nextDueAt: timestamp("next_due_at", { withTimezone: true }).notNull(),
  notes: text("notes"),
  assignedRoleId: text("assigned_role_id"),
});
